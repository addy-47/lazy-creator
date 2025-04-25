# for shorts created using gen ai images

import os # for file operations
import time # for timing events and creating filenames like timestamps
import random # for randomizing elements
import textwrap # for wrapping text but is being handled by textclip class in moviepy
import requests # for making HTTP requests
import numpy as np # for numerical operations here used for rounding off
import logging # for logging events
from PIL import Image, ImageFilter, ImageDraw, ImageFont# for image processing
from moviepy.editor import ( # for video editing
    VideoFileClip, VideoClip, TextClip, CompositeVideoClip,ImageClip,
    AudioFileClip, concatenate_videoclips, ColorClip, CompositeAudioClip, AudioClip
)
from moviepy.config import change_settings
change_settings({"IMAGEMAGICK_BINARY": "magick"}) # for windows users
from gtts import gTTS
from dotenv import load_dotenv
import shutil # for file operations like moving and deleting files
import tempfile # for creating temporary files
# Import text clip functions from shorts_maker_V with proper relative imports
from .video_maker import YTShortsCreator_V
from datetime import datetime # for more detailed time tracking
import re # for regular expressions
from typing import List, Optional, Union, Enum

# Define VideoStyles enum for caption styling options
class VideoStyles(Enum):
    DEFAULT = "default"
    MODERN = "modern"
    MINIMAL = "minimal"
    BOLD = "bold"
    SUBTLE = "subtle"
    NONE = "none"

# Configure logging for easier debugging
# Do NOT initialize basicConfig here - this will be handled by main.py
logger = logging.getLogger(__name__)

# Timer function for performance monitoring
def measure_time(func):
    """Decorator to measure the execution time of functions"""
    def wrapper(*args, **kwargs):
        start_time = time.time()
        start_datetime = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        logger.info(f"STARTING {func.__name__} at {start_datetime}")
        result = func(*args, **kwargs)
        end_time = time.time()
        duration = end_time - start_time
        logger.info(f"COMPLETED {func.__name__} in {duration:.2f} seconds")
        return result
    return wrapper

