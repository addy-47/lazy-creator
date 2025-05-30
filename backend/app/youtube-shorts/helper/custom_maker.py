import os
import logging
import time
import shutil
import numpy as np
import concurrent.futures
from typing import Dict, List, Any, Optional, Union
from moviepy import VideoFileClip, ImageClip, ColorClip, CompositeVideoClip
from helper.process import _process_background_clip, measure_time
from helper.memory import optimize_workers_for_rendering

logger = logging.getLogger(__name__)

class CustomBackgroundHandler:
    """
    Handler for custom background processing in video generation
    Supports both image and video custom backgrounds with parallel processing
    """
    
    def __init__(self, resolution=(1080, 1920), fps=30):
        self.resolution = resolution
        self.fps = fps
        # Get optimal worker configuration based on system resources
        self.resource_config = optimize_workers_for_rendering(memory_per_task_gb=1.0)
        
    @measure_time
    def prepare_custom_background(self, 
                                 custom_background_path: str, 
                                 script_sections: List[Dict], 
                                 blur_background: bool = False,
                                 edge_blur: bool = False) -> List[Any]:
        """
        Process a custom background for use with script sections
        Uses parallel processing for efficiency
        
        Args:
            custom_background_path: Path to the custom background file (image or video)
            script_sections: List of script section dictionaries with duration
            blur_background: Whether to apply blur effect
            edge_blur: Whether to apply edge blur effect
            
        Returns:
            List of processed background clips
        """
        if not custom_background_path or not os.path.exists(custom_background_path):
            logger.warning(f"Custom background path does not exist: {custom_background_path}")
            return []
            
        logger.info(f"Using custom background from: {custom_background_path}")
        _, ext = os.path.splitext(custom_background_path)
        
        # Determine if this is an image or video background
        is_video = ext.lower() in ['.mp4', '.mov', '.avi', '.webm', '.mkv']
        is_image = ext.lower() in ['.jpg', '.jpeg', '.png', '.webp', '.gif']
        
        if not (is_video or is_image):
            logger.error(f"Unsupported file format for custom background: {ext}")
            return []
        
        # Create a list of durations for each section
        section_durations = [section.get('duration', 5) for section in script_sections]
        
        # Process based on file type
        if is_image:
            return self._process_image_background(custom_background_path, section_durations, blur_background, edge_blur)
        else:  # is_video
            return self._process_video_background(custom_background_path, section_durations, blur_background, edge_blur)
    
    @measure_time
    def _process_image_background(self, image_path: str, durations: List[float], 
                                 blur_background: bool, edge_blur: bool) -> List[Any]:
        """Process an image background for multiple durations in parallel"""
        try:
            # Prepare job info for parallel processing
            job_info = []
            for i, duration in enumerate(durations):
                job_info.append({
                    'image_path': image_path,
                    'duration': duration,
                    'section_idx': i
                })
            
            # Calculate optimal worker count based on system resources
            worker_count = self.resource_config.get('worker_count', 3)
            
            # Process in parallel
            logger.info(f"Processing {len(durations)} image background clips with {worker_count} workers")
            processed_clips = []
            
            with concurrent.futures.ThreadPoolExecutor(max_workers=worker_count) as executor:
                futures = []
                for job in job_info:
                    futures.append(executor.submit(
                        self._process_single_image_background,
                        job['image_path'],
                        job['duration'],
                        job['section_idx'],
                        blur_background,
                        edge_blur
                    ))
                
                for future in concurrent.futures.as_completed(futures):
                    try:
                        result = future.result()
                        if result:
                            processed_clips.append(result)
                    except Exception as e:
                        logger.error(f"Error processing image background: {e}")
            
            # Sort clips by section index to maintain order
            processed_clips.sort(key=lambda clip: getattr(clip, '_section_idx', 0))
            return processed_clips
            
        except Exception as e:
            logger.error(f"Error in _process_image_background: {e}")
            return []
    
    def _process_single_image_background(self, image_path: str, duration: float, 
                                       section_idx: int, blur_background: bool, 
                                       edge_blur: bool) -> Any:
        """Process a single image background for a specific duration"""
        try:
            # Create an ImageClip with the specified duration
            clip = ImageClip(image_path).with_duration(duration)
            # Add section index for sorting later
            clip._section_idx = section_idx
            clip._debug_info = f"Image section {section_idx}"
            
            # Process using the same function used for video clips
            return _process_background_clip(clip, duration, blur_background, edge_blur)
            
        except Exception as e:
            logger.error(f"Error processing single image background for section {section_idx}: {e}")
            return None
    
    @measure_time
    def _process_video_background(self, video_path: str, durations: List[float], 
                                 blur_background: bool, edge_blur: bool) -> List[Any]:
        """Process a video background for multiple durations in parallel"""
        try:
            # Load the video clip once
            with VideoFileClip(video_path) as source_clip:
                # Prepare job info for parallel processing
                video_info = []
                
                # Calculate start times to use different segments of the video if long enough
                total_video_duration = source_clip.duration
                
                for i, duration in enumerate(durations):
                    # If video is long enough, use different segments for variety
                    if total_video_duration > sum(durations) * 1.5:
                        start_time = min(i * (total_video_duration / len(durations)), 
                                         total_video_duration - duration - 1)
                    else:
                        # Otherwise start from beginning for each clip
                        start_time = 0
                    
                    # Create a subclip for each section
                    subclip = source_clip.subclip(start_time, min(start_time + duration + 0.5, total_video_duration))
                    
                    # Store clip info for processing
                    video_info.append({
                        'clip': subclip,
                        'target_duration': duration,
                        'section_idx': i
                    })
                
                # Process clips in parallel
                worker_count = self.resource_config.get('worker_count', 3)
                logger.info(f"Processing {len(durations)} video clips with {worker_count} workers")
                
                processed_clips = []
                with concurrent.futures.ThreadPoolExecutor(max_workers=worker_count) as executor:
                    futures = []
                    for info in video_info:
                        futures.append(executor.submit(
                            self._process_single_video_clip,
                            info['clip'],
                            info['target_duration'],
                            info['section_idx'],
                            blur_background,
                            edge_blur
                        ))
                    
                    for future in concurrent.futures.as_completed(futures):
                        try:
                            result = future.result()
                            if result:
                                processed_clips.append(result)
                        except Exception as e:
                            logger.error(f"Error processing video background: {e}")
                
                # Sort clips by section index
                processed_clips.sort(key=lambda clip: getattr(clip, '_section_idx', 0))
                return processed_clips
                
        except Exception as e:
            logger.error(f"Error in _process_video_background: {e}")
            return []
    
    def _process_single_video_clip(self, clip, duration: float, section_idx: int,
                                 blur_background: bool, edge_blur: bool) -> Any:
        """Process a single video clip for a specific duration"""
        try:
            # Add section index for sorting later
            clip._section_idx = section_idx
            clip._debug_info = f"Video section {section_idx}"
            
            # Process clip using shared function
            return _process_background_clip(clip, duration, blur_background, edge_blur)
            
        except Exception as e:
            logger.error(f"Error processing single video clip for section {section_idx}: {e}")
            return None

# Standalone function for in-memory copy of a custom background file
# Helpful for performance optimization with GCS
def copy_custom_background_to_memory(file_path: str) -> Optional[str]:
    """
    Copy a custom background file to memory (RAM) using a temporary file.
    Can significantly improve performance when working with GCS.
    
    Args:
        file_path: Path to the original file
        
    Returns:
        Path to the in-memory copy or None if failed
    """
    import tempfile
    
    try:
        if not file_path or not os.path.exists(file_path):
            logger.warning(f"No file to copy: {file_path}")
            return None
        
        # Get file size to check if it's reasonable to store in memory
        file_size = os.path.getsize(file_path)
        file_size_mb = file_size / (1024 * 1024)
        
        # Skip very large files (>100MB) to avoid memory issues
        if file_size_mb > 100:
            logger.warning(f"File too large for in-memory copy: {file_size_mb:.2f}MB")
            return file_path
        
        # Create temporary file in memory
        _, ext = os.path.splitext(file_path)
        temp_file = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
        temp_file_path = temp_file.name
        
        # Copy file content
        with open(file_path, 'rb') as src_file:
            shutil.copyfileobj(src_file, temp_file)
        
        temp_file.close()
        logger.info(f"Copied {file_size_mb:.2f}MB file to memory: {temp_file_path}")
        return temp_file_path
        
    except Exception as e:
        logger.error(f"Error copying file to memory: {e}")
        return file_path 