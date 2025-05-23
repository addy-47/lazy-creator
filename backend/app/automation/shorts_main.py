import os # for environment variables and file paths
from pathlib import Path # for file paths and directory creation
from dotenv import load_dotenv # for loading environment variables
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from app.logging_config import get_video_logger
from .script_generator import (
    generate_batch_video_queries,
    parse_script_to_cards,
    generate_comprehensive_content
)
from .video_maker import YTShortsCreator_V
from .image_maker import YTShortsCreator_I
from .custom_maker import CustomShortsCreator
from .youtube_upload import upload_video
from youtube_auth import get_authenticated_service
from nltk.corpus import stopwords
import datetime # for timestamp
import re # for regular expressions
import nltk # for natural language processing
from collections import Counter # for counting elements in a list
import requests # for making HTTP requests
import random # for generating random numbers
from typing import List, Dict, Optional
import tempfile
import sys
import shutil # for copying files
import threading
from .parallel_renderer import is_shutdown_requested
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from app.storage import cloud_storage
# Import our storage helper
from app.storage_helper import get_storage_client, reset_client
import time # for progress tracking

load_dotenv()
NEWS_API_KEY = os.getenv("NEWS_API_KEY")
YOUTUBE_TOPIC = os.getenv("YOUTUBE_TOPIC", "Artificial Intelligence")

# Get the video creation logger
logger = get_video_logger()

def get_latest_ai_news():
    """Get the latest technology or AI news."""
    if not NEWS_API_KEY:
        raise ValueError("NewsAPI key is missing. Set NEWS_API_KEY in .env.")

    # Calculate the date two weeks ago
    two_weeks_ago = datetime.datetime.now() - datetime.timedelta(weeks=2)
    # Format the date as YYYY-MM-DD for the News API
    from_date = two_weeks_ago.strftime("%Y-%m-%d")

    # Specify technology and AI focus with multiple topics
    topics = ["artificial intelligence", "technology", "tech innovation", "AI", "machine learning"]

    # Try each topic until we find a suitable article
    for topic in topics:
        url = f"https://newsapi.org/v2/top-headlines?q={topic}&category=technology&from={from_date}&sortBy=popularity&pageSize=10&apiKey={NEWS_API_KEY}"
        response = requests.get(url)

        if response.status_code == 200:
            articles = response.json().get('articles', [])
            if articles:
                chosen_article = random.choice(articles) # Choose a random article from top 10
                return chosen_article['title']


    # Fallback to a general technology search if no AI-specific news
    url = f"https://newsapi.org/v2/top-headlines?category=technology&apiKey={NEWS_API_KEY}"
    response = requests.get(url)

    if response.status_code == 200:
        articles = response.json().get('articles', [])
        if articles:
            chosen_article = random.choice(articles)
            return chosen_article['title']

    return "Latest Technology Innovation News"

# Add a helper function to check for shutdown
def should_abort_processing():
    """Check if processing should be aborted due to shutdown request"""
    return is_shutdown_requested()