class YTShortsCreator_I:
    def __init__(self, output_dir="output", fps=30):
        """
        Initialize the YouTube Shorts creator with necessary settings

        Args:
            output_dir (str): Directory to save the output videos
            fps (int): Frames per second for the output video
        """
        # Setup directories
        self.output_dir = output_dir
        self.temp_dir = tempfile.mkdtemp()  # Create temp directory for intermediate files
        os.makedirs(output_dir, exist_ok=True)
        os.makedirs(self.temp_dir, exist_ok=True)

        # Check for enhanced rendering capability
        self.has_enhanced_rendering = False
        try:
            import dill
            self.has_enhanced_rendering = True
            logger.info(f"Enhanced parallel rendering available with dill {dill.__version__}")
        except ImportError:
            logger.info("Basic rendering capability only (install dill for enhanced parallel rendering)")

        # Video settings
        self.resolution = (1080, 1920)  # Portrait mode for shorts (width, height)
        self.fps = fps
        self.audio_sync_offset = 0.25  # Delay audio slightly to sync with visuals

        # Font settings
        self.fonts_dir = os.path.join(os.path.dirname(__file__), 'fonts')
        os.makedirs(self.fonts_dir, exist_ok=True)
        # Use relative font paths
        self.title_font_path = os.path.join(self.fonts_dir, 'default_font.ttf')
        self.body_font_path = os.path.join(self.fonts_dir, 'default_font.ttf')

        # Check if font files exist
        if not os.path.exists(self.title_font_path) or not os.path.exists(self.body_font_path):
            logger.warning("Default font files not found, using system default fonts")
            try:
                # Try to copy a system font to the fonts directory
                if os.name == 'nt':  # Windows
                    possible_fonts = [
                        r"C:\Windows\Fonts\arial.ttf",
                        r"C:\Windows\Fonts\calibri.ttf",
                        r"C:\Windows\Fonts\segoeui.ttf"
                    ]
                    for font_path in possible_fonts:
                        if os.path.exists(font_path):
                            shutil.copy(font_path, self.title_font_path)
                            shutil.copy(font_path, self.body_font_path)
                            logger.info(f"Copied system font {font_path} to fonts directory")
                            break
                else:  # Linux/Mac
                    possible_fonts = [
                        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                        "/System/Library/Fonts/Helvetica.ttc",
                        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
                    ]
                    for font_path in possible_fonts:
                        if os.path.exists(font_path):
                            shutil.copy(font_path, self.title_font_path)
                            shutil.copy(font_path, self.body_font_path)
                            logger.info(f"Copied system font {font_path} to fonts directory")
                            break
            except Exception as e:
                logger.error(f"Error copying system font: {e}")
                # If all else fails, set to None and let MoviePy use its default
                self.title_font_path = None
                self.body_font_path = None

        # Create an instance of YTShortsCreator_V to use its text functions
        self.v_creator = YTShortsCreator_V(output_dir=output_dir, fps=fps)

        # Initialize TTS (Text-to-Speech)
        self.azure_tts = None
        self.google_tts = None

        # Initialize Google Cloud TTS
        if os.getenv("USE_GOOGLE_TTS", "true").lower() == "true":
            try:
                from .voiceover import GoogleVoiceover
                self.google_tts = GoogleVoiceover(
                    voice=os.getenv("GOOGLE_VOICE", "en-US-Neural2-D"),
                    output_dir=self.temp_dir
                )
                logger.info("Google Cloud TTS initialized successfully")
            except Exception as e:
                logger.warning(f"Failed to initialize Google Cloud TTS: {e}. Will use gTTS instead.")

        # Initialize Azure TTS as fallback (if configured)
        elif os.getenv("USE_AZURE_TTS", "false").lower() == "true":
            try:
                from .voiceover import AzureVoiceover
                self.azure_tts = AzureVoiceover(
                    voice=os.getenv("AZURE_VOICE", "en-US-JennyNeural"),
                    output_dir=self.temp_dir
                )
                logger.info("Azure TTS initialized successfully")
            except Exception as e:
                logger.warning(f"Failed to initialize Azure TTS: {e}. Will use gTTS instead.")

        # Define transition effects with named functions instead of lambdas
        def fade_transition(clip, duration):
            return clip.fadein(duration).fadeout(duration)

        def slide_left_transition(clip, duration):
            def position_func(t):
                return ((t/duration) * self.resolution[0] - clip.w if t < duration else 0, 'center')
            return clip.set_position(position_func)

        def zoom_in_transition(clip, duration):
            def size_func(t):
                return max(1, 1 + 0.5 * min(t/duration, 1))
            return clip.resize(size_func)

        # Define video transition effects between background segments
        def crossfade_transition(clip1, clip2, duration):
            return concatenate_videoclips([
                clip1.set_end(clip1.duration),
                clip2.set_start(0).crossfadein(duration)
            ], padding=-duration, method="compose")

        def fade_black_transition(clip1, clip2, duration):
            return concatenate_videoclips([
                clip1.fadeout(duration),
                clip2.fadein(duration)
            ])

        # Replace lambda functions with named functions
        self.transitions = {
            "fade": fade_transition,
            "slide_left": slide_left_transition,
            "zoom_in": zoom_in_transition
        }

        # Define video transition effects between background segments
        self.video_transitions = {
            "crossfade": crossfade_transition,
            "fade_black": fade_black_transition
        }

        # Load Pexels API ke for background videos
        load_dotenv()
        self.pexels_api_key = os.getenv("PEXELS_API_KEY")  # for fallback images
        self.huggingface_api_key = os.getenv("HUGGINGFACE_API_KEY")
        self.hf_model = os.getenv("HF_MODEL", "stabilityai/stable-diffusion-2-1")
        self.hf_api_url = f"https://api-inference.huggingface.co/models/{self.hf_model}"
        self.hf_headers = {"Authorization": f"Bearer {self.huggingface_api_key}"}

        # Watermark settings
        self.watermark_text = "Lazy Creator"  # Default watermark text
        self.watermark_font_size = 40  # Smaller font size for watermark
        self.watermark_opacity = 0.7  # Semi-transparent

    @measure_time
    def _generate_image_from_prompt(self, prompt, style="photorealistic", file_path=None):
        """
        Generate an image using Hugging Face Diffusion API based on prompt

        Args:
            prompt (str): Image generation prompt
            style (str): Style to apply to the image (e.g., "digital art", "realistic", "photorealistic")
            file_path (str): Path to save the image, if None a path will be generated

        Returns:
            str: Path to the generated image or None if failed
        """
        if not file_path:
            file_path = os.path.join(self.temp_dir, f"gen_img_{int(time.time())}_{random.randint(1000, 9999)}.png")

        # Remove any existing style descriptors from the prompt
        style_keywords = ["digital art", "photorealistic", "oil painting", "realistic", "anime",
                         "concept art", "cinematic", "cartoon", "3d render", "watercolor",
                         "sketch", "illustration", "painting"]

        # First, clean the prompt of any existing style descriptors
        clean_prompt = prompt
        for keyword in style_keywords:
            clean_prompt = clean_prompt.replace(f", {keyword}", "")
            clean_prompt = clean_prompt.replace(f" {keyword}", "")
            clean_prompt = clean_prompt.replace(f"{keyword} ", "")
            clean_prompt = clean_prompt.replace(f"{keyword},", "")

        # Clean up any double commas or spaces that might have been created
        while ",," in clean_prompt:
            clean_prompt = clean_prompt.replace(",,", ",")
        while "  " in clean_prompt:
            clean_prompt = clean_prompt.replace("  ", " ")
        clean_prompt = clean_prompt.strip(" ,")

        # Now add the desired style and quality enhancements
        enhanced_prompt = f"{clean_prompt}, {style}, highly detailed, crisp focus, 4K, high resolution"

        logger.info(f"Original prompt: {prompt[:50]}...")
        logger.info(f"Using style: {style}")
        logger.info(f"Enhanced prompt: {enhanced_prompt[:50]}...")

        retry_count = 0
        max_retries = 3
        success = False
        initial_wait_time = 20  # Starting wait time in seconds

        # Check if Hugging Face API key is available
        if not self.huggingface_api_key:
            logger.error("No Hugging Face API key provided. Will fall back to shorts_maker_V.")
            return None

        while not success and retry_count < max_retries:
            try:
                # Make request to Hugging Face API
                response = requests.post(
                    self.hf_api_url,
                    headers=self.hf_headers,
                    json={"inputs": enhanced_prompt},
                    timeout=30  # Add timeout to prevent hanging indefinitely
                )

                if response.status_code == 200:
                    # Save the image
                    with open(file_path, "wb") as f:
                        f.write(response.content)
                    logger.info(f"Image saved to {file_path}")
                    success = True
                else:
                    # If model is loading, wait and retry
                    try:
                        if "application/json" in response.headers.get("Content-Type", ""):
                            response_json = response.json()
                            if response.status_code == 503 and "estimated_time" in response_json:
                                wait_time = response_json.get("estimated_time", initial_wait_time)
                                logger.info(f"Model is loading. Waiting {wait_time} seconds...")
                                time.sleep(wait_time)
                            else:
                                # Other error
                                logger.error(f"Error generating image: {response.status_code} - {response.text}")
                                time.sleep(initial_wait_time)  # Wait before retrying
                        else:
                            # Non-JSON response (HTML error page)
                            logger.error(f"Non-JSON error response: {response.status_code}")
                            # For 503 errors, wait longer before retry
                            if response.status_code == 503:
                                wait_time = initial_wait_time * (retry_count + 1)  # Gradually increase wait time
                                logger.info(f"Service unavailable (503). Waiting {wait_time} seconds before retry...")
                                time.sleep(wait_time)
                            else:
                                time.sleep(initial_wait_time)  # Wait before retrying
                    except ValueError:
                        # Non-JSON response
                        logger.error(f"Could not parse response: {response.status_code}")
                        time.sleep(initial_wait_time)  # Wait before retrying

                    # Check if we should fall back before trying more retries
                    if response.status_code == 503 and retry_count >= 1:
                        logger.warning("Multiple 503 errors from Hugging Face API. Falling back to shorts_maker_V.")
                        return None

                    retry_count += 1
            except requests.exceptions.RequestException as e:
                logger.error(f"Network error during image generation: {e}")
                retry_count += 1
                time.sleep(initial_wait_time)
            except Exception as e:
                logger.error(f"Unexpected exception during image generation: {e}")
                retry_count += 1
                time.sleep(initial_wait_time)

        # If all retries failed, return None to signal fallback to shorts_maker_V
        if not success:
            logger.error("Failed to generate image with Hugging Face API after multiple attempts")
            return None

        return file_path

    @measure_time
    def _fetch_stock_image(self, query):
        """
        This method is intentionally disabled. Fallback now uses shorts_maker_V instead.
        """
        logger.warning("Stock image fetch called but is disabled. Will fall back to shorts_maker_V.")
        return None

    @measure_time
    def fetch_image_unsplash(self, query, file_path=None):
        """
        Fetch an image from Unsplash API based on query

        Args:
            query (str): Search query for Unsplash
            file_path (str): Path to save the image, if None a path will be generated

        Returns:
            str: Path to the downloaded image or None if failed
        """
        if not file_path:
            file_path = os.path.join(self.temp_dir, f"unsplash_img_{int(time.time())}_{random.randint(1000, 9999)}.jpg")

        # Load Unsplash API key from environment
        unsplash_api_key = os.getenv("UNSPLASH_API_KEY")

        # Check if Unsplash API key is available
        if not unsplash_api_key:
            logger.error("No Unsplash API key provided. Cannot fetch stock image.")
            return None

        try:
            # Clean query for Unsplash search
            clean_query = query.replace("photorealistic", "").replace("digital art", "").replace("YouTube Shorts", "")
            # Remove any double spaces
            while "  " in clean_query:
                clean_query = clean_query.replace("  ", " ")
            clean_query = clean_query.strip(" ,")

            logger.info(f"Searching Unsplash with query: {clean_query}")

            # Make request to Unsplash API
            unsplash_api_url = "https://api.unsplash.com/search/photos"
            params = {
                "query": clean_query,
                "orientation": "portrait",  # For shorts videos
                "per_page": 30,
                "client_id": unsplash_api_key
            }

            response = requests.get(unsplash_api_url, params=params, timeout=10)

            if response.status_code == 200:
                data = response.json()

                # Check if we have results
                if data["results"] and len(data["results"]) > 0:
                    # Pick a random image from top results for variety
                    max_index = min(10, len(data["results"]))
                    image_data = random.choice(data["results"][:max_index])
                    image_url = image_data["urls"]["regular"]

                    # Download the image
                    img_response = requests.get(image_url, timeout=10)
                    if img_response.status_code == 200:
                        with open(file_path, "wb") as f:
                            f.write(img_response.content)
                        logger.info(f"Unsplash image downloaded to {file_path}")

                        # Add attribution as required by Unsplash API guidelines
                        attribution = f"Photo by {image_data['user']['name']} on Unsplash"
                        logger.info(f"Image attribution: {attribution}")

                        return file_path
                    else:
                        logger.error(f"Failed to download image from Unsplash: {img_response.status_code}")
                else:
                    logger.error("No results found on Unsplash")
            else:
                logger.error(f"Unsplash API error: {response.status_code} - {response.text}")

        except Exception as e:
            logger.error(f"Error fetching image from Unsplash: {e}")

        return None

    @measure_time
    def _create_text_based_image(self, text, file_path):
        """
        This method is intentionally disabled. Fallback now uses shorts_maker_V instead.
        """
        logger.warning("Text-based image creation called but is disabled. Will fall back to shorts_maker_V.")
        return None

    @measure_time
    def _create_still_image_clip(self, image_path, duration, text=None, text_position=('center','center'),
                               font_size=60, with_zoom=True, zoom_factor=0.05):
        """
        Create a still image clip with optional text and zoom effect

        Args:
            image_path (str): Path to the image
            duration (float): Duration of the clip in seconds
            text (str): Optional text overlay
            text_position (str): Position of text ('top', 'center', ('center','center'))
            font_size (int): Font size for text
            with_zoom (bool): Whether to add a subtle zoom effect
            zoom_factor (float): Rate of zoom (higher = faster zoom)

        Returns:
            VideoClip: MoviePy clip containing the image and effects
        """
        # Load image
        image = ImageClip(image_path)

        # Resize to fill screen while maintaining aspect ratio
        img_ratio = image.size[0] / image.size[1]
        target_ratio = self.resolution[0] / self.resolution[1]

        if img_ratio > target_ratio:  # Image is wider
            new_height = self.resolution[1]
            new_width = int(new_height * img_ratio)
        else:  # Image is taller
            new_width = self.resolution[0]
            new_height = int(new_width / img_ratio)

        image = image.resize(newsize=(new_width, new_height))

        # Center crop if needed
        if new_width > self.resolution[0] or new_height > self.resolution[1]:
            x_center = new_width // 2
            y_center = new_height // 2
            x1 = max(0, x_center - self.resolution[0] // 2)
            y1 = max(0, y_center - self.resolution[1] // 2)
            image = image.crop(x1=x1, y1=y1, width=self.resolution[0], height=self.resolution[1])

        # Add zoom effect if requested
        if with_zoom:
            def zoom(t):
                # Start at 1.0 zoom and gradually increase
                zoom_level = 1 + (t / duration) * zoom_factor
                return zoom_level

            # Replace lambda with named function
            def zoom_func(t):
                return zoom(t)

            image = image.resize(zoom_func)

        # Set the duration
        image = image.set_duration(duration)

        # Add text if provided
        if text:
            try:
                # Try using the text clip function from YTShortsCreator_V
                txt_clip = self.v_creator._create_text_clip(
                    text,
                    duration=duration,
                    font_size=font_size,
                    position=text_position,
                    with_pill=True
                )
                # Combine image and text
                return CompositeVideoClip([image, txt_clip], size=self.resolution)
            except Exception as e:
                logger.error(f"Error creating text clip using V creator: {e}")
                # Fallback to a simple text implementation if the V creator fails
                try:
                    # Use the simpler built-in MoviePy TextClip without fancy effects
                    simple_txt_clip = TextClip(
                        txt=text,
                        fontsize=font_size,
                        color='white',
                        align='center',
                        method='caption',
                        size=(int(self.resolution[0] * 0.9), None)
                    ).set_position(('center', int(self.resolution[1] * 0.85))).set_duration(duration)

                    # Create a semi-transparent background for better readability
                    txt_w, txt_h = simple_txt_clip.size
                    bg_width = txt_w + 40
                    bg_height = txt_h + 40
                    bg_clip = ColorClip(size=(bg_width, bg_height), color=(0, 0, 0, 128))
                    bg_clip = bg_clip.set_position(('center', int(self.resolution[1] * 0.85) - 20)).set_duration(duration).set_opacity(0.7)

                    # Combine all elements
                    return CompositeVideoClip([image, bg_clip, simple_txt_clip], size=self.resolution)
                except Exception as e2:
                    logger.error(f"Fallback text clip also failed: {e2}")
                    # If all text methods fail, just return the image without text
                    logger.warning("Returning image without text overlay due to text rendering failures")
                    return image
        return image

    @measure_time
    def _create_text_clip(self, text, duration=5, font_size=60, font_path=None, color='white',
                          position='center', animation="fade", animation_duration=1.0, shadow=True,
                          outline=True, with_pill=False, pill_color=(0, 0, 0, 160), pill_radius=30):
        """
        Create a text clip with various effects and animations.
        Using YTShortsCreator_V's implementation for better visibility.
        """
        return self.v_creator._create_text_clip(
            text=text,
            duration=duration,
            font_size=font_size,
            font_path=font_path,
            color=color,
            position=position,
            animation=animation,
            animation_duration=animation_duration,
            shadow=shadow,
            outline=outline,
            with_pill=with_pill,
            pill_color=pill_color,
            pill_radius=pill_radius
        )

    @measure_time
    def _create_word_by_word_clip(self, text, duration, font_size=60, font_path=None,
                             text_color=(255, 255, 255, 255),
                             pill_color=(0, 0, 0, 160),
                             position=('center', 'center')):
        """
        Create a clip where words appear one by one with timing.
        Using YTShortsCreator_V's implementation for better visibility.
        """
        return self.v_creator._create_word_by_word_clip(
            text=text,
            duration=duration,
            font_size=font_size,
            font_path=font_path,
            text_color=text_color,
            pill_color=pill_color,
            position=position
        )

    def _create_pill_image(self, size, color=(0, 0, 0, 160), radius=30):
        """
        Create a pill-shaped background image with rounded corners.
        Using YTShortsCreator_V's implementation.
        """
        return self.v_creator._create_pill_image(size, color, radius)

    def _create_watermark(self, duration):
        """
        Create a semi-transparent watermark for the video
        """
        if not self.body_font_path:
            logger.warning("No font available for watermark")
            return None

        try:
            # Reduce memory usage by limiting watermark size and using smaller font
            max_size = (min(self.resolution[0] // 5, 250), None)  # Limit width to smaller of 1/5 of video width or 250px

            # Create watermark text clip with reduced size
            txt_clip = TextClip(
                txt=self.watermark_text,
                font=self.body_font_path,
                fontsize=min(self.watermark_font_size, 24),  # Cap font size
                color='white',
                align='East',
                size=max_size
            )

            # Set position to top right with some padding
            padding = 20
            txt_clip = txt_clip.set_position(('right', 'top'))
            txt_clip = txt_clip.set_opacity(self.watermark_opacity)
            txt_clip = txt_clip.set_duration(duration)

            return txt_clip
        except Exception as e:
            logger.error(f"Error creating watermark: {e}")
            return None

    def _safely_create_composite(self, clips, duration=None):
        """
        Safely create a composite video clip with memory error handling

        Args:
            clips: List of clips to composite
            duration: Optional duration to set for the composite

        Returns:
            CompositeVideoClip or the first clip if compositing fails
        """
        import numpy
        if len(clips) == 1:
            return clips[0]

        try:
            composite = CompositeVideoClip(clips)
            if duration is not None:
                composite = composite.set_duration(duration)
            return composite
        except (MemoryError, numpy._core._exceptions._ArrayMemoryError) as e:
            logger.warning(f"Memory error in clip compositing: {e}. Using first clip only.")
            # Return just the main clip as fallback
            return clips[0]

    @measure_time
    def _create_tts_audio(self, text, filename=None, voice_style="none"):
        """
        Create TTS audio file with robust error handling

        Args:
            text (str): Text to convert to speech
            filename (str): Output filename
            voice_style (str): Style of voice ('excited', 'calm', etc.)

        Returns:
            str: Path to the audio file or None if all methods fail
        """
        if not filename:
            filename = os.path.join(self.temp_dir, f"tts_{int(time.time())}.mp3")

        # Make sure text is not empty and has minimum length
        if not text or len(text.strip()) == 0:
            text = "No text provided"
        elif len(text.strip()) < 5:
            # For very short texts like "Check it out!", expand it slightly to ensure TTS works well
            text = text.strip() + "."  # Add period if missing
            
        logger.info(f"Creating TTS audio for: \"{text[:50]}{'...' if len(text) > 50 else ''}\" (length: {len(text)})")
        logger.info(f"Output file: {filename}")
        if voice_style and voice_style != "none":
            logger.info(f"Voice style: {voice_style}")

        # Try Google Cloud TTS first if available
        if self.google_tts:
            try:
                logger.info("Attempting to use Google Cloud TTS")
                voice = os.getenv("GOOGLE_VOICE", "en-US-Neural2-D")
                # Map voice styles for Google Cloud TTS
                google_styles = {
                    "excited": "excited",
                    "calm": "calm",
                    "serious": "serious",
                    "sad": "sad",
                    "none": None
                }
                style = google_styles.get(voice_style, None)

                audio_path = self.google_tts.generate_speech(
                    text,
                    output_filename=filename,
                    voice_style=style
                )
                logger.info(f"Successfully generated audio using Google Cloud TTS: {audio_path}")
                
                # Verify the audio file was created correctly
                if os.path.exists(audio_path):
                    try:
                        # Verify the audio file can be loaded
                        audio = AudioFileClip(audio_path)
                        if audio.duration <= 0:
                            logger.warning(f"Generated audio file has zero duration, will try another method")
                            audio.close()
                        else:
                            logger.info(f"Verified audio has valid duration: {audio.duration:.2f}s")
                            audio.close()
                            return audio_path
                    except Exception as e:
                        logger.error(f"Error verifying Google TTS audio: {e}")
                
                # If verification failed, continue to next method
                logger.warning("Google TTS verification failed, trying next method")
            except Exception as e:
                logger.error(f"Google Cloud TTS failed: {str(e)}")
                logger.error(f"Falling back to Azure TTS or gTTS")
                import traceback
                logger.error(f"Google TTS error traceback: {traceback.format_exc()}")

        # Try Azure TTS next if available
        if self.azure_tts:
            try:
                logger.info("Attempting to use Azure TTS")
                voice = os.getenv("AZURE_VOICE", "en-US-JennyNeural")
                # Map voice styles for Azure
                azure_styles = {
                    "excited": "cheerful",
                    "calm": "gentle",
                    "serious": "serious",
                    "sad": "sad",
                    "none": None
                }
                style = azure_styles.get(voice_style, None)

                audio_path = self.azure_tts.generate_speech(text, output_filename=filename)
                logger.info(f"Successfully generated audio using Azure TTS: {audio_path}")
                
                # Verify the audio file was created correctly
                if os.path.exists(audio_path):
                    try:
                        audio = AudioFileClip(audio_path)
                        if audio.duration <= 0:
                            logger.warning(f"Generated audio file has zero duration, will try another method")
                            audio.close()
                        else:
                            logger.info(f"Verified audio has valid duration: {audio.duration:.2f}s")
                            audio.close()
                            return audio_path
                    except Exception as e:
                        logger.error(f"Error verifying Azure TTS audio: {e}")
                
                # If verification failed, continue to next method
                logger.warning("Azure TTS verification failed, trying next method")
            except Exception as e:
                logger.error(f"Azure TTS failed: {str(e)}")
                logger.error(f"Falling back to gTTS")
                import traceback
                logger.error(f"Azure TTS error traceback: {traceback.format_exc()}")

        # Fall back to gTTS with multiple retries
        logger.info("Using gTTS fallback")
        retry_count = 0
        max_retries = 3

        while retry_count < max_retries:
            try:
                logger.info(f"gTTS attempt {retry_count+1}/{max_retries}")
                tts = gTTS(text=text, lang='en', slow=False)
                tts.save(filename)
                logger.info(f"Successfully created TTS audio with gTTS: {filename}")
                
                # Verify the gTTS audio file
                try:
                    audio = AudioFileClip(filename)
                    if audio.duration <= 0:
                        logger.warning(f"gTTS audio file has zero duration, will try again")
                        audio.close()
                        retry_count += 1
                        continue
                    else:
                        logger.info(f"Verified gTTS audio has valid duration: {audio.duration:.2f}s")
                        audio.close()
                        return filename
                except Exception as e:
                    logger.error(f"Error verifying gTTS audio: {e}")
                    retry_count += 1
                    continue
            except requests.exceptions.RequestException as e:
                logger.error(f"Network error in gTTS (attempt {retry_count+1}/{max_retries}): {e}")
                time.sleep(2)
                retry_count += 1
            except Exception as e:
                logger.error(f"gTTS error (attempt {retry_count+1}/{max_retries}): {e}")
                time.sleep(2)
                retry_count += 1

        # If all TTS methods fail, create a silent audio clip as a last resort
        try:
            logger.warning("All TTS methods failed. Creating silent audio clip.")
            # Calculate duration based on text length (approx. speaking time)
            words = text.split()
            # Average speaking rate is about 150 words per minute or 2.5 words per second
            duration = max(3, len(words) / 2.5)  # Minimum 3 seconds

            # Create a silent audio clip
            silent_clip = AudioClip(lambda t: [0, 0], duration=duration)
            silent_clip.write_audiofile(filename, fps=44100, nbytes=2, codec='libmp3lame', logger=None)

            logger.info(f"Created silent audio clip as fallback: {filename}")
            return filename
        except Exception as e:
            logger.error(f"Failed to create even silent audio: {e}")
            return None

    @measure_time
    def create_youtube_short(self, title, script_sections, background_query="abstract background",
                        output_filename=None, add_captions=True, style="photorealistic", voice_style=None, max_duration=25,
                        background_queries=None, blur_background=False, edge_blur=False, custom_background_path=None,
                        progress_callback=None):
        """
        Create a YouTube short with image backgrounds.

        Args:
            title: Title for the video
            script_sections: List of script sections
            background_query: Query for background images
            output_filename: Name of the output file
            add_captions: Whether to add captions
            style: Style for image generation
            voice_style: Voice style to use
            max_duration: Maximum duration in seconds
            background_queries: Specific queries for each section
            blur_background: Whether to apply blur
            edge_blur: Whether to apply edge blur
            custom_background_path: Path to custom background image
            progress_callback: Optional callback function to track rendering progress

        Returns:
            Path to the output video file
        """
        try:
            # Set output filename if not provided
            if not output_filename:
                timestamp = int(time.time())
                output_filename = f"shorts_{timestamp}.mp4"

            # Ensure output_filename is a string
            if not isinstance(output_filename, str):
                output_filename = str(output_filename)

            # Ensure output filename has .mp4 extension
            if not output_filename.endswith('.mp4'):
                output_filename += '.mp4'

            # Full path for output
            output_path = os.path.join(self.output_dir, output_filename)

            # Start timing the process
            start_time = time.time()
            
            # Validate max_duration is in the acceptable range for shorts
            if max_duration < 10:
                logger.warning(f"Requested duration {max_duration}s is too short for a YouTube Short, increasing to 10s")
                max_duration = 10
            elif max_duration > 60:
                logger.warning(f"Requested duration {max_duration}s exceeds maximum for a YouTube Short, limiting to 60s")
                max_duration = 60
                
            logger.info(f"Creating short with target duration of {max_duration} seconds")
            
            # Setup progress reporting if callback is provided
            last_progress_check = time.time()
            if progress_callback and callable(progress_callback):
                # Call the progress callback every 5 seconds if enabled
                def check_progress():
                    nonlocal last_progress_check
                    current_time = time.time()
                    if current_time - last_progress_check >= 5:
                        last_progress_check = current_time
                        try:
                            # Try calling without arguments first (for compatibility with image_progress_tracker)
                            return progress_callback()
                        except TypeError:
                            # If that fails, try calling with default progress values
                            try:
                                return progress_callback(75, "Processing image sequence")
                            except Exception as e:
                                logger.error(f"Error calling progress callback: {e}")
                                return False
                    return False
            else:
                # No-op if no callback provided
                def check_progress():
                    return False

            # Adjust script sections if needed - break up long text for better timing
            adjusted_script_sections = []
            for section in script_sections:
                # Handle both dict and string formats
                if isinstance(section, dict):
                    text = section.get('text', '')
                    if len(text.split()) > 40:  # If more than ~40 words, split into smaller sections
                        sentences = re.split(r'(?<=[.!?])\s+', text)
                        current_text = ""
                        
                        for sentence in sentences:
                            if len(current_text.split()) + len(sentence.split()) > 35:
                                if current_text:  # Only add if we have content
                                    new_section = section.copy()
                                    new_section['text'] = current_text.strip()
                                    adjusted_script_sections.append(new_section)
                                    current_text = ""
                            
                            # Add the current sentence
                            current_text += " " + sentence
                        
                        # Add any remaining text
                        if current_text.strip():
                            new_section = section.copy()
                            new_section['text'] = current_text.strip()
                            adjusted_script_sections.append(new_section)
                    else:
                        adjusted_script_sections.append(section)
                else:
                    # For string sections
                    text = str(section)
                    if len(text.split()) > 40:
                        sentences = re.split(r'(?<=[.!?])\s+', text)
                        current_text = ""
                        
                        for sentence in sentences:
                            if len(current_text.split()) + len(sentence.split()) > 35:
                                if current_text:
                                    adjusted_script_sections.append(current_text.strip())
                                    current_text = ""
                            
                            current_text += " " + sentence
                        
                        if current_text.strip():
                            adjusted_script_sections.append(current_text.strip())
                    else:
                        adjusted_script_sections.append(section)
            
            if len(adjusted_script_sections) != len(script_sections):
                logger.info(f"Adjusted script sections from {len(script_sections)} to {len(adjusted_script_sections)} sections for better timing")
                script_sections = adjusted_script_sections

            # 1. Generate TTS audio and cards for each script section
            video_clips = []
            card_durations = []
            card_audios = []
            total_duration = 0

            for i, section in enumerate(script_sections):
                # Check for progress abort
                if check_progress():
                    logger.info("Progress callback requested abort")
                    return None
                    
                try:
                    # Support both dictionary format or plain text
                    if isinstance(section, dict):
                        text = section.get('text', '')
                        duration = section.get('duration', 5)
                        card_voice_style = section.get('voice_style', voice_style)
                    else:
                        text = str(section)
                        duration = 5
                        card_voice_style = voice_style

                    # Generate TTS audio
                    audio_path = self._create_tts_audio(text, voice_style=card_voice_style)

                    if audio_path:
                        # Check actual audio duration
                        try:
                            audio_clip = AudioFileClip(audio_path)
                            audio_duration = audio_clip.duration
                            # Ensure minimum duration of 3 seconds and at least the audio duration
                            duration = max(duration, audio_duration + 0.5, 3)
                            audio_clip.close()
                        except Exception as e:
                            logger.error(f"Error checking audio duration: {e}")

                    # Keep track of total duration
                    total_duration += duration
                    card_durations.append(duration)
                    card_audios.append(audio_path)
                except Exception as e:
                    logger.error(f"Error processing section {i+1}: {e}")
                    return None

            # Ensure each section gets at least 3 seconds or scale down if total exceeds max_duration
            if total_duration > max_duration:
                # Scale factor to fit within max_duration
                scale_factor = max_duration / total_duration
                card_durations = [d * scale_factor for d in card_durations]
                total_duration = max_duration
                logger.info(f"Scaled down durations to fit within {max_duration} seconds")

            logger.info(f"Total video duration will be approximately {total_duration:.2f} seconds")

            # 2. Generate background images for each section
            background_image_paths = []

            # Use custom background if provided
            if custom_background_path and os.path.exists(custom_background_path):
                logger.info(f"Using custom background image: {custom_background_path}")
                # Use the same custom background for all sections
                for _ in range(len(script_sections)):
                    background_image_paths.append(custom_background_path)
            else:
                # Check if we have specific queries for each section
                if not background_queries:
                    # If no section-specific queries, generate more varied queries for visual interest
                    if len(script_sections) > 1:
                        logger.info("Generating varied background queries for better visual interest")
                        
                        # Extract key words from the title or script sections
                        keywords = []
                        if title:
                            keywords.extend([word.lower() for word in title.split() if len(word) > 3])
                        
                        # Extract keywords from sections
                        for section in script_sections:
                            text = section.get('text', section) if isinstance(section, dict) else section
                            words = [word.lower() for word in text.split() if len(word) > 3]
                            keywords.extend(words[:3])  # Take first few substantial words
                        
                        # Create background queries with keywords for variety
                        background_queries = []
                        for i in range(len(script_sections)):
                            # For short videos (10-30 sec), use fewer backgrounds to avoid too many transitions
                            if total_duration < 30 and len(script_sections) > 2:
                                # Use same query for related sections
                                query_idx = min(i // 2, len(keywords) - 1) if keywords else 0
                                keyword = keywords[query_idx] if keywords else ""
                                query = f"{keyword} {background_query}" if keyword else background_query
                            else:
                                # For longer videos, use more varied backgrounds
                                keyword = keywords[min(i, len(keywords) - 1)] if keywords else ""
                                query = f"{keyword} {background_query}" if keyword else background_query
                            
                            background_queries.append(query)
                        
                        logger.info(f"Generated {len(background_queries)} background queries")
                    else:
                        # If just one section, use the main query
                        background_queries = [background_query]
                
                # Ensure we have enough queries for all sections
                while len(background_queries) < len(script_sections):
                    background_queries.append(background_query)
                
                # For very short videos (10-15 sec), limit background diversity
                if total_duration < 15 and len(background_queries) > 1:
                    logger.info(f"Short video detected ({total_duration:.2f}s), reducing background changes for smoother experience")
                    # Use the same background query for all sections
                    background_queries = [background_queries[0]] * len(script_sections)

                # Generate or fetch background images for each section
                # Use parallel processing if available
                if self.has_enhanced_rendering and len(background_queries) > 1:
                    try:
                        import concurrent.futures
                        logger.info(f"Using parallel processing for {len(background_queries)} image generations")

                        def generate_image_for_section(args):
                            i, query = args
                            logger.info(f"Generating image for section {i+1} with prompt: {query}")

                            # Try to generate an image using HuggingFace
                            bg_image = self._generate_image_from_prompt(query, style=style)

                            # If Hugging Face fails, try Unsplash instead
                            if not bg_image:
                                logger.info(f"Hugging Face image generation failed, falling back to Unsplash for section {i+1}")
                                bg_image = self.fetch_image_unsplash(query)

                                # If both fail, use a solid color background as last resort
                                if not bg_image:
                                    logger.warning(f"Both image generation methods failed for section {i+1}, using solid color background")
                                    bg_image = self._create_text_based_image(script_sections[i].get('text', ''),
                                                                        os.path.join(self.temp_dir, f"fallback_bg_{i}.png"))

                            return i, bg_image

                        # Create a list of (index, query) pairs
                        tasks = [(i, query) for i, query in enumerate(background_queries) if i < len(script_sections)]

                        # Skip parallel processing if no tasks
                        if not tasks:
                            logger.warning("No valid image generation tasks found")
                            return []

                        # Use ThreadPoolExecutor for parallel processing with at least 1 worker
                        num_workers = max(1, min(4, len(tasks)))
                        with concurrent.futures.ThreadPoolExecutor(max_workers=num_workers) as executor:
                            results = list(executor.map(generate_image_for_section, tasks))

                        # Sort results by index and extract image paths
                        results.sort(key=lambda x: x[0])
                        background_image_paths = [result[1] for result in results]

                        logger.info(f"Completed parallel image generation for {len(background_image_paths)} sections")
                    except Exception as e:
                        logger.error(f"Error in parallel image generation: {e}. Falling back to sequential processing.")
                        # Fall back to sequential processing
                        for i, query in enumerate(background_queries):
                            if i >= len(script_sections):
                                break

                            logger.info(f"Generating image for section {i+1} with prompt: {query}")

                            # Try to generate an image using HuggingFace
                            bg_image = self._generate_image_from_prompt(query, style=style)

                            # If Hugging Face fails, try Unsplash instead (not video_maker)
                            if not bg_image:
                                logger.info(f"Hugging Face image generation failed, falling back to Unsplash for section {i+1}")
                                bg_image = self.fetch_image_unsplash(query)

                                # If both fail, use a solid color background as last resort
                                if not bg_image:
                                    logger.warning(f"Both image generation methods failed for section {i+1}, using solid color background")
                                    bg_image = self._create_text_based_image(script_sections[i].get('text', ''),
                                                                os.path.join(self.temp_dir, f"fallback_bg_{i}.png"))

                            background_image_paths.append(bg_image)
                else:
                    # Sequential processing
                    for i, query in enumerate(background_queries):
                        if i >= len(script_sections):
                            break

                        logger.info(f"Generating image for section {i+1} with prompt: {query}")

                        # Try to generate an image using HuggingFace
                        bg_image = self._generate_image_from_prompt(query, style=style)

                        # If Hugging Face fails, try Unsplash instead (not video_maker)
                        if not bg_image:
                            logger.info(f"Hugging Face image generation failed, falling back to Unsplash for section {i+1}")
                            bg_image = self.fetch_image_unsplash(query)

                            # If both fail, use a solid color background as last resort
                            if not bg_image:
                                logger.warning(f"Both image generation methods failed for section {i+1}, using solid color background")
                                bg_image = self._create_text_based_image(script_sections[i].get('text', ''),
                                                            os.path.join(self.temp_dir, f"fallback_bg_{i}.png"))

                        background_image_paths.append(bg_image)

            # 3. Create video clips for each section using the generated/fetched images
            for i, (bg_image, audio_path, duration) in enumerate(zip(background_image_paths, card_audios, card_durations)):
                # Check for progress abort
                if check_progress():
                    logger.info("Progress callback requested abort")
                    return None
                
                try:
                    # Create clip with text overlay if needed
                    if bg_image:
                        # Get text for this card
                        text = script_sections[i].get('text', '') if isinstance(script_sections[i], dict) else str(script_sections[i])

                        # Verify the image file exists and is readable
                        if not os.path.exists(bg_image):
                            logger.warning(f"Background image {bg_image} not found, using black background for section {i+1}")
                            # Create a black background as fallback
                            fallback_bg = os.path.join(self.temp_dir, f"black_bg_{i}.png")
                            black_img = Image.new('RGB', (1080, 1920), (0, 0, 0))
                            black_img.save(fallback_bg)
                            bg_image = fallback_bg

                        try:
                            # Validate the image before creating the clip
                            img = Image.open(bg_image)
                            img.verify()  # Verify the image is not corrupted
                            logger.info(f"Valid background image for section {i+1}: {bg_image}")
                        except Exception as img_error:
                            logger.error(f"Invalid image file for section {i+1}: {img_error}")
                            # Create a fallback colored background
                            fallback_bg = os.path.join(self.temp_dir, f"fallback_bg_{i}.png")
                            color_img = Image.new('RGB', (1080, 1920), (random.randint(0, 100), random.randint(0, 100), random.randint(0, 100)))
                            color_img.save(fallback_bg)
                            bg_image = fallback_bg
                            logger.info(f"Created fallback background for section {i+1}")

                        # Create a still image clip with text overlay if captions enabled
                        if add_captions:
                            # Create still image clip with text
                            clip = self._create_still_image_clip(
                                bg_image,
                                duration=duration,
                                text=text,
                                font_size=60,
                                with_zoom=True
                            )
                        else:
                            # Create still image clip without text
                            clip = self._create_still_image_clip(
                                bg_image,
                                duration=duration,
                                with_zoom=True
                            )

                        # Apply blur effects if requested
                        if blur_background:
                            try:
                                clip = self.v_creator.custom_blur(clip, radius=15)
                                logger.info(f"Applied blur effect to clip {i+1}")
                            except Exception as e:
                                logger.error(f"Error applying blur effect: {e}")
                        elif edge_blur:
                            try:
                                clip = self.v_creator.custom_edge_blur(clip)
                                logger.info(f"Applied edge blur effect to clip {i+1}")
                            except Exception as e:
                                logger.error(f"Error applying edge blur effect: {e}")

                        # Add audio to the clip if available
                        if audio_path and os.path.exists(audio_path):
                            try:
                                audio = AudioFileClip(audio_path)
                                
                                # Validate audio file was loaded correctly
                                if audio is None or audio.duration <= 0:
                                    logger.error(f"Invalid audio file for section {i+1}: {audio_path}")
                                    # Create silent audio as fallback
                                    audio = AudioClip(lambda t: [0, 0], duration=duration)
                                
                                # Verify audio duration against clip duration with some safety margin
                                if audio.duration > duration:
                                    logger.warning(f"Audio duration ({audio.duration:.2f}s) exceeds clip duration ({duration:.2f}s) for section {i+1}, trimming audio")
                                    # Trim audio with a small safety margin to prevent boundary issues
                                    safe_duration = max(0.1, duration - 0.1)
                                    audio = audio.subclip(0, safe_duration)
                                
                                # Set start time to 0 to ensure sync and verify final duration
                                audio = audio.set_start(0)
                                
                                # Double-check final audio duration
                                if audio.duration <= 0 or audio.duration > duration:
                                    logger.warning(f"Audio still has invalid duration after adjustment ({audio.duration:.2f}s), creating fallback audio")
                                    # Create silent audio as fallback
                                    audio = AudioClip(lambda t: [0, 0], duration=duration - 0.2)
                                
                                # Set the audio
                                clip = clip.set_audio(audio)
                                logger.info(f"Added audio to clip {i+1} (audio: {audio.duration:.2f}s, clip: {duration:.2f}s)")
                            except Exception as e:
                                logger.error(f"Error adding audio to clip: {e}")
                                logger.error(f"Using silent audio instead")
                                try:
                                    # Create silent audio as fallback
                                    silent_audio = AudioClip(lambda t: [0, 0], duration=duration - 0.2)
                                    clip = clip.set_audio(silent_audio)
                                except Exception as e2:
                                    logger.error(f"Failed to create silent audio: {e2}")

                        # Make sure clip has exactly the right duration
                        clip = clip.set_duration(duration)
                        
                        # Verify clip is valid
                        logger.info(f"Created clip {i+1} with duration {clip.duration:.2f}s")
                        video_clips.append(clip)
                    else:
                        # Create a solid colored background with the text as fallback
                        logger.warning(f"No background image for section {i+1}, creating solid color clip")
                        
                        # Create a solid color clip
                        bg_color = (
                            random.randint(10, 50),  # R
                            random.randint(10, 50),  # G
                            random.randint(10, 50)   # B
                        )
                        color_clip = ColorClip(size=self.resolution, color=bg_color, duration=duration)
                        
                        # Get text for this card
                        text = script_sections[i].get('text', '') if isinstance(script_sections[i], dict) else str(script_sections[i])
                        
                        # Create text clip
                        text_clip = self._create_text_clip(
                            text,
                            duration=duration,
                            animation="fade",
                            with_pill=True,
                            font_size=70,
                            position=('center', 'center')
                        )
                        
                        # Combine color and text
                        clip = CompositeVideoClip([color_clip, text_clip], size=self.resolution)
                        
                        # Add audio if available
                        if audio_path and os.path.exists(audio_path):
                            try:
                                audio = AudioFileClip(audio_path)
                                if audio.duration > 0:
                                    # Ensure audio doesn't exceed clip duration with safety margin
                                    safe_duration = max(0.1, duration - 0.2)
                                    if audio.duration > safe_duration:
                                        audio = audio.subclip(0, safe_duration)
                                    audio = audio.set_start(0)
                                    clip = clip.set_audio(audio)
                                else:
                                    logger.warning(f"Audio file has zero duration for section {i+1}")
                                    # Create silent audio
                                    silent_audio = AudioClip(lambda t: [0, 0], duration=duration - 0.2)
                                    clip = clip.set_audio(silent_audio)
                            except Exception as audio_error:
                                logger.error(f"Failed to add audio to fallback clip: {audio_error}")
                                # Try creating silent audio
                                try:
                                    silent_audio = AudioClip(lambda t: [0, 0], duration=duration - 0.2)
                                    clip = clip.set_audio(silent_audio)
                                except Exception as e:
                                    logger.error(f"Failed to create silent audio: {e}")
                        
                        clip = clip.set_duration(duration)
                        video_clips.append(clip)
                except Exception as e:
                    logger.error(f"Error processing section {i+1}: {e}")
                    # Create a fallback clip with solid color
                    logger.warning(f"Creating fallback clip for section {i+1}")
                    fallback_clip = ColorClip(size=self.resolution, color=(30, 30, 30), duration=duration)
                    
                    # Add text if possible
                    try:
                        text = script_sections[i].get('text', '') if isinstance(script_sections[i], dict) else str(script_sections[i])
                        text_clip = TextClip(text, font=self.body_font_path, fontsize=60, color="white", size=(self.resolution[0] - 100, None), method='caption').set_position('center').set_duration(duration)
                        fallback_clip = CompositeVideoClip([fallback_clip, text_clip], size=self.resolution)
                    except Exception as text_error:
                        logger.error(f"Failed to add text to fallback clip: {text_error}")
                    
                    # Add audio if available
                    if audio_path and os.path.exists(audio_path):
                        try:
                            audio = AudioFileClip(audio_path)
                            if audio.duration > 0:
                                # Ensure audio doesn't exceed clip duration with safety margin
                                safe_duration = max(0.1, duration - 0.2)
                                if audio.duration > safe_duration:
                                    audio = audio.subclip(0, safe_duration)
                                audio = audio.set_start(0)
                                fallback_clip = fallback_clip.set_audio(audio)
                            else:
                                logger.warning(f"Audio file has zero duration for section {i+1}")
                                # Create silent audio
                                silent_audio = AudioClip(lambda t: [0, 0], duration=duration - 0.2)
                                fallback_clip = fallback_clip.set_audio(silent_audio)
                        except Exception as audio_error:
                            logger.error(f"Failed to add audio to fallback clip: {audio_error}")
                            # Try creating silent audio
                            try:
                                silent_audio = AudioClip(lambda t: [0, 0], duration=duration - 0.2)
                                fallback_clip = fallback_clip.set_audio(silent_audio)
                            except Exception as e:
                                logger.error(f"Failed to create silent audio: {e}")
                    
                    fallback_clip = fallback_clip.set_duration(duration)
                    video_clips.append(fallback_clip)

            # 4. Concatenate all clips
            if video_clips:
                logger.info(f"Concatenating {len(video_clips)} clips")

                # Create watermark for the entire video duration
                total_duration = sum(clip.duration for clip in video_clips)
                watermark_clip = self._create_watermark(total_duration)

                if watermark_clip:
                    # Add watermark to all video clips
                    for i in range(len(video_clips)):
                        # Use safer composition method
                        video_clips[i] = self._safely_create_composite(
                            [video_clips[i], watermark_clip.set_duration(video_clips[i].duration)],
                            duration=video_clips[i].duration
                        )

                # IMPORTANT: Make sure the final clips are in the correct order
                logger.info("Ensuring clips are in correct order")
                
                # Verify all clips have valid durations before concatenation
                valid_clips = []
                for i, clip in enumerate(video_clips):
                    try:
                        if clip.duration <= 0:
                            logger.warning(f"Clip {i+1} has invalid duration: {clip.duration}s, skipping")
                            continue
                            
                        # Verify audio doesn't exceed clip duration
                        if hasattr(clip, 'audio') and clip.audio is not None:
                            if clip.audio.duration > clip.duration:
                                logger.warning(f"Clip {i+1} audio ({clip.audio.duration}s) exceeds clip duration ({clip.duration}s), fixing")
                                safe_duration = max(0.1, clip.duration - 0.1)
                                new_audio = clip.audio.subclip(0, safe_duration)
                                new_audio = new_audio.set_start(0)
                                clip = clip.set_audio(new_audio)
                                
                        valid_clips.append(clip)
                    except Exception as e:
                        logger.error(f"Error validating clip {i+1}: {e}")
                
                # Only use valid clips for the final video
                if len(valid_clips) < len(video_clips):
                    logger.warning(f"Using {len(valid_clips)} valid clips out of {len(video_clips)} total clips")
                    video_clips = valid_clips
                
                # Concatenate clips in order with proper audio handling
                try:
                    # Use concatenate_videoclips with method="compose" for better audio handling
                    final_clip = concatenate_videoclips(video_clips, method="compose")
                    
                    # Verify the total duration matches our expectation
                    logger.info(f"Final clip duration: {final_clip.duration:.2f}s, Expected: {total_duration:.2f}s")
                    
                    if abs(final_clip.duration - total_duration) > 1.0:
                        logger.warning(f"Duration mismatch! Expected {total_duration:.2f}s but got {final_clip.duration:.2f}s")
                except Exception as e:
                    logger.error(f"Error concatenating clips: {e}")
                    # Fallback to safer compositing method if concatenation fails
                    logger.info("Falling back to safer composite method")
                    final_clip = self._safely_create_composite(video_clips, duration=total_duration)

                # Export the final video
                logger.info(f"Writing video to {output_path}")
                
                # Set up progress tracking
                total_frames = int(final_clip.duration * self.fps)
                
                def write_progress(current_frame):
                    # Call progress callback to check for abort
                    if check_progress():
                        # Returning True from a moviepy progress function aborts rendering
                        return True
                        
                    # Add more detailed progress reporting
                    try:
                        if total_frames > 0 and current_frame > 0:
                            # Calculate percent complete for this video rendering phase
                            # MoviePy calls this function with current frame
                            percent_complete = min(99, int((current_frame / total_frames) * 100))
                            
                            # Only log every 5% to avoid excessive logging
                            if percent_complete % 5 == 0:
                                logger.info(f"Video rendering progress: {percent_complete}% ({current_frame}/{total_frames} frames)")
                    except Exception as e:
                        logger.warning(f"Error in progress calculation: {e}")
                        
                    return None  # Continue rendering
                
                # Before writing the final clip, verify that all audio components have valid durations
                try:
                    if hasattr(final_clip, 'audio') and final_clip.audio is not None:
                        logger.info(f"Verifying final audio: Duration = {final_clip.audio.duration:.2f}s, Clip duration = {final_clip.duration:.2f}s")
                        
                        # Fix audio duration issues - ensure audio is never longer than clip
                        if final_clip.audio.duration > final_clip.duration:
                            logger.warning(f"Final audio duration ({final_clip.audio.duration:.2f}s) exceeds clip duration ({final_clip.duration:.2f}s), recreating audio")
                            
                            # Create a new truncated audio clip with significant safety margin
                            safe_duration = max(0.5, final_clip.duration - 0.5)  # Increased safety margin
                            logger.info(f"Creating new audio with safe duration: {safe_duration:.2f}s")
                            
                            try:
                                # Get audio frames for the safe duration
                                # Create completely new AudioClip instead of subclipping to avoid reference issues
                                
                                # Create a new function that truncates the audio at exactly the safe duration
                                orig_make_frame = final_clip.audio.make_frame
                                
                                def safe_make_frame(t):
                                    if t < safe_duration:
                                        return orig_make_frame(t)
                                    else:
                                        return np.zeros(2)  # Return silence after safe_duration
                                
                                # Create a brand new audio clip with the safe make_frame function
                                new_audio = AudioClip(make_frame=safe_make_frame, duration=safe_duration)
                                
                                # Create temporary file for the new audio
                                temp_audio_path = os.path.join(self.temp_dir, f"safe_audio_{int(time.time())}.mp3")
                                new_audio.write_audiofile(temp_audio_path, fps=44100, nbytes=2, codec='libmp3lame', logger=None)
                                
                                # Create AudioFileClip from the new temporary file
                                safe_audio = AudioFileClip(temp_audio_path)
                                
                                # Close the original audio to free resources
                                try:
                                    final_clip.audio.close()
                                except Exception as close_error:
                                    logger.error(f"Error closing original audio: {close_error}")
                                
                                # Set the new audio to the clip
                                final_clip = final_clip.set_audio(safe_audio)
                                logger.info(f"Replaced audio with safe version: duration = {final_clip.audio.duration:.2f}s")
                            except Exception as audio_error:
                                logger.error(f"Error creating safe audio: {audio_error}")
                                # If creating safe audio fails, remove audio entirely
                                try:
                                    logger.warning("Removing audio completely as safety measure")
                                    final_clip = final_clip.without_audio()
                                except Exception as e:
                                    logger.error(f"Failed to remove audio: {e}")
                except Exception as e:
                    logger.error(f"Error verifying final audio: {e}")
                    # If there's an error with the audio, try to create a version without audio
                    try:
                        logger.warning("Attempting to create a version without audio due to errors")
                        final_clip = final_clip.without_audio()
                    except Exception as e2:
                        logger.error(f"Failed to remove audio: {e2}")
                
                # Ensure proper logger configuration for MoviePy
                moviepy_logger = "bar"  # Use progress bar by default
                
                try:
                    # Use context manager to ensure proper resource cleanup
                    final_duration = final_clip.duration
                    logger.info(f"Exporting video with duration: {final_duration:.2f}s")
                    
                    # Make sure all temporary files are closed before writing
                    for clip in video_clips:
                        if hasattr(clip, 'audio') and clip.audio is not None:
                            try:
                                # Ensure audio doesn't exceed clip duration with an increased safety margin
                                if clip.audio.duration > clip.duration - 0.2:  # Add 0.2s safety margin
                                    logger.warning(f"Extra safety check: Clip audio exceeds duration minus safety margin, fixing")
                                    # Create a new safe audio
                                    safe_audio = clip.audio.subclip(0, max(0.1, clip.duration - 0.5))
                                    clip.audio.close()
                                    clip = clip.set_audio(safe_audio)
                            except Exception as clip_error:
                                logger.error(f"Error in extra audio safety check: {clip_error}")
                    
                    # Write with a single audio channel to simplify processing
                    final_clip.write_videofile(
                        output_path,
                        fps=self.fps,
                        codec='libx264',
                        audio_codec='aac',
                        audio_nbytes=2,  # 16-bit audio
                        audio_fps=22050,  # Lower audio frequency for better compatibility
                        temp_audiofile=os.path.join(self.temp_dir, "temp_audio.m4a"),
                        remove_temp=True,
                        threads=max(2, min(4, os.cpu_count() or 2)),  # Use fewer threads for better stability
                        preset='ultrafast',  # Use faster preset for quicker rendering
                        ffmpeg_params=[
                            "-pix_fmt", "yuv420p",  # For compatibility with all players
                            "-profile:v", "main",   # Better compatibility with mobile devices
                            "-crf", "28",           # Higher compression to save space and improve render speed
                            "-maxrate", "2M",       # Limit bitrate for more efficient compression
                            "-bufsize", "4M",       # Buffer size
                            "-ac", "1"              # Force mono audio channel for simplicity
                        ],
                        logger=moviepy_logger  # Enable progress bar
                    )
                except Exception as e:
                    logger.error(f"Error during video writing: {e}")
                    # Try again with no progress bar and simplified settings
                    try:
                        logger.warning("Retrying video export with simplified settings")
                        
                        # Since the audio seems to be the problem, try without audio
                        try:
                            logger.info("Attempting export with no audio")
                            silent_clip = final_clip.without_audio()
                            
                            silent_clip.write_videofile(
                                output_path,
                                fps=self.fps,
                                codec='libx264',
                                audio=False,  # No audio
                                preset='ultrafast',
                                ffmpeg_params=["-crf", "28"],
                                logger=None  # Disable progress bar for retry
                            )
                            logger.info("Successfully created silent video as fallback")
                        except Exception as no_audio_error:
                            logger.error(f"Failed to create even silent video: {no_audio_error}")
                            return None
                    except Exception as e2:
                        logger.error(f"Second attempt at video export also failed: {e2}")
                        return None
                finally:
                    # Make sure to explicitly close all clips to free resources
                    try:
                        if hasattr(final_clip, 'audio') and final_clip.audio is not None:
                            final_clip.audio.close()
                        final_clip.close()
                        
                        for clip in video_clips:
                            if hasattr(clip, 'audio') and clip.audio is not None:
                                clip.audio.close()
                            clip.close()
                    except Exception as close_error:
                        logger.error(f"Error closing clips during cleanup: {close_error}")

                process_time = time.time() - start_time
                logger.info(f"Video created successfully in {process_time:.2f} seconds")

                return output_path
            else:
                logger.error("Failed to create any video clips")
                return None

        except Exception as e:
            logger.error(f"Error creating YouTube Short: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None
        finally:
            # Clean up temp files
            self._cleanup()

    @measure_time
    def _cleanup(self):
        """Clean up temporary files"""
        # First ensure all audio and video resources are properly closed
        try:
            # Give a slight delay to ensure files are released
            time.sleep(0.5)
            
            # Force garbage collection to help close any remaining file handles
            import gc
            gc.collect()
            
            # Get list of files before attempting deletion
            files_to_remove = []
            for filename in os.listdir(self.temp_dir):
                file_path = os.path.join(self.temp_dir, filename)
                files_to_remove.append(file_path)
            
            # Try to remove each file individually with error handling
            for file_path in files_to_remove:
                try:
                    if os.path.isfile(file_path):
                        try:
                            os.unlink(file_path)
                        except PermissionError:
                            logger.warning(f"Permission error deleting {file_path}, will retry")
                            # On Windows, try a more forceful approach for locked files
                            try:
                                import stat
                                # Change permissions if possible
                                os.chmod(file_path, stat.S_IWRITE)
                                # Try again with a slight delay
                                time.sleep(0.1)
                                os.unlink(file_path)
                            except Exception as perm_error:
                                logger.error(f"Still can't delete file {file_path}: {perm_error}")
                        except OSError as os_error:
                            logger.error(f"OS error deleting {file_path}: {os_error}")
                    elif os.path.isdir(file_path):
                        shutil.rmtree(file_path, ignore_errors=True)
                except Exception as e:
                    logger.error(f"Error cleaning up file {file_path}: {e}")
        except Exception as e:
            logger.error(f"Error in cleanup: {e}")
            import traceback
            logger.error(f"Cleanup error traceback: {traceback.format_exc()}")

    @measure_time
    def _create_section_video(
        self,
        text: str,
        audio_path: str,
        background_image_paths: List[str],
        clip_start_time: float,
        clip_end_time: float,
        output_path: str,
        caption_style: VideoStyles = None,
        progress_callback=None,
    ):
        """Create a video for a section of text."""
        try:
            clip_duration = clip_end_time - clip_start_time
            logger.info(f"Creating video clip with duration {clip_duration}")

            audio_clip = None
            audio_duration = 0
            try:
                audio_clip = AudioFileClip(audio_path)
                audio_duration = audio_clip.duration
                
                # Safety check: Ensure audio duration doesn't exceed clip duration
                if audio_duration > clip_duration + 0.1:  # Allow small margin of error
                    logger.warning(f"Audio duration ({audio_duration}s) exceeds clip duration ({clip_duration}s). Truncating audio.")
                    # Create a new truncated audio clip with a small safety margin
                    truncated_audio_path = os.path.join(self.temp_dir, f"truncated_{os.path.basename(audio_path)}")
                    
                    # Close the original audio clip before creating a new one
                    audio_clip.close()
                    
                    # Use ffmpeg directly for precise trimming
                    safe_duration = clip_duration - 0.05  # Small safety margin
                    subprocess.run([
                        'ffmpeg', '-y', '-i', audio_path, 
                        '-t', str(safe_duration), 
                        '-acodec', 'copy', truncated_audio_path
                    ], check=True, capture_output=True)
                    
                    audio_path = truncated_audio_path
                    audio_clip = AudioFileClip(audio_path)
                    audio_duration = audio_clip.duration
                    logger.info(f"Created truncated audio with duration {audio_duration}s")
            except Exception as e:
                logger.error(f"Error loading audio: {e}")
                if audio_clip:
                    try:
                        audio_clip.close()
                    except:
                        pass
                    audio_clip = None
                    
            # Rest of the function remains the same, with modifications to video writing
            # ... existing code ...

            # Generate the background image if needed
            background_path = None
            if len(background_image_paths) == 0:
                try:
                    background_path = self._generate_default_background_image(text, progress_callback)
                except Exception as e:
                    logger.error(f"Error generating default background: {e}")
                    background_path = self._get_fallback_image_path()
            else:
                try:
                    # Choose a random background from the list
                    background_path = random.choice(background_image_paths)
                except Exception as e:
                    logger.error(f"Error choosing background: {e}")
                    background_path = self._get_fallback_image_path()

            # Create the video clips
            image_clip = None
            text_clip = None
            final_clip = None
            
            try:
                # Create the background image clip
                logger.info(f"Creating background image clip from {background_path}")
                image_clip = ImageClip(background_path, duration=clip_duration)
                image_clip = image_clip.resize(height=self.height)
                image_clip = image_clip.resize(width=self.width)
                image_clip = image_clip.set_position("center")

                # Calculate text size based on video dimensions
                line_width = max(30, int(self.width * 0.03))
                font_size = max(24, int(self.height * 0.05))
                
                # Create the captioned text if requested
                if caption_style and caption_style.show_captions and text.strip():
                    # Create the text clip
                    logger.info(f"Creating text clip with text: {text}")
                    text_clip = TextClip(
                        text, 
                        font=caption_style.font or "Arial", 
                        fontsize=caption_style.font_size or font_size,
                        color=caption_style.font_color or "white",
                        bg_color=caption_style.background_color or None,
                        method="caption",
                        align="center",
                        size=(self.width * 0.8, None),
                        stroke_color=caption_style.stroke_color or None,
                        stroke_width=caption_style.stroke_width or 1,
                    )
                    text_clip = text_clip.set_position(("center", caption_style.position or "bottom"))
                    text_clip = text_clip.set_duration(clip_duration)
                
                # Combine image and text
                if text_clip:
                    final_clip = CompositeVideoClip([image_clip, text_clip], size=(self.width, self.height))
                else:
                    final_clip = image_clip
                
                final_clip = final_clip.set_duration(clip_duration)
                
                # Add audio if available
                if audio_clip:
                    # Double-check audio duration one more time
                    if audio_clip.duration > clip_duration + 0.1:
                        logger.warning(f"Audio still too long after truncation. Creating subclip with exact duration.")
                        audio_clip = audio_clip.subclip(0, clip_duration - 0.05)
                    
                    # Set audio to mono to avoid potential channel issues
                    try:
                        audio_clip = audio_clip.set_channels(1)
                    except Exception as audio_ch_error:
                        logger.warning(f"Failed to set audio to mono: {audio_ch_error}")
                        
                    final_clip = final_clip.set_audio(audio_clip)
                
                # Export the video with proper resource cleanup
                logger.info(f"Writing video to {output_path}")
                try:
                    final_clip.write_videofile(
                        output_path,
                        codec="libx264",
                        audio_codec="aac",
                        temp_audiofile=os.path.join(self.temp_dir, "temp_audio.m4a"),
                        remove_temp=True,
                        fps=24,
                        threads=2,
                        logger=None,
                    )
                    logger.info(f"Successfully created video at {output_path}")
                except Exception as write_error:
                    logger.error(f"Error writing video: {write_error}")
                    # If we fail due to audio issues, try without audio
                    if audio_clip:
                        try:
                            logger.warning("Trying to write video without audio due to previous error")
                            # Create a new clip without audio
                            silent_clip = final_clip.without_audio()
                            silent_clip.write_videofile(
                                output_path,
                                codec="libx264",
                                temp_audiofile=None,
                                remove_temp=True,
                                fps=24,
                                threads=2,
                                logger=None,
                            )
                        except Exception as silent_error:
                            logger.error(f"Error writing silent video: {silent_error}")
                            raise
                        finally:
                            try:
                                if silent_clip: silent_clip.close()
                            except:
                                pass
            except Exception as e:
                logger.error(f"Error creating video: {e}")
                raise
            finally:
                # Clean up resources
                try:
                    if audio_clip: audio_clip.close()
                    if image_clip: image_clip.close()
                    if text_clip: text_clip.close()
                    if final_clip: final_clip.close()
                except Exception as cleanup_error:
                    logger.error(f"Error cleaning up clips: {cleanup_error}")
                
            return output_path
        except Exception as e:
            logger.error(f"Error in _create_section_video: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise



