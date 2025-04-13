import os
import time
import random
import logging
import tempfile
import shutil
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
                            custom_background_path=None):
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

        Returns:
            str: Path to the output video
        """
        try:
            logger.info(f"Creating custom YouTube short with background_type={background_type}, "
                      f"background_source={background_source}")

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
                    # Just use the custom path directly - preprocessing happens in the video_creator
                else:
                    # For image custom backgrounds, we need to ensure it's properly formatted
                    logger.info(f"Using custom image background from: {custom_background_path}")
                    # Just use the custom path directly - preprocessing happens in the image_creator

            # Check if processing should be aborted
            if should_abort_processing():
                logger.info("Shutdown requested, aborting YouTube short creation before rendering")
                return None

            # Create the appropriate creator based on background type
            if background_type == "image":
                logger.info("Creating YouTube Short with image background")

                # For images with fallback to Unsplash when HuggingFace fails
                video_path = self.image_creator.create_youtube_short(
                    title=title,
                    script_sections=script_sections,
                    background_query=background_query if not background_queries else background_queries[0],
                    output_filename=output_filename,
                    add_captions=add_captions,
                    style=style,
                    voice_style=voice_style,
                    max_duration=max_duration,
                    background_queries=background_queries,
                    blur_background=blur_background,
                    edge_blur=edge_blur,
                    custom_background_path=custom_background_path if background_source == "custom" else None
                )
            else:
                logger.info("Creating YouTube Short with video background")

                video_path = self.video_creator.create_youtube_short(
                    title=title,
                    script_sections=script_sections,
                    background_query=background_query if not background_queries else background_queries[0],
                    output_filename=output_filename,
                    add_captions=add_captions,
                    style="video",  # Style is always "video" for video creator
                    voice_style=voice_style,
                    max_duration=max_duration,
                    background_queries=background_queries,
                    blur_background=blur_background,
                    edge_blur=edge_blur,
                    custom_background_path=custom_background_path if background_source == "custom" else None
                )

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