def create_youtube_short(
    topic: str,
    output_dir: str = "output",
    output_filename: Optional[str] = None,
    max_duration: int = 25,
    background_source: str = "video",
    background_path: Optional[str] = None,
    background_style: str = "video"
) -> str:
    """
    Create a YouTube Short with either video or image backgrounds.

    Args:
        topic: The main topic for the video
        output_dir: Directory to save the output video
        output_filename: Optional custom filename for the output
        max_duration: Maximum duration of the video in seconds
        background_source: Source of background ('video', 'image', or 'custom')
        background_path: Path to custom background file if background_source is 'custom'
        background_style: Style of the background ('video' or 'image')

    Returns:
        str: Path to the created video file
    """
    try:
        # Safety check - if background source is custom but path is None, revert to "provided"
        if background_source == "custom" and not background_path:
            logger.warning("Custom background requested but no path provided in create_youtube_short. Falling back to provided background.")
            background_source = "provided"

        # Log the parameters for debugging
        logger.info(f"create_youtube_short called with: topic={topic}, background_source={background_source}, "
                   f"background_path={background_path}, background_style={background_style}")

        if not output_filename:
            output_filename = f"shorts_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4"

        logger.info(f"Generating script for topic: {topic}")

        # Generate unique filename with timestamp
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = os.path.join(output_dir, output_filename)

        # Script Generation
        if topic == "latest_ai_news":
            topic = get_latest_ai_news()
            logger.info(f"Generating script for topic: {topic}")

        # Get comprehensive content with proper max_duration parameter
        content_package = generate_comprehensive_content(topic, max_duration=max_duration)
        script = content_package['script']
        logger.info("Content package generated successfully")
        logger.info(f"Script length: {len(script.split())} words")

        script_cards = parse_script_to_cards(script, max_duration=max_duration)

        # Determine optimal section count based on duration
        num_sections = 3  # default for 15 seconds
        if max_duration >= 25:
            num_sections = 5  # 5 sections for longer videos
        elif max_duration >= 20:
            num_sections = 4  # 4 sections for medium videos

        logger.info(f"Using {num_sections} script sections for {max_duration}s duration")

        # Ensure we have the optimal number of script sections
        if len(script_cards) > num_sections:
            logger.info(f"Reducing script sections from {len(script_cards)} to {num_sections}")
            # Combine extra sections into the last section
            extra_sections = script_cards[num_sections-1:]
            combined_text = " ".join([card["text"] for card in extra_sections])
            script_cards = script_cards[:num_sections-1]
            script_cards.append({
                "text": combined_text,
                "duration": sum([card["duration"] for card in extra_sections])
            })
        elif len(script_cards) < num_sections:
            logger.info(f"Script has fewer sections ({len(script_cards)}) than optimal ({num_sections})")
            # We'll work with what we have - no need to artificially split

        logger.info(f"Final script has {len(script_cards)} sections")
        for i, card in enumerate(script_cards):
            logger.info(f"Section {i+1}: {card['text'][:30]}... (duration: {card['duration']}s)")

        logger.info("Generating video search queries for each section using AI...")

        # Generate section-specific queries using the LLM in a single batch call
        card_texts = [card['text'] for card in script_cards]
        batch_query_results = generate_batch_video_queries(card_texts, overall_topic=topic)

        # Extract queries in order, using a fallback if needed
        default_query = f"abstract {topic}"
        section_queries = []
        for i in range(len(script_cards)):
            query = batch_query_results.get(i, default_query) # Get query by index, fallback to default
            if not query: # Ensure query is not empty string
                 query = default_query
                 logger.warning(f"Query for section {i} was empty, using fallback: '{default_query}'")
            section_queries.append(query)
            logger.info(f"Section {i+1} query: {query}")

        # For simplicity, let's use the first section's query or the default as fallback
        fallback_query = section_queries[0] if section_queries else default_query

        # Video Creation
        logger.info("Creating YouTube Short")

        # Create the appropriate creator based on background style
        if background_style == "image":
            creator = YTShortsCreator_I(output_dir=output_dir)
            video_path = creator.create_youtube_short(
                title=topic,
                script_sections=script_cards,
                background_query=fallback_query,
                output_filename=output_filename,
                add_captions=False,
                style="ANIME",
                voice_style="default",
                max_duration=max_duration,
                background_queries=section_queries,
                blur_background=False,
                edge_blur=False,
                custom_background_path=background_path if background_source == "custom" else None
            )
        else:
            creator = YTShortsCreator_V(output_dir=output_dir)
            video_path = creator.create_youtube_short(
                title=topic,
                script_sections=script_cards,
                background_query=fallback_query,
                output_filename=output_filename,
                add_captions=False,
                style="video",
                voice_style="default",
                max_duration=max_duration,
                background_queries=section_queries,
                blur_background=False,
                edge_blur=False,
                custom_background_path=background_path if background_source == "custom" else None
            )

        return video_path

    except Exception as e:
        logger.error(f"Error generating YouTube Short: {e}")
        raise

