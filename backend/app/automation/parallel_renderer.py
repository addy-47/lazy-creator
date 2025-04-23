"""
Parallel video rendering module for YouTube Shorts automation.
Implements multiprocessing capabilities for faster video rendering while maintaining original quality and transitions.
"""

import os
import time
import logging
import tempfile
import multiprocessing
from tqdm import tqdm
from moviepy.editor import VideoFileClip, concatenate_videoclips, CompositeVideoClip, AudioFileClip
from datetime import datetime
from concurrent.futures import ProcessPoolExecutor, as_completed
import gc
import shutil
import subprocess
import signal
import atexit
import weakref
import threading
import numpy as np
import uuid
import moviepy.editor as mp

# Import the storage_helper to use the correct service account
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from storage_helper import get_storage_client, reset_client

logger = logging.getLogger(__name__)

# Thread-safe shutdown flag
_shutdown_requested = threading.Event()
_temp_files = set()
_temp_files_lock = threading.Lock()

def request_shutdown():
    """Set the shutdown flag to request a graceful shutdown"""
    _shutdown_requested.set()

def is_shutdown_requested():
    """Check if shutdown has been requested"""
    return _shutdown_requested.is_set()

def handle_shutdown_signal(signum, frame):
    """Handle shutdown signals gracefully"""
    print(f"Received shutdown signal {signum}, requesting graceful shutdown...")
    request_shutdown()

# Install signal handlers for common termination signals
try:
    # Only install these in the main process
    if multiprocessing.current_process().name == 'MainProcess':
        signal.signal(signal.SIGINT, handle_shutdown_signal)
        signal.signal(signal.SIGTERM, handle_shutdown_signal)
        # On Windows, CTRL+C is SIGINT, but we handle it specifically
        if hasattr(signal, 'SIGBREAK'):  # Windows-specific
            signal.signal(signal.SIGBREAK, handle_shutdown_signal)
except (ValueError, OSError):
    # Ignore errors that might happen in some contexts (e.g. in child processes)
    pass

def register_temp_file(filepath):
    """Register a temporary file for cleanup"""
    with _temp_files_lock:
        _temp_files.add(filepath)

def cleanup_temp_files():
    """Clean up registered temporary files"""
    with _temp_files_lock:
        for filepath in _temp_files:
            try:
                if os.path.exists(filepath):
                    os.remove(filepath)
            except Exception as e:
                logging.debug(f"Error removing temp file {filepath}: {e}")
        _temp_files.clear()

# Register cleanup on process exit
atexit.register(cleanup_temp_files)

# Simple workaround flag to avoid patching errors
USING_DILL = False

# Only try to load dill if needed
try:
    import dill

    # Configure dill with safe settings
    dill.settings['recurse'] = True

    # Basic verification that dill works
    test_func = lambda x: x+1
    test_data = {"func": test_func}
    serialized = dill.dumps(test_data)
    deserialized = dill.loads(serialized)

    # If we got here, dill is working
    USING_DILL = True
    # Avoid patching multiprocessing, just use dill for explicit serialization

except ImportError:
    USING_DILL = False
    logger.info("Dill not available. Using standard pickle for serialization.")
except Exception as e:
    logger.warning(f"Error setting up dill: {e}")
    USING_DILL = False

def render_clip_segment(clip, output_path, fps=30, preset="veryfast", threads=2, show_progress=True):
    """
    Render a single clip segment to a file.

    Args:
        clip: The MoviePy clip to render
        output_path: Where to save the rendered clip
        fps: Frames per second
        preset: Video encoding preset
        threads: Number of threads for encoding
        show_progress: Whether to show a progress bar

    Returns:
        output_path: The path where the clip was saved
    """
    start_time = time.time()
    logger.info(f"Starting render of segment to {output_path}")

    try:
        # Register this file for cleanup
        register_temp_file(output_path)

        # Check if shutdown was requested before starting expensive operation
        if is_shutdown_requested():
            logger.info("Shutdown requested, aborting render")
            return None

        # Use optimized encoding settings with reduced memory usage
        # Show progress bar with tqdm if requested
        logger_setting = None if show_progress else "bar"

        # Pre-process and configure to reduce memory usage
        gc.collect()  # Force garbage collection before each render

        # Memory-efficient rendering settings
        clip.write_videofile(
            output_path,
            fps=fps,
            codec="libx264",
            audio_codec="aac",
            threads=threads,
            preset=preset if preset else "ultrafast",  # Use ultrafast preset if none specified
            audio_bufsize=4096,  # Reduced buffer size to save memory
            ffmpeg_params=[
                "-bufsize", "10M",      # Reduced buffer size
                "-maxrate", "2M",       # Lower max rate to save memory
                "-pix_fmt", "yuv420p",  # Compatible pixel format for all players
                "-crf", "28"            # Higher compression (lower quality) to save memory
            ],
            logger=logger_setting  # None shows progress bar, "bar" hides it
        )
        duration = time.time() - start_time
        logger.info(f"Completed render of segment {output_path} in {duration:.2f} seconds")

        return output_path
    except Exception as e:
        logger.error(f"Error rendering segment {output_path}: {e}")
        # Try to clean up the failed output file
        if os.path.exists(output_path):
            try:
                os.remove(output_path)
            except:
                pass
        raise

