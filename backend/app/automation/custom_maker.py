import os
import time
import random
import logging
import tempfile
import shutil
import math
from pathlib import Path
from PIL import Image, ImageFilter
from moviepy.editor import (
    VideoFileClip, ImageClip, TextClip, CompositeVideoClip,
    AudioFileClip, concatenate_videoclips, ColorClip, CompositeAudioClip
)
from moviepy.config import change_settings
change_settings({"IMAGEMAGICK_BINARY": "magick"})  # for windows users

# Proper relative imports
from .image_maker import YTShortsCreator_I, measure_time
from .video_maker import YTShortsCreator_V
from .script_generator import generate_batch_image_prompts, generate_batch_video_queries
from .parallel_renderer import is_shutdown_requested

# Configure logging
logger = logging.getLogger(__name__)

# Helper function to check for shutdown
def should_abort_processing():
    """Check if processing should be aborted due to shutdown request"""
    return is_shutdown_requested()

class CustomShortsCreator:
    """
    Creates YouTube shorts with custom backgrounds, handling both image and video modes
    with fallback to Unsplash images when necessary
    """

    def __init__(self, output_dir="output", fps=30):
        """
        Initialize the Custom YouTube Shorts creator with necessary settings

        Args:
            output_dir (str): Directory to save the output videos
            fps (int): Frames per second for the output video
        """
        # Setup directories
        self.output_dir = output_dir
        self.temp_dir = tempfile.mkdtemp()  # Create temp directory for intermediate files
        os.makedirs(output_dir, exist_ok=True)
        os.makedirs(self.temp_dir, exist_ok=True)

        # Initialize the base creators
        self.image_creator = YTShortsCreator_I(output_dir=output_dir, fps=fps)
        self.video_creator = YTShortsCreator_V(output_dir=output_dir, fps=fps)

        # Video settings
        self.resolution = (1080, 1920)  # Portrait mode for shorts (width, height)
        self.fps = fps
        
        # Create background cache to avoid reprocessing identical backgrounds
        self.background_cache = {}

    @measure_time
    def create_youtube_short(self,
                            title,
                            script_sections,
                            background_query="abstract background",
                            output_filename=None,
                            add_captions=True,
                            style="photorealistic",
                            voice_style=None,
                            max_duration=25,
                            background_queries=None,
                            blur_background=False,
                            edge_blur=False,
                            background_type="video",  # "video" or "image"
                            background_source="provided",  # "provided", "custom", or "unsplash"
                            custom_background_path=None,
                            progress_callback=None):
        """
        Create a YouTube short using custom backgrounds

        Args:
            title (str): Title of the short
            script_sections (list): List of dictionaries with text and duration
            background_query (str): Query to search for background if needed
            output_filename (str): Filename for the output
            add_captions (bool): Whether to add captions
            style (str): Style for image generation
            voice_style (str): Style for TTS voice
            max_duration (int): Maximum duration in seconds
            background_queries (list): List of queries for each section
            blur_background (bool): Whether to blur the background
            edge_blur (bool): Whether to apply edge blur
            background_type (str): Type of background - "video" or "image"
            background_source (str): Source of background - "provided", "custom", or "unsplash"
            custom_background_path (str): Path to custom background file
            progress_callback (callable): Optional callback for reporting progress

        Returns:
            str: Path to the output video
        """
        try:
            logger.info(f"Creating custom YouTube short with background_type={background_type}, "
                      f"background_source={background_source}")

            # Enforce strict maximum duration
            logger.info(f"Enforcing maximum duration of {max_duration} seconds")
            
            # Calculate total duration of all sections
            total_duration = sum(section.get('duration', 5) for section in script_sections)
            logger.info(f"Initial total duration: {total_duration:.2f}s")
            
            # If total duration exceeds max_duration, scale all sections proportionally
            if total_duration > max_duration:
                logger.info(f"Total duration ({total_duration:.2f}s) exceeds max_duration ({max_duration}s), scaling sections")
                scale_factor = max_duration / total_duration
                for section in script_sections:
                    original_duration = section.get('duration', 5)
                    section['duration'] = original_duration * scale_factor
                
                # Verify scaling worked correctly
                new_total = sum(section.get('duration', 5) for section in script_sections)
                logger.info(f"After scaling: new total duration = {new_total:.2f}s (scale factor: {scale_factor:.3f})")

            # Set up a default progress callback if none provided
            if progress_callback is None:
                def update_progress(progress, message=""):
                    logger.info(f"Progress: {progress}%, {message}")
                progress_callback = update_progress
                
            # Initial progress report
            progress_callback(52, "Setting up rendering environment")

            # Check if processing should be aborted
            if should_abort_processing():
                logger.info("Shutdown requested, aborting YouTube short creation")
                return None

            # Safety check - if background source is custom but path is None, revert to "provided"
            if background_source == "custom" and not custom_background_path:
                logger.warning("Custom background requested but no path provided. Falling back to provided background.")
                background_source = "provided"

            # Generate section-specific queries if needed
            if not background_queries and script_sections:
                card_texts = [section['text'] for section in script_sections]

                # Use appropriate query generation based on background type
                if background_type == "video":
                    logger.info("Generating video search queries for each section using AI...")
                    batch_query_results = generate_batch_video_queries(
                        card_texts,
                        overall_topic=title
                    )
                else:  # image
                    logger.info("Generating image prompts for each section using AI...")
                    batch_query_results = generate_batch_image_prompts(
                        card_texts,
                        overall_topic=title
                    )

                # Extract queries in order, using a fallback if needed
                default_query = f"abstract {title}"
                background_queries = []
                for i in range(len(script_sections)):
                    query = batch_query_results.get(i, default_query)
                    if not query:  # Ensure query is not empty string
                        query = default_query
                        logger.warning(f"Query for section {i} was empty, using fallback: '{default_query}'")
                    background_queries.append(query)

            # Check if we need to use a custom background
            if background_source == "custom" and custom_background_path:
                # Preprocess the custom background based on its type
                if background_type == "video":
                    # For video custom backgrounds, create a preprocessed version
                    logger.info(f"Using custom video background from: {custom_background_path}")
                    progress_callback(54, "Processing custom video background")
                    # Just use the custom path directly - preprocessing happens in the video_creator
                else:
                    # For image custom backgrounds, we need to ensure it's properly formatted
                    logger.info(f"Using custom image background from: {custom_background_path}")
                    progress_callback(54, "Processing custom image background")
                    # Just use the custom path directly - preprocessing happens in the image_creator

            # Check if processing should be aborted
            if should_abort_processing():
                logger.info("Shutdown requested, aborting YouTube short creation before rendering")
                return None

            # Track the start time for periodic progress updates
            rendering_start_time = time.time()
            rendering_last_update = rendering_start_time
            
            # Estimated time distribution: 15% audio generation, 25% background processing, 60% video rendering
            
            # Create a progress tracker function to pass to the creators
            def track_rendering_progress(elapsed_seconds):
                nonlocal rendering_last_update
                nonlocal last_reported_progress  # Add this reference to the outer scope variable
                current_time = time.time()
                
                # Update progress more frequently (every 3 seconds) for a smoother experience
                if current_time - rendering_last_update >= 3:
                    # Calculate estimated progress based on elapsed time
                    # Use a curve that starts faster initially and gradually slows down
                    # Limit to 88% as final step will bring to 90%
                    estimated_total_seconds = 300  # Estimate 5 minutes total for rendering
                    
                    # More granular progress calculation with logarithmic scaling
                    # This gives a smoother increase at the beginning with a gentler slope later
                    progress_factor = min(1.0, elapsed_seconds / estimated_total_seconds)
                    # Use log curve to make progress feel more natural (faster at start, slower near end)
                    if progress_factor > 0:
                        curve_factor = 0.3 + (math.log(1 + 9 * progress_factor) / math.log(10))
                    else:
                        curve_factor = 0.3
                    
                    # Scale to our desired range (55-88%)
                    progress_pct = 55 + (curve_factor * 33)
                    
                    # Ensure progress doesn't decrease and increment by at least 1%
                    if int(progress_pct) > last_reported_progress:
                        last_reported_progress = int(progress_pct)
                        
                        if background_type == "video":
                            phase = "Rendering video sections"
                        else:
                            phase = "Compositing image sequence"
                            
                        progress_callback(last_reported_progress, phase)
                        rendering_last_update = current_time
                        logger.info(f"Rendering in progress - elapsed: {elapsed_seconds:.1f}s, progress: {last_reported_progress}%")
                    
            # Initialize a variable to track the last reported progress percentage
            last_reported_progress = 55

            # Report progress at start of rendering
            progress_callback(55, "Beginning media rendering")

            # Create the appropriate creator based on background type
            if background_type == "image":
                logger.info("Creating YouTube Short with image background")
                
                # Time-based progress tracking
                start_time = time.time()
                def image_progress_tracker(progress=None, message=None):
                    # Ignore the provided progress and message, use our time-based tracking instead
                    elapsed = time.time() - start_time
                    track_rendering_progress(elapsed)
                    return False  # Return False to continue rendering
                
                # For images with fallback to Unsplash when HuggingFace fails
                video_path = self.image_creator.create_youtube_short(
                    title=title,
                    script_sections=script_sections,
                    background_query=background_query if not background_queries else background_queries[0],
                    output_filename=output_filename,
                    add_captions=add_captions,
                    style=style,
                    voice_style=voice_style,
                    max_duration=max_duration,  # Pass max_duration to enforce limit
                    background_queries=background_queries,
                    blur_background=blur_background,
                    edge_blur=edge_blur,
                    custom_background_path=custom_background_path if background_source == "custom" else None,
                    progress_callback=image_progress_tracker
                )
            else:
                logger.info("Creating YouTube Short with video background")
                
                # Time-based progress tracking
                start_time = time.time()
                def video_progress_tracker(progress=None, message=None):
                    # Ignore the provided progress and message, use our time-based tracking instead
                    elapsed = time.time() - start_time
                    track_rendering_progress(elapsed)
                    return False  # Return False to continue rendering
                
                video_path = self.video_creator.create_youtube_short(
                    title=title,
                    script_sections=script_sections,
                    background_query=background_query if not background_queries else background_queries[0],
                    output_filename=output_filename,
                    add_captions=add_captions,
                    style="video",  # Style is always "video" for video creator
                    voice_style=voice_style,
                    max_duration=max_duration,  # Pass max_duration to enforce limit
                    background_queries=background_queries,
                    blur_background=blur_background,
                    edge_blur=edge_blur,
                    custom_background_path=custom_background_path if background_source == "custom" else None,
                    progress_callback=video_progress_tracker
                )

            if video_path:
                progress_callback(89, "Video rendering complete")
                
                # Verify final duration
                try:
                    with VideoFileClip(video_path) as clip:
                        actual_duration = clip.duration
                        logger.info(f"Final video duration: {actual_duration:.2f}s (target: {max_duration}s)")
                        if abs(actual_duration - max_duration) > 1:  # Allow 1 second tolerance
                            logger.warning(f"Warning: Final duration ({actual_duration:.2f}s) differs from max_duration ({max_duration}s)")
                except Exception as e:
                    logger.error(f"Could not verify final video duration: {e}")
                
            logger.info(f"YouTube Short created successfully: {video_path}")
            return video_path

        except Exception as e:
            logger.error(f"Error in create_youtube_short: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise

    def _cleanup(self):
        """Clean up temporary files and directories"""
        try:
            # Clean up temporary files
            if os.path.exists(self.temp_dir):
                shutil.rmtree(self.temp_dir)
                logger.info(f"Cleaned up temporary directory: {self.temp_dir}")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