def generate_youtube_short(topic, max_duration=25, background_type='video', background_source='provided', background_path=None, style="photorealistic", progress_callback=None):
    """
    Generate a YouTube short on a given topic

    Args:
        topic (str): The topic to create a short about
        max_duration (int): Maximum duration of the short in seconds
        background_type (str): Type of background (video or image)
        background_source (str): Source of background (provided, custom, unsplash)
        background_path (str): Path to custom background if provided
        style (str): Style for image generation
        progress_callback (callable): Optional callback for progress reporting

    Returns:
        tuple: (path to the generated video, comprehensive content package)
    """
    try:
        # Ensure we have the correct storage credentials
        reset_client()
        storage_client = get_storage_client()

        # Set up a default callback if none provided
        if progress_callback is None:
            def update_progress(progress, message=""):
                logger.info(f"Progress: {progress}%, {message}")
            progress_callback = update_progress
        else:
            # Modified to handle callbacks that accept only one parameter
            def update_progress(progress, message=""):
                try:
                    # Try calling with both parameters
                    progress_callback(progress, message)
                except TypeError:
                    # If that fails, assume the callback only takes the progress parameter
                    progress_callback(progress)
                logger.info(f"Progress: {progress}%, {message}")

        # Log the input parameters for debugging
        logger.info(f"=== STARTING VIDEO GENERATION ===")
        logger.info(f"Parameters: topic='{topic}', max_duration={max_duration}, "
                   f"background_type='{background_type}', background_source='{background_source}', "
                   f"background_path={background_path}, style='{style}'")

        # Initialize progress
        update_progress(5, "Starting video generation")

        # Check if processing should be aborted
        if should_abort_processing():
            logger.info("Shutdown requested, aborting video generation")
            return None, None

        # Generate unique filename with timestamp
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_topic = re.sub(r'[^a-zA-Z0-9]', '_', topic)[:30]
        output_filename = f"shorts_{safe_topic}_{timestamp}.mp4"
        logger.info(f"Output filename: {output_filename}")

        # Create temporary directory for processing
        temp_dir = tempfile.mkdtemp()
        logger.info(f"Created temporary directory: {temp_dir}")

        # Choose the appropriate creator based on background source and type
        if background_source == 'custom':
            # Only use CustomShortsCreator for custom backgrounds (user uploads)
            logger.info(f"Initializing CustomShortsCreator for custom background with output_dir={temp_dir}")
            creator = CustomShortsCreator(output_dir=temp_dir)
        elif background_type == 'video':
            # Use video creator for provided or unsplash video backgrounds
            logger.info(f"Initializing YTShortsCreator_V for video background with output_dir={temp_dir}")
            creator = YTShortsCreator_V(output_dir=temp_dir)
        else:
            # Use image creator for provided or unsplash image backgrounds
            logger.info(f"Initializing YTShortsCreator_I for image background with output_dir={temp_dir}")
            creator = YTShortsCreator_I(output_dir=temp_dir)

        # Handle latest AI news topic
        if topic == "latest_ai_news":
            logger.info("Retrieving latest AI news topic")
            topic = get_latest_ai_news()
            logger.info(f"Using latest AI news topic: {topic}")

        update_progress(10, "Generating content")

        # Check if processing should be aborted
        if should_abort_processing():
            logger.info("Shutdown requested, aborting video generation before content creation")
            return None, None

        # Use the comprehensive content generator to get a complete package
        logger.info(f"Generating comprehensive content for topic: '{topic}'")
        content_package = generate_comprehensive_content(topic, max_duration=max_duration)
        logger.info(f"Content package generated with title: '{content_package['title']}'")

        update_progress(20, "Content created, processing script")

        # Get the script from the content package
        script = content_package['script']
        logger.info(f"Generated script with {len(script.split())} words")
        logger.info(f"Script: {script[:200]}..." if len(script) > 200 else f"Script: {script}")

        # Parse script into cards
        logger.info("Parsing script into sections")
        script_cards = parse_script_to_cards(script)
        logger.info(f"Initial script parsed into {len(script_cards)} sections")

        # Calculate optimal number of backgrounds/sections based on duration
        # We want roughly 1 background per 5 seconds, always include intro and outro
        optimal_bg_count = max(3, int(max_duration / 5))  # Minimum of 3 (intro, middle, outro)
        logger.info(f"Calculated optimal background count: {optimal_bg_count} for {max_duration}s duration")

        update_progress(30, f"Planning video with {optimal_bg_count} sections")

        # Ensure we have exact number of sections to match backgrounds
        if len(script_cards) != optimal_bg_count:
            logger.info(f"Adjusting script sections from {len(script_cards)} to {optimal_bg_count} to match backgrounds")

            # Log original sections for debugging
            logger.info("Original script sections:")
            for i, card in enumerate(script_cards):
                logger.info(f"  Section {i+1}: {card['text'][:50]}... (duration: {card['duration']}s)")

            # Always keep the first section as intro
            intro_section = script_cards[0]

            # Always keep the last section as outro
            outro_section = script_cards[-1] if len(script_cards) > 1 else {
                "text": "Thanks for watching! Don't forget to like and subscribe.",
                "duration": 3.0
            }

            # Handle middle sections - either combine or expand
            middle_sections = script_cards[1:-1] if len(script_cards) > 2 else []

            if len(middle_sections) > (optimal_bg_count - 2):
                # Too many sections, combine them
                logger.info(f"Combining {len(middle_sections)} middle sections into {optimal_bg_count - 2} sections")

                # Calculate how many sections to put in each new middle section
                sections_per_group = len(middle_sections) / (optimal_bg_count - 2)
                new_middle_sections = []

                for i in range(optimal_bg_count - 2):
                    start_idx = int(i * sections_per_group)
                    end_idx = int((i + 1) * sections_per_group) if i < (optimal_bg_count - 3) else len(middle_sections)
                    section_group = middle_sections[start_idx:end_idx]

                    combined_text = " ".join(card["text"] for card in section_group)
                    combined_duration = sum(card["duration"] for card in section_group)

                    new_middle_sections.append({
                        "text": combined_text,
                        "duration": combined_duration
                    })

                middle_sections = new_middle_sections

            elif len(middle_sections) < (optimal_bg_count - 2):
                # Not enough sections, split them up
                if len(middle_sections) == 0:
                    # Generate generic middle sections if none exist
                    if optimal_bg_count > 2:
                        # Create a generic middle section
                        middle_text = f"Let's explore {topic} in more detail and learn about its key aspects."
                        new_middle_sections = []

                        for i in range(optimal_bg_count - 2):
                            new_middle_sections.append({
                                "text": middle_text,
                                "duration": 5.0
                            })

                        middle_sections = new_middle_sections
                else:
                    # Split existing sections to match optimal count
                    logger.info(f"Splitting {len(middle_sections)} middle sections into {optimal_bg_count - 2} sections")

                    # Split text of each middle section in roughly equal parts
                    all_sentences = []
                    for section in middle_sections:
                        # Split text into sentences
                        sentences = re.split(r'(?<=[.!?])\s+', section["text"])
                        all_sentences.extend(sentences)

                    # Distribute sentences across new sections
                    sentences_per_section = max(1, len(all_sentences) // (optimal_bg_count - 2))
                    new_middle_sections = []

                    for i in range(optimal_bg_count - 2):
                        start_idx = i * sentences_per_section
                        end_idx = (i + 1) * sentences_per_section if i < (optimal_bg_count - 3) else len(all_sentences)

                        if start_idx < len(all_sentences):
                            section_sentences = all_sentences[start_idx:end_idx]
                            section_text = " ".join(section_sentences)

                            # Estimate duration - 1 second per sentence with minimum 3 seconds
                            estimated_duration = max(3.0, len(section_sentences) * 1.0)

                            new_middle_sections.append({
                                "text": section_text,
                                "duration": estimated_duration
                            })

                    middle_sections = new_middle_sections

            # Combine intro, middle sections, and outro to create final script_cards
            final_script_cards = [intro_section] + middle_sections + [outro_section]
            script_cards = final_script_cards

            # Log adjusted sections
            logger.info("Adjusted script sections:")
            for i, card in enumerate(script_cards):
                logger.info(f"  Section {i+1}: {card['text'][:50]}... (duration: {card['duration']}s)")

        logger.info(f"Final script has {len(script_cards)} sections to match {optimal_bg_count} backgrounds")
        for i, card in enumerate(script_cards):
            logger.info(f"Section {i+1}: {card['text'][:30]}... (duration: {card['duration']}s)")

        update_progress(40, "Preparing to render video")

        # Use the title from the content package as the video title
        video_title = content_package['title']
        logger.info(f"Using title: {video_title}")

        # Check if processing should be aborted
        if should_abort_processing():
            logger.info("Shutdown requested, aborting video generation before rendering")
            return None, None

        # Create the short
        update_progress(50, "Starting video rendering")

        # Track start time for progress calculation
        rendering_start_time = time.time()
        logger.info(f"Starting video rendering at {datetime.datetime.now().strftime('%H:%M:%S')}")

        # Strict duration enforcement - log the max_duration
        logger.info(f"Enforcing strict max_duration of {max_duration} seconds")

        # Define a specialized progress tracker for the rendering process
        # This will be called periodically during the rendering process
        last_reported_progress = 50

        def rendering_progress_tracker(progress=None, message=None):
            nonlocal last_reported_progress
            # If progress and message are provided, use them directly
            if progress is not None and message is not None:
                if progress > last_reported_progress:
                    last_reported_progress = progress
                    update_progress(progress, message)
                    logger.info(f"Rendering progress: {progress}%, {message}")
                return False

            # Otherwise, calculate progress based on elapsed time
            elapsed_seconds = time.time() - rendering_start_time

            # Make progress more gradual - divide into smaller increments
            # Estimate total rendering time as 5 minutes (300 seconds) to reach 85%
            estimated_total_seconds = 300
            progress_range = 35  # From 50% to 85%

            # Calculate progress with a minimum increment to avoid very small increases
            # This creates a smooth, gradual progression from 50-85%
            new_progress = 50 + min(progress_range, (elapsed_seconds / estimated_total_seconds) * progress_range)

            # Cap at 85% (final step brings to 90%)
            if new_progress > 85:
                new_progress = 85

            # Only update if changed by at least 1%
            if int(new_progress) > last_reported_progress:
                last_reported_progress = int(new_progress)
                phase_message = "Rendering video sections" if background_type == "video" else "Compositing image sequence"
                update_progress(last_reported_progress, phase_message)
                logger.info(f"Rendering in progress - elapsed time: {elapsed_seconds:.1f}s, progress: {last_reported_progress}%")

            # Never request abort from this callback
            return False

        # Call create_youtube_short with appropriate parameters based on creator type
        if isinstance(creator, YTShortsCreator_I):
            # YTShortsCreator_I doesn't accept background_type or background_source parameters
            video_path = creator.create_youtube_short(
                title=video_title,
                script_sections=script_cards,
                output_filename=output_filename,
                max_duration=max_duration,
                background_query="abstract background",  # Default fallback query
                custom_background_path=background_path,
                style=style,
                progress_callback=rendering_progress_tracker
            )
        elif isinstance(creator, CustomShortsCreator):
            # Only CustomShortsCreator accepts background_type parameter
            video_path = creator.create_youtube_short(
                title=video_title,
                script_sections=script_cards,
                output_filename=output_filename,
                max_duration=max_duration,
                background_type=background_type,
                background_source=background_source,
                custom_background_path=background_path,
                style=style,
                progress_callback=rendering_progress_tracker
            )
        elif isinstance(creator, YTShortsCreator_V):
            # YTShortsCreator_V doesn't accept background_type parameter
            video_path = creator.create_youtube_short(
                title=video_title,
                script_sections=script_cards,
                output_filename=output_filename,
                max_duration=max_duration,
                background_query="abstract background",  # Default fallback query
                custom_background_path=background_path,
                style=style,
                progress_callback=rendering_progress_tracker
            )
        else:
            # Fallback, in case there's another creator type
            logger.warning(f"Unknown creator type: {type(creator).__name__}. Attempting with standard parameters.")
            try:
                video_path = creator.create_youtube_short(
                    title=video_title,
                    script_sections=script_cards,
                    output_filename=output_filename,
                    max_duration=max_duration,
                    style=style,
                    progress_callback=rendering_progress_tracker
                )
            except Exception as e:
                logger.error(f"Error calling create_youtube_short with standard parameters: {e}")
                raise

        rendering_time = time.time() - rendering_start_time
        logger.info(f"Video rendering completed in {rendering_time:.1f} seconds")
        update_progress(90, "Video rendering complete, finalizing")

        # Return the local video path (don't upload to cloud here - let main.py handle it)
        if video_path and os.path.exists(video_path):
            # Get actual video duration for verification
            try:
                from moviepy.editor import VideoFileClip
                with VideoFileClip(video_path) as clip:
                    actual_duration = clip.duration
                    logger.info(f"Generated video duration: {actual_duration:.2f}s (target: {max_duration}s)")
                    if abs(actual_duration - max_duration) > 2:  # Allow 2 second tolerance
                        logger.warning(f"Video duration ({actual_duration:.2f}s) differs significantly from target ({max_duration}s)")
            except Exception as e:
                logger.error(f"Could not verify video duration: {e}")

            logger.info(f"Video generated successfully at: {video_path}")
            logger.info(f"=== VIDEO GENERATION COMPLETED ===")
            return video_path, content_package
        else:
            logger.error(f"Video generation failed or output file not found")
            logger.info(f"=== VIDEO GENERATION FAILED ===")
            # Clean up temp directory
            if os.path.exists(temp_dir):
                try:
                    shutil.rmtree(temp_dir)
                    logger.info(f"Cleaned up temporary directory: {temp_dir}")
                except Exception as cleanup_error:
                    logger.warning(f"Failed to clean up temporary directory: {cleanup_error}")
            return None, content_package

    except Exception as e:
        logger.error(f"Error generating YouTube short: {e}")
        logger.info(f"=== VIDEO GENERATION FAILED WITH ERROR ===")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        # Clean up temp directory if it exists
        if 'temp_dir' in locals() and os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
                logger.info(f"Cleaned up temporary directory after error: {temp_dir}")
            except Exception as cleanup_error:
                logger.warning(f"Failed to clean up temporary directory after error: {cleanup_error}")
        return None, None


