import logging # for logging events
import logging.handlers # Import handlers
import os # for environment variables and file paths
from pathlib import Path # for file paths and directory creation
from dotenv import load_dotenv # for loading environment variables
from .script_generator import generate_script, generate_batch_video_queries, parse_script_to_cards
from .video_maker import YTShortsCreator
from .image_maker import ImageShortsCreator
# from youtube_upload import upload_video, get_authenticated_service
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
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from app.storage import cloud_storage

load_dotenv()
NEWS_API_KEY = os.getenv("NEWS_API_KEY")
YOUTUBE_TOPIC = os.getenv("YOUTUBE_TOPIC", "Artificial Intelligence")

# Configure logging with daily rotation
LOG_DIR = 'logs'  # Define log directory
LOG_FILENAME = os.path.join(LOG_DIR, 'youtube_shorts_daily.log') # Create full path
LOG_LEVEL = logging.INFO

# Ensure log directory exists
Path(LOG_DIR).mkdir(parents=True, exist_ok=True)

# Set up a specific logger with our desired output level
logger = logging.getLogger(__name__)
logger.setLevel(LOG_LEVEL)

# Define log format
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(name)s - %(message)s')

# Add the log message handler to the logger
# Rotate logs daily at midnight, keep 7 backups
handler = logging.handlers.TimedRotatingFileHandler(
    LOG_FILENAME, when='midnight', interval=1, backupCount=7
)
handler.setFormatter(formatter)
logger.addHandler(handler)

# Add a handler to also output to console (like the original setup)
stream_handler = logging.StreamHandler()
stream_handler.setFormatter(formatter)
logger.addHandler(stream_handler)

# Configure root logger similarly if other modules use logging.getLogger() without a name
# This ensures consistency if other modules just call logging.info etc.
logging.basicConfig(level=LOG_LEVEL, format='%(asctime)s - %(levelname)s - %(name)s - %(message)s', handlers=[handler, stream_handler])

def ensure_output_directory(directory="ai_shorts_output"):
    """Ensure the output directory exists."""
    # Use a single temp directory for processing
    temp_dir = tempfile.mkdtemp()

    # Make sure we create the output directory if it doesn't exist
    # We'll use an absolute path to avoid path resolution issues
    output_dir = os.path.abspath(directory)
    os.makedirs(output_dir, exist_ok=True)

    logger.info(f"Using temp dir: {temp_dir}, output dir: {output_dir}")

    return temp_dir

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

        max_tokens = 200
        prompt = f"""
        Generate a YouTube Shorts script focused entirely on the topic: '{topic}'
        for the date {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}.
        The script should not exceed {max_duration} seconds and should follow this structure:
        1. Start with an attention-grabbing opening .
        2. Highlight key points about this topic .
        3. End with a clear call to action
        Use short, concise sentences and suggest 3-4 trending hashtags (e.g., #AI, #TechNews).
        Keep it under {max_tokens} tokens.
        """

        script = generate_script(prompt, max_tokens=max_tokens)
        logger.info("Raw script generated successfully")

        script_cards = parse_script_to_cards(script)
        logger.info(f"Script parsed into {len(script_cards)} sections")
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
            creator = ImageShortsCreator(output_dir=output_dir)
            config = {
                "title": topic,
                "script_sections": script_cards,
                "background_query": fallback_query,
                "output_filename": output_filename,
                "add_captions": True,
                "style": "image",
                "voice_style": None,
                "max_duration": max_duration,
                "background_queries": section_queries,
                "blur_background": False,
                "edge_blur": False,
                "custom_background_path": background_path if background_source == "custom" else None
            }
            video_path = creator.create_youtube_short(config)
        else:
            creator = YTShortsCreator(output_dir=output_dir)
            video_path = creator.create_youtube_short(
                title=topic,
                script_sections=script_cards,
                background_query=fallback_query,
                output_filename=output_filename,
                add_captions=True,
                style="video",
                voice_style=None,
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

def generate_youtube_short(topic, max_duration=25, background_type='video', background_source='provided', background_path=None):
    """Generate a YouTube short video."""
    try:
        # Log the input parameters for debugging
        logger.info(f"generate_youtube_short called with: topic={topic}, max_duration={max_duration}, "
                   f"background_type={background_type}, background_source={background_source}, background_path={background_path}")

        # Create a temporary directory for processing
        with tempfile.TemporaryDirectory() as temp_dir:
            # If background is provided and it's a GCS path, get a signed URL
            if background_path and isinstance(background_path, str) and background_path.startswith('gs://'):
                try:
                    _, bucket_name, blob_name = background_path.split('/', 2)
                    # Get a signed URL for streaming
                    background_path = cloud_storage.get_signed_url(blob_name, bucket_name, expiration=3600)
                    logger.info(f"Using streaming URL for background video")
                except Exception as e:
                    logger.error(f"Error getting signed URL for background: {e}")
                    background_path = None  # Reset to use default background

            # Make sure output directory exists inside the temp directory
            output_dir = os.path.join(temp_dir, "output")
            os.makedirs(output_dir, exist_ok=True)

            # Generate a unique filename
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_topic = re.sub(r'[^\w\s-]', '', topic.lower()).strip().replace(' ', '_')[:50]
            output_filename = f"yt_shorts_{safe_topic}_{timestamp}.mp4"

            # Full path to the output file
            output_path = os.path.join(output_dir, output_filename)

            # Create the YouTube short
            logger.info(f"Starting YouTube short creation process for topic: {topic}")

            # Ensure background_path is defined before passing it to create_youtube_short
            if background_source == "custom" and not background_path:
                logger.warning("Custom background source specified but no background path provided")
                background_source = "provided"  # Fallback to provided background instead of video

            # Log the values being passed to create_youtube_short for debugging
            logger.info(f"Calling create_youtube_short with: topic={topic}, max_duration={max_duration}, "
                       f"background_source={background_source}, background_path={background_path}, background_style={background_type}")

            video_path = create_youtube_short(
                topic=topic,
                output_dir=output_dir,
                output_filename=output_filename,
                max_duration=max_duration,
                background_source=background_source,
                background_path=background_path,
                background_style=background_type
            )

            if not video_path or not os.path.exists(video_path):
                raise FileNotFoundError(f"Video creation failed: output file not found at {video_path}")

            logger.info(f"YouTube short created successfully at: {video_path}")

            # Return the path to the generated video
            return video_path

    except Exception as e:
        logger.error(f"Error in generate_youtube_short: {e}")
        raise