# Pre-rendering function for complex clips to avoid serialization issues
def prerender_complex_clip(clip, temp_dir, idx, fps):
    """
    Pre-render a complex clip to avoid serialization issues

    This function takes a complex clip that may have callable attributes
    or other features that cause serialization problems, simplifies it
    by fixing those attributes, and renders it to a temporary file.

    Args:
        clip: The complex clip to pre-render
        temp_dir: Directory to store the temporary file
        idx: Index of the clip for logging
        fps: Frames per second for rendering

    Returns:
        Path to the pre-rendered file, or None if pre-rendering failed
    """
    # Generate a unique filename
    temp_path = os.path.join(temp_dir, f"prerender_{idx}_{int(time.time())}.mp4")

    # Start with original clip
    needs_cleaning = False
    modified_clip = None

    try:
        # Check for complex position attributes
        has_callable_pos = hasattr(clip, 'pos') and callable(clip.pos)
        has_callable_size = hasattr(clip, 'size') and callable(clip.size)

        # Handle CompositeVideoClip specially
        if isinstance(clip, CompositeVideoClip) and hasattr(clip, 'clips') and clip.clips:
            # Check if any subclip has complex attributes
            modified_subclips = []
            has_complex_subclips = False

            for subclip in clip.clips:
                # Start with the original subclip
                fixed_subclip = subclip
                subclip_modified = False

                # Check for callable pos
                if hasattr(subclip, 'pos') and callable(subclip.pos):
                    try:
                        # Sample the position at the middle of the duration
                        mid_time = subclip.duration / 2
                        mid_pos = subclip.pos(mid_time)

                        # Ensure position is a flat tuple, not a nested tuple
                        if isinstance(mid_pos, tuple) and len(mid_pos) > 0 and isinstance(mid_pos[0], tuple):
                            # If the position is a nested tuple, flatten it
                            mid_pos = mid_pos[0]
                            logger.debug(f"Flattened nested position tuple in subclip of clip {idx}")

                        fixed_subclip = fixed_subclip.set_position(mid_pos)
                        subclip_modified = True
                        logger.debug(f"Fixed callable position in subclip of clip {idx}")
                    except Exception as e:
                        logger.warning(f"Failed to fix callable position in subclip: {e}")
                        # Set a safe default position
                        fixed_subclip = fixed_subclip.set_position('center')

                # Check and fix size
                if hasattr(subclip, 'size') and callable(subclip.size):
                    try:
                        # Sample the size at the middle of the duration
                        mid_time = subclip.duration / 2
                        mid_size = subclip.size(mid_time)
                        fixed_subclip = fixed_subclip.resize(mid_size)
                        subclip_modified = True
                        logger.debug(f"Fixed callable size in subclip of clip {idx}")
                    except Exception as e:
                        logger.warning(f"Failed to fix callable size in subclip: {e}")

                # Add the subclip to our list (fixed or original)
                modified_subclips.append(fixed_subclip)

                # Track if any subclips were modified
                has_complex_subclips = has_complex_subclips or subclip_modified

            # Only recreate the composite if any subclips were modified
            if has_complex_subclips:
                needs_cleaning = True
                try:
                    modified_clip = CompositeVideoClip(modified_subclips, size=clip.size)
                    logger.info(f"Created new composite clip with fixed subclips for clip {idx}")
                except Exception as e:
                    logger.warning(f"Failed to recreate composite clip: {e}")
                    modified_clip = None

        # Handle main clip callable attributes
        if has_callable_pos or has_callable_size:
            needs_cleaning = True
            # Use the modified clip if we already created one, otherwise start with the original
            base_clip = modified_clip if modified_clip is not None else clip

            try:
                # Fix position if needed
                if has_callable_pos:
                    try:
                        mid_time = base_clip.duration / 2
                        mid_pos = base_clip.pos(mid_time)

                        # Ensure position is a flat tuple, not a nested tuple
                        if isinstance(mid_pos, tuple) and len(mid_pos) > 0 and isinstance(mid_pos[0], tuple):
                            # If the position is a nested tuple, flatten it
                            mid_pos = mid_pos[0]
                            logger.debug(f"Flattened nested position tuple in main clip {idx}")

                        base_clip = base_clip.set_position(mid_pos)
                        logger.debug(f"Fixed callable position in main clip {idx}")
                    except Exception as e:
                        logger.warning(f"Failed to fix callable position in main clip: {e}")
                        base_clip = base_clip.set_position('center')

                # Fix size if needed
                if has_callable_size:
                    try:
                        mid_time = base_clip.duration / 2
                        mid_size = base_clip.size(mid_time)
                        base_clip = base_clip.resize(mid_size)
                        logger.debug(f"Fixed callable size in main clip {idx}")
                    except Exception as e:
                        logger.warning(f"Failed to fix callable size in main clip: {e}")

                modified_clip = base_clip
            except Exception as e:
                logger.warning(f"Error while fixing main clip attributes: {e}")
                modified_clip = None

        # If we need cleaning but couldn't create a modified clip, just use the original
        if needs_cleaning and modified_clip is None:
            logger.warning(f"Using original clip for {idx} despite cleaning being needed")
            modified_clip = clip
        elif not needs_cleaning:
            # No cleaning needed, use original clip
            logger.info(f"No attribute fixing needed for clip {idx}, but still pre-rendering")
            modified_clip = clip

        # Render to file
        logger.info(f"Pre-rendering clip {idx} to {temp_path}")

        # Use direct FFmpeg when possible for faster rendering
        try:
            # Try with hardware acceleration first if available
            hw_accel = ""
            try:
                # Check for NVIDIA GPU
                nvidia_check = subprocess.run(
                    ["nvidia-smi"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False
                )
                if nvidia_check.returncode == 0:
                    hw_accel = "h264_nvenc"
                    logger.info("Using NVIDIA GPU acceleration for pre-rendering")
            except:
                pass

            # Use optimized settings for temporary files
            codec = hw_accel if hw_accel else "libx264"
            preset = "fast" if hw_accel else "ultrafast"  # Fastest preset for temp files

            modified_clip.write_videofile(
                temp_path,
                fps=fps,
                preset=preset,
                codec=codec,
                audio_codec="aac",
                threads=4,
                ffmpeg_params=[
                    "-crf", "28",        # Lower quality for temp files is fine
                    "-bufsize", "12M",   # Buffer size
                    "-pix_fmt", "yuv420p", # Compatible format
                    "-progress", "pipe:1" # Show progress
                ],
                logger="bar"
            )

        except Exception as e:
            logger.warning(f"Error with optimized rendering, falling back to basic: {e}")
            # Fall back to basic rendering
            modified_clip.write_videofile(
                temp_path,
                fps=fps,
                preset="ultrafast",  # Use fastest preset for temp files
                codec="libx264",
                audio_codec="aac",
                threads=2,
                ffmpeg_params=["-crf", "28"],  # Lower quality for temp files is fine
                logger="bar"
            )

        logger.info(f"Successfully pre-rendered clip {idx} to {temp_path}")

        # Close the modified clip to free memory
        try:
            # Close the modified clip if it's different from the original
            if modified_clip is not clip:
                modified_clip.close()

            # If original clip has an audio attribute, close it
            if hasattr(clip, 'audio') and clip.audio is not None:
                try:
                    clip.audio.close()
                except:
                    pass
        except Exception as e:
            logger.debug(f"Error closing clip: {e}")

        return temp_path

    except Exception as e:
        logger.error(f"Error pre-rendering clip {idx}: {e}")
        # Clean up temp file if it exists but is incomplete
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass
        return None

# Central function for processing clips that avoids lambdas
def process_clip_for_parallel(task):
    """
    Process a clip for parallel rendering

    This function works with both old-style (7-parameter) and new-style (>3-parameter) tasks
    for backward compatibility.

    Args:
        task: Tuple containing task parameters

    Returns:
        Path to the rendered clip, or None if rendering failed
    """
    try:
        # Handle both old-style and new-style task parameters
        if len(task) >= 7:  # Old style (clip, output_path, fps, preset, threads, idx, is_prerendered)
            clip, output_path, fps_val, preset_val, threads_val, idx, is_prerendered = task
            logger.info(f"Starting render of clip {idx} to {output_path}")

            # If clip is already pre-rendered, just load and render it
            if is_prerendered:
                try:
                    if isinstance(clip, str) and os.path.exists(clip):
                        pre_clip = VideoFileClip(clip)
                        result = render_clip_segment(pre_clip, output_path, fps_val, preset_val, threads_val)
                        try:
                            pre_clip.close()
                        except:
                            pass
                        return result
                except Exception as e:
                    logger.error(f"Error loading pre-rendered clip: {e}")
                    return None

            # For normal clips, render directly
            return render_clip_segment(clip, output_path, fps_val, preset_val, threads_val)

        elif len(task) >= 4:  # New style (task_idx, clip, output_path, fps, [results])
            task_idx, clip, output_path, fps = task[:4]
            results_list = task[4] if len(task) > 4 else None

            logger.info(f"Starting render of clip {task_idx} to {output_path}")

            # Handle pre-rendered clips
            if isinstance(clip, str) and os.path.exists(clip):
                try:
                    clip = VideoFileClip(clip)
                except Exception as e:
                    logger.error(f"Error loading pre-rendered clip: {e}")
                    if results_list is not None:
                        results_list[task_idx] = None
                    return None

            # Render the clip
            try:
                result = render_clip_segment(clip, output_path, fps, "veryfast", 2)

                # If we have a results list, update it
                if results_list is not None:
                    results_list[task_idx] = result

                return result
            except Exception as e:
                logger.error(f"Error rendering clip: {e}")
                if results_list is not None:
                    results_list[task_idx] = None
                return None
        else:
            logger.error(f"Invalid task format: {task}")
            return None

    except Exception as e:
        logger.error(f"Error in parallel rendering task: {e}")
        return None

# Helper function to create fixed static clip versions
def create_static_clip_version(clip):
    """Create a static version of a clip with all dynamic attributes converted to static"""
    # If already a string path, return as is
    if isinstance(clip, str):
        return clip, True

    # Fix positions if needed
    if hasattr(clip, 'pos') and callable(clip.pos):
        try:
            mid_pos = clip.pos(clip.duration / 2)
            clip = clip.set_position(mid_pos)
        except:
            clip = clip.set_position('center')

    # Fix sizes if needed
    if hasattr(clip, 'size') and callable(clip.size):
        try:
            mid_size = clip.size(clip.duration / 2)
            clip = clip.resize(mid_size)
        except:
            pass

    # Return the fixed clip
    return clip, False

def is_complex_clip(clip):
    """
    Determine if a clip is complex and needs pre-rendering to avoid serialization issues.

    Args:
        clip: The clip to check

    Returns:
        bool: True if the clip is complex and needs pre-rendering, False otherwise
    """
    # Check if it's already a file path (string)
    if isinstance(clip, str):
        return False

    # Check for callable position attribute
    if hasattr(clip, 'pos') and callable(clip.pos):
        return True

    # Check for callable size attribute
    if hasattr(clip, 'size') and callable(clip.size):
        return True

    # Check if it's a composite clip with subclips
    if isinstance(clip, CompositeVideoClip) and hasattr(clip, 'clips') and clip.clips:
        # Check each subclip for complexity
        for subclip in clip.clips:
            if hasattr(subclip, 'pos') and callable(subclip.pos):
                return True
            if hasattr(subclip, 'size') and callable(subclip.size):
                return True

    # Check for custom attributes that might cause serialization issues
    # This includes checking for lambda functions or other non-serializable objects
    for attr_name in dir(clip):
        try:
            # Skip magic methods and private attributes
            if attr_name.startswith('__') or attr_name.startswith('_'):
                continue

            # Get the attribute
            attr = getattr(clip, attr_name)

            # Check if it's a callable (function or method)
            if callable(attr) and not hasattr(attr, '__self__'):  # Exclude bound methods
                # This is a potential serialization issue
                return True
        except:
            # If we can't access an attribute, it might be problematic
            pass

    return False

def render_clip_process(mp_tuple):
    """
    Process a single clip for parallel rendering

    Args:
        mp_tuple: Tuple of (idx, clip, output_dir, fps)

    Returns:
        Path to the rendered clip or None if rendering failed
    """
    # Ensure we use the correct storage client with proper credentials for this process
    reset_client()  # Clear any previous clients
    storage_client = get_storage_client()  # This will set up the correct service account

    idx, clip, output_dir, fps = mp_tuple
    output_path = None

    # If clip is already a path string (pre-rendered), just return it
    if isinstance(clip, str) and os.path.exists(clip):
        return clip

    # Generate a unique output path
    output_path = os.path.join(output_dir, f"clip_{idx}_{int(time.time() * 1000)}.mp4")

    try:
        # Ensure the clip is valid
        if clip is None:
            logging.error(f"Clip {idx} is None, skipping")
            return None

        # If this is a path to a file that doesn't exist, return None
        if isinstance(clip, str) and not os.path.exists(clip):
            logging.error(f"Clip path {clip} does not exist, skipping")
            return None

        # Fix any potential position issues before rendering
        if hasattr(clip, 'pos') and callable(clip.pos):
            try:
                # Sample position at middle of clip
                mid_time = clip.duration / 2
                mid_pos = clip.pos(mid_time)

                # Handle nested tuples
                if isinstance(mid_pos, tuple) and len(mid_pos) > 0 and isinstance(mid_pos[0], tuple):
                    mid_pos = mid_pos[0]
                    logging.debug(f"Flattened nested position tuple in clip {idx}")

                clip = clip.set_position(mid_pos)
                logging.debug(f"Fixed callable position in clip {idx}")
            except Exception as e:
                logging.warning(f"Error fixing position in clip {idx}: {e}")
                # Set a safe default position
                try:
                    clip = clip.set_position('center')
                except:
                    pass

        if hasattr(clip, 'write_videofile'):
            try:
                # Verify clip can actually render a frame
                test_frame = clip.get_frame(0)
                if test_frame is None:
                    logging.error(f"Clip {idx} cannot render frames, skipping")
                    return None
            except Exception as e:
                logging.error(f"Clip {idx} failed frame test: {e}")
                return None

            # Try to use hardware acceleration if available
            hw_accel = ""
            try:
                # Check for NVIDIA GPU
                nvidia_check = subprocess.run(
                    ["nvidia-smi"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False
                )
                if nvidia_check.returncode == 0:
                    hw_accel = "h264_nvenc"
                    logging.info(f"Using NVIDIA GPU acceleration for clip {idx}")
            except:
                pass

            # Use optimized settings for intermediate files
            codec = hw_accel if hw_accel else "libx264"
            preset = "fast" if hw_accel else "ultrafast"  # Fastest preset for temp files
            audio_codec = "aac"

            # Use a lower quality for intermediate clips to improve speed
            clip.write_videofile(
                output_path,
                fps=fps,
                preset=preset,
                codec=codec,
                audio_codec=audio_codec,
                threads=2,  # Lower thread count to avoid system overload
                ffmpeg_params=[
                    "-crf", "28",        # Lower quality for temp files is fine
                    "-bufsize", "12M",   # Buffer size
                    "-pix_fmt", "yuv420p" # Compatible format
                ],
                logger=None  # Disable internal progress bars
            )

            # Explicitly close the clip to free memory
            try:
                # Close main clip
                if hasattr(clip, 'close'):
                    clip.close()

                # If clip has audio, make sure to close it
                if hasattr(clip, 'audio') and clip.audio is not None:
                    try:
                        clip.audio.close()
                    except:
                        pass

                # If it's a composite clip, close subclips
                if isinstance(clip, CompositeVideoClip) and hasattr(clip, 'clips'):
                    for subclip in clip.clips:
                        try:
                            if hasattr(subclip, 'close'):
                                subclip.close()
                            # Close audio of subclips too
                            if hasattr(subclip, 'audio') and subclip.audio is not None:
                                subclip.audio.close()
                        except:
                            pass
            except Exception as e:
                logging.debug(f"Error closing clip {idx}: {e}")

            # Force garbage collection
            gc.collect()

            return output_path
        else:
            logging.error(f"Clip {idx} doesn't have write_videofile method, skipping")
            return None

    except Exception as e:
        logging.error(f"Error rendering clip {idx}: {str(e)}")

        # Try to close the clip even if rendering failed, with comprehensive cleanup
        try:
            if hasattr(clip, 'close'):
                clip.close()

            # Also try to clean up audio
            if hasattr(clip, 'audio') and clip.audio is not None:
                try:
                    clip.audio.close()
                except:
                    pass

            # If it's a composite clip, close all subclips
            if isinstance(clip, CompositeVideoClip) and hasattr(clip, 'clips'):
                for subclip in clip.clips:
                    try:
                        if hasattr(subclip, 'close'):
                            subclip.close()
                        if hasattr(subclip, 'audio') and subclip.audio is not None:
                            subclip.audio.close()
                    except:
                        pass
        except:
            pass

        # Force garbage collection
        gc.collect()

        # If the output file was created but is invalid, remove it
        if output_path and os.path.exists(output_path):
            try:
                os.remove(output_path)
                logging.debug(f"Removed incomplete output file: {output_path}")
            except:
                pass

        return None

def render_clips_in_parallel(clips, output_file, fps=30, num_processes=None, logger=None, temp_dir=None, preset="ultrafast", codec="libx264", audio_codec="aac"):
    """
    Render clips in parallel and concatenate them

    Args:
        clips: List of VideoClip objects to render in parallel
        output_file: Output file to write the final concatenated video
        fps: Frames per second for the output
        num_processes: Number of processes to use for parallel rendering
        logger: Logger object to use for logging
        temp_dir: Optional temporary directory path (if None, a new one will be created)
        preset: FFmpeg preset to use for encoding (default: "ultrafast")
        codec: Video codec to use (default: "libx264")
        audio_codec: Audio codec to use (default: "aac")

    Returns:
        Path to the output file
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    if num_processes is None:
        # Use fewer processes to reduce chance of memory issues
        num_processes = max(1, min(multiprocessing.cpu_count() - 1, 4))

    logger.info(f"Rendering {len(clips)} clips in parallel using {num_processes} processes with preset: {preset}")

    # Reset shutdown flag at start
    _shutdown_requested.clear()

    # Function to process rendering in a temp directory
    def process_in_temp_dir(temp_directory):
        # Initialize storage client with correct credentials before starting parallelization
        # This ensures the main process has the right credentials
        logger.info("Initializing storage client in main process")
        reset_client()
        storage_client = get_storage_client()

        # Store paths to rendered clips rather than clip objects to save memory
        processed_clips_paths = []
        temp_files_to_cleanup = set()

        try:
            # First step: Pre-render all complex clips
            logger.info("Pre-processing complex clips...")
            for idx, clip in enumerate(clips):
                # Check if shutdown requested
                if _shutdown_requested.is_set():
                    logger.warning("Shutdown requested during pre-processing, aborting")
                    raise KeyboardInterrupt("Shutdown requested")

                if is_complex_clip(clip):
                    logger.debug(f"Pre-rendering complex clip {idx}")
                    try:
                        # Pre-render complex clips
                        clip_path = prerender_complex_clip(clip, temp_directory, idx, fps)
                        if clip_path:
                            processed_clips_paths.append((idx, clip_path))
                            logger.info(f"Successfully pre-rendered complex clip {idx}")
                        else:
                            logger.warning(f"Failed to pre-render clip {idx}, skipping")

                        # Explicitly close original clip to free memory
                        try:
                            if hasattr(clip, 'close'):
                                clip.close()
                        except Exception as e:
                            logger.debug(f"Error closing clip {idx}: {e}")
                    except Exception as e:
                        logger.error(f"Error pre-rendering clip {idx}: {e}")
                else:
                    # For simple clips, add to process list
                    processed_clips_paths.append((idx, clip))

            # Store temp files for cleanup
            for _, clip_path in processed_clips_paths:
                if isinstance(clip_path, str):
                    temp_files_to_cleanup.add(clip_path)

            # Second step: Process all clips in parallel
            logger.info("Rendering clips in parallel...")
            mp_clips = []
            for idx, clip_or_path in processed_clips_paths:
                # If it's already a path (pre-rendered), use it directly
                if isinstance(clip_or_path, str) and os.path.exists(clip_or_path):
                    mp_clips.append((idx, clip_or_path, temp_directory, fps))
                else:
                    # Otherwise, it's a clip that needs rendering
                    mp_clips.append((idx, clip_or_path, temp_directory, fps))

            # Clear processed_clips_paths to free memory
            processed_clips_paths = []

            # Set up a multiprocessing pool with maxtasksperchild to prevent memory leaks
            rendered_paths = []

            # Use get_context to ensure proper process creation on all platforms
            mp_context = multiprocessing.get_context('spawn')

            # Use a smaller chunksize to allow more frequent exit checks
            with mp_context.Pool(processes=num_processes, maxtasksperchild=2) as pool:
                try:
                    # Process clips in parallel with progress tracking
                    for result in tqdm(pool.imap_unordered(render_clip_process, mp_clips, chunksize=1),
                                    total=len(mp_clips),
                                    desc="Rendering clips in parallel"):
                        # Check for shutdown signal
                        if _shutdown_requested.is_set():
                            logger.warning("Shutdown requested during parallel rendering, aborting")
                            pool.terminate()
                            pool.join()
                            raise KeyboardInterrupt("Rendering aborted")

                        if result is not None:
                            rendered_paths.append(result)
                            logger.debug(f"Clip rendered: {result}")

                        # Force garbage collection periodically
                        if len(rendered_paths) % 3 == 0:
                            gc.collect()
                except KeyboardInterrupt:
                    logger.warning("KeyboardInterrupt received, terminating pool")
                    pool.terminate()
                    pool.join()
                    raise

            # Add rendered paths to cleanup list
            temp_files_to_cleanup.update(rendered_paths)

            # Validate all clips before concatenation
            valid_paths = []
            for path in rendered_paths:
                try:
                    # Try to open the video file to verify it's valid
                    with VideoFileClip(path) as test_clip:
                        if test_clip.duration > 0:
                            valid_paths.append(path)
                        else:
                            logger.warning(f"Skipping clip with zero duration: {path}")
                except Exception as e:
                    logger.warning(f"Skipping invalid clip {path}: {e}")

            if not valid_paths:
                raise ValueError("No valid clips available for concatenation")

            # Map paths back to original indices based on their filenames
            indexed_paths = []
            for path in valid_paths:
                # Extract index from filename (format is clip_{idx}_{timestamp}.mp4)
                try:
                    basename = os.path.basename(path)
                    if basename.startswith("clip_"):
                        # Extract the index between "clip_" and "_"
                        idx_part = basename.split("_")[1]
                        idx = int(idx_part)
                        indexed_paths.append((idx, path))
                    else:
                        # If not in expected format, use a high index to ensure it's at the end
                        logger.warning(f"Clip filename doesn't match expected format: {basename}")
                        indexed_paths.append((9999, path))
                except Exception as e:
                    logger.warning(f"Error extracting index from filename {path}: {e}")
                    # Use a high index to ensure it's at the end
                    indexed_paths.append((9999, path))
            
            # Sort by the original indices to preserve order
            indexed_paths.sort(key=lambda x: x[0])
            logger.info("Clip order after sorting:")
            for idx, path in indexed_paths:
                logger.info(f"  Index {idx}: {os.path.basename(path)}")
                
            # Get just the paths back in the correct order
            sorted_paths = [path for _, path in indexed_paths]
            
            # Continue with concatenation using the sorted paths
            logger.info("Concatenating clips using FFmpeg with preserved original order...")

            # Create a temporary file list for FFmpeg
            concat_list_path = os.path.join(temp_directory, "concat_list.txt")
            with open(concat_list_path, "w") as f:
                for clip_path in sorted_paths:
                    # Format according to FFmpeg concat protocol
                    f.write(f"file '{os.path.abspath(clip_path)}'\n")

            # Detect hardware acceleration capability
            hw_accel = ""
            try:
                # Check for NVIDIA GPU
                nvidia_check = subprocess.run(
                    ["nvidia-smi"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False
                )
                if nvidia_check.returncode == 0:
                    hw_accel = "h264_nvenc"
                    logger.info("Using NVIDIA GPU acceleration for final render")
            except Exception as e:
                logger.debug(f"Hardware acceleration check failed: {e}")

            # Set codec and parameters
            final_codec = hw_accel if hw_accel else codec
            final_preset = "fast" if hw_accel else preset  # Use the provided preset (now defaults to veryfast)

            # Build the FFmpeg command - simplified for stability
            ffmpeg_cmd = [
                "ffmpeg", "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", concat_list_path,
                "-c:v", final_codec,
                "-preset", final_preset,
                "-crf", "23",  # Higher quality for final output
                "-pix_fmt", "yuv420p",
                "-max_muxing_queue_size", "9999",  # Prevent muxing queue issues
                "-c:a", audio_codec,
                "-b:a", "192k",
                output_file
            ]

            logger.info(f"Running FFmpeg concatenation: {' '.join(ffmpeg_cmd)}")

            # Run FFmpeg directly without progress monitoring to avoid deadlocks
            process = subprocess.run(
                ffmpeg_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
                text=True
            )

            if process.returncode != 0:
                logger.error(f"FFmpeg concatenation failed with return code {process.returncode}: {process.stderr}")
                raise Exception(f"FFmpeg concatenation failed: {process.stderr[:500]}...")

            logger.info(f"Successfully concatenated clips to {output_file}")
            return output_file

        finally:
            # Clean up all temporary files
            for temp_file in temp_files_to_cleanup:
                try:
                    if os.path.exists(temp_file):
                        # Wait for any potential file locks to clear
                        for _ in range(3):  # Try 3 times
                            try:
                                os.remove(temp_file)
                                break
                            except PermissionError:
                                time.sleep(0.5)  # Wait before retrying
                            except:
                                break
                except Exception as e:
                    logger.debug(f"Could not remove temp file {temp_file}: {e}")

    # Use provided temp_dir or create a new one
    if temp_dir:
        # Use provided directory
        return process_in_temp_dir(temp_dir)
    else:
        # Create and use temporary directory
        with tempfile.TemporaryDirectory() as temp_dir:
            return process_in_temp_dir(temp_dir)

class ParallelRenderer:
    def __init__(self, fps, video_maker, custom_maker, image_maker):
        self.fps = fps
        self.video_maker = video_maker
        self.custom_maker = custom_maker
        self.image_maker = image_maker

    def render_clip(self, clip_info, output_path=None, max_duration=None, progress_callback=None):
        """
        Render an individual clip

        Args:
            clip_info (dict): Clip information dictionary
            output_path (str): Optional output path
            max_duration (float): Maximum duration in seconds
            progress_callback (callable): Optional callback for progress updates
        
        Returns:
            tuple: (clip_id, video_clip)
        """
        clip_id = clip_info.get('id', str(uuid.uuid4()))
        clip_index = clip_info.get('index', 0)
        logger.info(f"Rendering clip {clip_id} (index {clip_index})")
        logger.debug(f"Clip info: {clip_info}")
        
        # Different makers for different clip types
        clip_type = clip_info.get('type', 'image')
        
        try:
            # Track start time for performance monitoring
            start_time = time.time()
            
            if clip_type == 'video':
                maker = self.video_maker
                video_clip = maker.create_video_clip(clip_info, progress_callback=progress_callback)
            elif clip_type == 'custom':
                maker = self.custom_maker
                video_clip = maker.create_video_clip(clip_info, progress_callback=progress_callback)
            else:  # Default to image
                maker = self.image_maker
                video_clip = maker.create_video_clip(clip_info, progress_callback=progress_callback)
            
            # Apply max duration constraint if specified
            if max_duration is not None and video_clip.duration > max_duration:
                logger.warning(f"Clip {clip_id} exceeds max duration ({video_clip.duration:.2f}s > {max_duration:.2f}s), trimming")
                video_clip = video_clip.subclip(0, max_duration)
                
            # Log clip properties
            render_time = time.time() - start_time
            logger.info(f"Rendered clip {clip_id} - duration: {video_clip.duration:.2f}s, render time: {render_time:.2f}s")
            
            # Save individual clip if output_path specified
            if output_path:
                clip_output = f"{os.path.splitext(output_path)[0]}_{clip_id}.mp4"
                logger.info(f"Saving individual clip to {clip_output}")
                video_clip.write_videofile(
                    clip_output,
                    codec='libx264',
                    audio_codec='aac',
                    fps=self.fps
                )
                
            return (clip_id, clip_index, video_clip)
        except Exception as e:
            logger.error(f"Error rendering clip {clip_id}: {str(e)}")
            import traceback
            logger.error(f"Clip render error traceback: {traceback.format_exc()}")
            # Re-raise the exception for handling by the caller
            raise

    def render_to_file(self, clips, output_path, max_duration=None, concat_method='chain', progress_callback=None):
        """
        Render multiple clips to a single output file

        Args:
            clips (list): List of clip info dictionaries
            output_path (str): Path to output file
            max_duration (float): Maximum duration in seconds
            concat_method (str): Method to use for concatenation - 'chain' or 'compose'
            progress_callback (callable): Optional callback for progress updates
        
        Returns:
            str: Path to rendered file
        """
        if not clips:
            logger.error("No clips provided for rendering")
            raise ValueError("No clips provided for rendering")
            
        logger.info(f"Rendering {len(clips)} clips to {output_path}")
        logger.info(f"Maximum duration: {max_duration if max_duration is not None else 'unlimited'}")
        logger.info(f"Concatenation method: {concat_method}")
        
        start_time = time.time()
        results = []
        
        # Validate all clips before starting
        for i, clip in enumerate(clips):
            if not isinstance(clip, dict):
                logger.error(f"Invalid clip at index {i}: not a dictionary")
                raise ValueError(f"Invalid clip at index {i}: not a dictionary")
            
            # Ensure all clips have an index field
            if 'index' not in clip:
                clip['index'] = i
                logger.info(f"Adding index {i} to clip {clip.get('id', 'unknown')}")
        
        # Render clips (sequentially for now)
        for i, clip_info in enumerate(clips):
            if progress_callback:
                # Notify overall progress
                overall_progress = (i / len(clips)) * 100
                progress_callback(overall_progress, f"Rendering clip {i+1}/{len(clips)}")
                
            try:
                clip_result = self.render_clip(
                    clip_info, 
                    max_duration=max_duration,
                    progress_callback=progress_callback
                )
                results.append(clip_result)
            except Exception as e:
                logger.error(f"Failed to render clip at index {i}: {str(e)}")
                # Continue with other clips rather than failing the entire render
                continue
                
        if not results:
            logger.error("All clips failed to render")
            raise RuntimeError("All clips failed to render")
            
        # Sort clips by original index to maintain correct order
        logger.info("Sorting clips by original index")
        results.sort(key=lambda x: x[1])
        result_clips = [result[2] for result in results]
        
        # Log all clip durations for debugging
        for i, (clip_id, clip_index, clip) in enumerate(results):
            logger.info(f"Clip {i}: id={clip_id}, index={clip_index}, duration={clip.duration:.2f}s")
            
        # Concatenate clips
        logger.info(f"Concatenating {len(result_clips)} clips using {concat_method} method")
        if concat_method == 'compose':
            # CompositeVideoClip puts all clips on separate tracks
            final_clip = mp.CompositeVideoClip(result_clips)
        else:
            # Default to chain (concatenate end-to-end)
            final_clip = mp.concatenate_videoclips(result_clips)
            
        total_duration = final_clip.duration
        logger.info(f"Total concatenated duration: {total_duration:.2f}s")
        
        # Apply overall max duration if specified
        if max_duration is not None and final_clip.duration > max_duration:
            logger.warning(f"Final video exceeds max duration ({total_duration:.2f}s > {max_duration:.2f}s), trimming")
            final_clip = final_clip.subclip(0, max_duration)
            logger.info(f"New duration after trimming: {final_clip.duration:.2f}s")
        
        # Write final output
        logger.info(f"Writing final video to {output_path}")
        if progress_callback:
            progress_callback(95, "Writing final video file")
            
        try:
            final_clip.write_videofile(
                output_path,
                codec='libx264', 
                audio_codec='aac',
                fps=self.fps
            )
        except Exception as e:
            logger.error(f"Error writing final video file: {str(e)}")
            import traceback
            logger.error(f"Video writing error traceback: {traceback.format_exc()}")
            raise
            
        render_time = time.time() - start_time
        logger.info(f"Video rendering complete - duration: {final_clip.duration:.2f}s, render time: {render_time:.2f}s")
        
        if progress_callback:
            progress_callback(100, "Rendering complete")
            
        return output_path
