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
    VideoFileClip, VideoClip, TextClip, CompositeVideoClip, ImageClip,AudioClip,
    AudioFileClip, concatenate_videoclips, ColorClip, CompositeAudioClip, concatenate_audioclips
)
from moviepy.config import change_settings
change_settings({"IMAGEMAGICK_BINARY": "magick"}) # for windows users
# Individual effects imports instead of the entire vfx module
from moviepy.video.fx.loop import loop  # Import the loop effect specifically
from gtts import gTTS
from dotenv import load_dotenv
import shutil # for file operations like moving and deleting files
import tempfile # for creating temporary files
# Import text clip functions from shorts_maker_V
from .video_maker import YTShortsCreator_V
from datetime import datetime # for more detailed time tracking
import concurrent.futures # for multithreading
import sys  # for path manipulation
import math  # for math operations in duration calculations
from .parallel_renderer import is_shutdown_requested, render_clips_in_parallel

# Configure logging for easier debugging
# Do NOT initialize basicConfig here - this will be handled by main.py
logger = logging.getLogger(__name__)

# Helper function to check for shutdown
def should_abort_processing():
    """Check if processing should be aborted due to shutdown request"""
    return is_shutdown_requested()

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

        # Find system fonts or use default
        try:
            # Try to find system fonts directory
            if os.path.exists("/usr/share/fonts"):
                # Linux font path
                font_dirs = ["/usr/share/fonts"]
            elif os.path.exists("C:\\Windows\\Fonts"):
                # Windows font path
                font_dirs = ["C:\\Windows\\Fonts"]
            elif os.path.exists("/System/Library/Fonts"):
                # macOS font path
                font_dirs = ["/System/Library/Fonts"]
            else:
                font_dirs = [self.fonts_dir]

            # Try to find common fonts in the system directories
            font_found = False
            common_fonts = [
                "Arial.ttf", "arial.ttf",
                "Roboto-Regular.ttf", "Roboto-Bold.ttf",
                "OpenSans-Regular.ttf", "OpenSans-Bold.ttf",
                "Helvetica.ttf", "helvetica.ttf"
            ]

            for font_dir in font_dirs:
                for font_name in common_fonts:
                    font_path = os.path.join(font_dir, font_name)
                    if os.path.exists(font_path):
                        self.title_font_path = font_path
                        self.body_font_path = font_path
                        font_found = True
                        logger.info(f"Using system font: {font_path}")
                        break
                if font_found:
                    break

            # If no system fonts found, use the default
            if not font_found:
                self.title_font_path = os.path.join(self.fonts_dir, "default_font.ttf")
                self.body_font_path = os.path.join(self.fonts_dir, "default_font.ttf")
                logger.warning(f"No system fonts found, using default font path: {self.title_font_path}")

                # Check if default font exists, otherwise log a warning
                if not os.path.exists(self.title_font_path):
                    logger.warning(f"Default font not found at {self.title_font_path}. Text rendering may fail.")
        except Exception as e:
            # Fallback to default paths
            self.title_font_path = os.path.join(self.fonts_dir, "default_font.ttf")
            self.body_font_path = os.path.join(self.fonts_dir, "default_font.ttf")
            logger.error(f"Error setting up fonts: {e}")

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

        # Load API keys from environment
        load_dotenv()
        self.pexels_api_key = os.getenv("PEXELS_API_KEY")  # for fallback images
        self.huggingface_api_key = os.getenv("HUGGINGFACE_API_KEY")
        self.hf_model = os.getenv("HF_MODEL", "stabilityai/stable-diffusion-2-1")
        self.hf_api_url = f"https://api-inference.huggingface.co/models/{self.hf_model}"
        self.hf_headers = {"Authorization": f"Bearer {self.huggingface_api_key}"}

        # Unsplash API (for fallback)
        self.unsplash_api_key = os.getenv("UNSPLASH_API_KEY")
        self.unsplash_api_url = "https://api.unsplash.com/search/photos"

    @measure_time
    def _generate_image_from_prompt(self, prompt, style="photorealistic", file_path=None):
        """
        Generate an image using Hugging Face Diffusion API based on prompt
        With fallback to Unsplash if HuggingFace fails

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
            logger.error("No Hugging Face API key provided. Will fall back to Unsplash.")
            return self.fetch_image_unsplash(prompt)

        while not success and retry_count < max_retries:
            try:
                # Check if shutdown was requested
                if should_abort_processing():
                    logger.info("Shutdown requested, aborting image generation")
                    return None

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
                        logger.warning("Multiple 503 errors from Hugging Face API. Falling back to Unsplash.")
                        return self.fetch_image_unsplash(prompt)

                    retry_count += 1
            except requests.exceptions.RequestException as e:
                logger.error(f"Network error during image generation: {e}")
                retry_count += 1
                time.sleep(initial_wait_time)
            except Exception as e:
                logger.error(f"Unexpected exception during image generation: {e}")
                retry_count += 1
                time.sleep(initial_wait_time)

        # If all retries failed, return image from Unsplash as fallback
        if not success:
            logger.error("Failed to generate image with Hugging Face API after multiple attempts")
            return self.fetch_image_unsplash(prompt)

        return file_path

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

        # Check if Unsplash API key is available
        if not self.unsplash_api_key:
            logger.error("No Unsplash API key provided. Falling back to black background.")
            return self._create_black_background(file_path)

        try:
            # Clean query for Unsplash search
            clean_query = query.replace("eye-catching", "").replace("thumbnail", "")
            # Remove any double spaces
            while "  " in clean_query:
                clean_query = clean_query.replace("  ", " ")
            clean_query = clean_query.strip(" ,")

            logger.info(f"Searching Unsplash with query: {clean_query}")

            # Make request to Unsplash API
            params = {
                "query": clean_query,
                "orientation": "portrait",  # Portrait for shorts
                "per_page": 30,
                "client_id": self.unsplash_api_key
            }

            response = requests.get(self.unsplash_api_url, params=params, timeout=10)

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

                        # Process the image to ensure it's portrait oriented for shorts
                        try:
                            img = Image.open(file_path)
                            width, height = img.size

                            # Check if image needs to be reoriented
                            if width > height:
                                # Image is landscape, convert to portrait by cropping
                                logger.info("Converting landscape image to portrait orientation for shorts")
                                center = width / 2
                                left = center - (height / 2)
                                right = center + (height / 2)

                                # Crop to square from center, then resize
                                img = img.crop((int(left), 0, int(right), height))
                                img = img.resize((1080, 1920), Image.LANCZOS)
                                img.save(file_path, quality=95)
                            elif width < height and (height/width) < 1.77:  # Not tall enough for shorts
                                # Resize to maintain width but increase height
                                new_width = 1080
                                new_height = 1920
                                img = img.resize((new_width, new_height), Image.LANCZOS)
                                img.save(file_path, quality=95)

                            logger.info(f"Image processed to proper dimensions for shorts")
                        except Exception as e:
                            logger.error(f"Error processing Unsplash image: {e}")
                            # Continue with the original image

                        return file_path
                    else:
                        logger.error(f"Failed to download image from Unsplash: {img_response.status_code}")
                else:
                    logger.error("No results found on Unsplash")
            else:
                logger.error(f"Unsplash API error: {response.status_code} - {response.text}")

        except Exception as e:
            logger.error(f"Error fetching image from Unsplash: {e}")

        # Final fallback to a black background
        return self._create_black_background(file_path)

    @measure_time
    def _create_black_background(self, file_path):
        """
        Create a simple black background image as the ultimate fallback

        Args:
            file_path (str): Path to save the image

        Returns:
            str: Path to the created image
        """
        try:
            logger.info("Creating black background as ultimate fallback")

            # Create a black image in portrait mode for shorts
            img = Image.new('RGB', (1080, 1920), color=(0, 0, 0))

            # Save the image
            img.save(file_path, quality=95)
            logger.info(f"Black background image created at {file_path}")
            return file_path

        except Exception as e:
            logger.error(f"Error creating black background image: {e}")
            # If even this fails, just return none
            return None

    @measure_time
    def _fetch_stock_image(self, query):
        """
        This method is intentionally disabled. Fallback now uses shorts_maker_V instead.
        """
        logger.warning("Stock image fetch called but is disabled. Will fall back to shorts_maker_V.")
        return None

    @measure_time
    def _create_still_image_clip(self, image_path, duration, text=None, text_position=('center','center'),
                               font_size=60, with_zoom=True, zoom_factor=0.05):
        """
        Create a still image clip with optional text and zoom effect
        """
        try:
            # Check if the image exists
            if not os.path.exists(image_path):
                logger.error(f"Image not found at {image_path}, creating fallback")
                # Create a simple colored background as fallback
                color_clip = ColorClip(size=self.resolution, color=(33, 33, 33))
                color_clip = color_clip.set_duration(duration)

                # Add text if provided
                if text:
                    txt_clip = self.v_creator._create_text_clip(
                        text,
                        duration=duration,
                        font_size=font_size,
                        position=text_position,
                        with_pill=True
                    )
                    return CompositeVideoClip([color_clip, txt_clip], size=self.resolution)
                return color_clip

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

                image = image.resize(zoom)

            # Set the duration
            image = image.set_duration(duration)

            # Add text if provided
            if text:
                try:
                    # Calculate safe text position
                    if isinstance(text_position, tuple):
                        x_pos, y_pos = text_position
                    else:
                        x_pos = y_pos = text_position

                    # Convert string positions to numeric with safe margins
                    margin = int(font_size * 1.5)
                    screen_w, screen_h = self.resolution

                    if x_pos == 'center':
                        x_pos = screen_w // 2
                    elif x_pos == 'left':
                        x_pos = margin
                    elif x_pos == 'right':
                        x_pos = screen_w - margin

                    if y_pos == 'center':
                        y_pos = screen_h // 2
                    elif y_pos == 'top':
                        y_pos = margin
                    elif y_pos == 'bottom':
                        y_pos = screen_h - margin * 2  # Extra margin for bottom

                    # Create text clip with safe positioning
                    txt_clip = self.v_creator._create_text_clip(
                        text,
                        duration=duration,
                        font_size=font_size,
                        position=(x_pos, y_pos),
                        with_pill=True
                    )

                    # Combine image and text
                    return CompositeVideoClip([image, txt_clip], size=self.resolution)
                except Exception as e:
                    logger.error(f"Error creating text clip: {e}")
                    # Return just the image if text creation fails
                    return image
            return image
        except Exception as e:
            logger.error(f"Error creating still image clip: {e}")
            # Create a simple colored background as emergency fallback
            color_clip = ColorClip(size=self.resolution, color=(33, 33, 33))
            color_clip = color_clip.set_duration(duration)
            return color_clip

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
        # Create a unique identifier for this text and voice style combination
        # This enables proper caching to prevent duplicate generation
        import hashlib
        text_hash = hashlib.md5((text + str(voice_style)).encode()).hexdigest()

        if not filename:
            filename = os.path.join(self.temp_dir, f"tts_{text_hash}.mp3")

        # Check if this exact audio has already been generated
        if os.path.exists(filename):
            logger.info(f"Using cached audio file for: {text[:30]}...")
            # Verify the file is valid and not corrupted
            try:
                test_audio = AudioFileClip(filename)
                if test_audio.duration > 0:
                    test_audio.close()
                    return filename
                test_audio.close()
                logger.warning(f"Cached audio file has invalid duration, regenerating")
                # Delete corrupted file
                try:
                    os.remove(filename)
                except:
                    pass
            except Exception as e:
                logger.warning(f"Cached audio file is invalid: {e}, regenerating")
                # Delete corrupted file
                try:
                    os.remove(filename)
                except:
                    pass

        # Make sure text is not empty and has minimum length
        if not text or len(text.strip()) == 0:
            text = "No text provided"
        elif len(text.strip()) < 5:
            # For very short texts like "Check it out!", expand it slightly to ensure TTS works well
            text = text.strip() + "."  # Add period if missing

        # Try to use Google Cloud TTS if available
        if self.google_tts:
            try:
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

                return self.google_tts.generate_speech(text, output_filename=filename, voice_style=style)
            except Exception as e:
                logger.error(f"Google Cloud TTS failed: {e}, falling back to Azure TTS or gTTS")

        # Try to use Azure TTS if available
        if self.azure_tts:
            try:
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

                return self.azure_tts.generate_speech(text, output_filename=filename)
            except Exception as e:
                logger.error(f"Azure TTS failed: {e}, falling back to gTTS")

        # Fall back to gTTS with multiple retries
        retry_count = 0
        max_retries = 3

        while retry_count < max_retries:
            try:
                tts = gTTS(text=text, lang='en', slow=False)
                tts.save(filename)
                logger.info(f"Successfully created TTS audio: {filename}")
                return filename
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
            from moviepy.audio.AudioClip import AudioClip
            import numpy as np

            def make_frame(t):
                return np.zeros(2)  # Stereo silence

            silent_clip = AudioClip(make_frame=make_frame, duration=duration)
            silent_clip.write_audiofile(filename, fps=44100, nbytes=2, codec='libmp3lame')

            logger.info(f"Created silent audio clip as fallback: {filename}")
            return filename
        except Exception as e:
            logger.error(f"Failed to create even silent audio: {e}")
            return None

    @measure_time
    def add_watermark(self, clip, watermark_text="Lazycreator", position=("right", "top"), opacity=0.7, font_size=30):
        """
        Add a watermark to a video clip

        Args:
            clip (VideoClip): Video clip to add watermark to
            watermark_text (str): Text to display as watermark
            position (tuple): Position of watermark ('left'/'right', 'top'/'bottom')
            opacity (float): Opacity of watermark (0-1)
            font_size (int): Font size for watermark

        Returns:
            VideoClip: Clip with watermark added
        """
        # Create text clip for watermark
        watermark = TextClip(
            txt=watermark_text,
            fontsize=font_size,
            color='white',
            align='center'
        ).set_duration(clip.duration).set_opacity(opacity)

        # Calculate position
        if position[0] == "right":
            x_pos = clip.w - watermark.w - 20
        else:
            x_pos = 20

        if position[1] == "bottom":
            y_pos = clip.h - watermark.h - 20
        else:
            y_pos = 20

        watermark = watermark.set_position((x_pos, y_pos))

        # Add watermark to video
        return CompositeVideoClip([clip, watermark], size=self.resolution)

    @measure_time
    def create_youtube_short(self, title, script_sections, background_query="abstract background",
                        output_filename=None, add_captions=False, style="ANIME", voice_style=None, max_duration=30,
                        background_queries=None, blur_background=False, edge_blur=False, add_watermark_text=None,
                        custom_background_path=None, progress_callback=None):
        """
        Create a YouTube Short using AI-generated images for each script section
        Falls back to Unsplash images if image generation fails

        Args:
            title (str): Title of the short
            script_sections (list): List of dictionaries with text and duration for each section
            background_query (str): Fallback query for image generation
            output_filename (str): Output file path
            add_captions (bool): Whether to add captions to the video
            style (str): Style of images to generate (e.g., "digital art", "cinematic", "photorealistic")
            voice_style (str): Style of TTS voice
            max_duration (int): Maximum duration in seconds (10-30s)
            background_queries (list): List of queries for each section's background
            blur_background (bool): Whether to apply blur effect to backgrounds
            edge_blur (bool): Whether to apply edge blur to backgrounds
            add_watermark_text (str): Text to use as watermark (None for no watermark)
            custom_background_path (str): Path to custom background image if provided
            progress_callback (callable): Callback for progress reporting

        Returns:
            str: Path to the created video
        """
        try:
            # Set up a default progress callback if none provided
            if progress_callback is None:
                def update_progress(progress, message=""):
                    logger.info(f"Progress: {progress}%, {message}")
                progress_callback = update_progress
                
            # Initial progress report
            progress_callback(5, "Setting up for image-based short creation")
            
            if not output_filename:
                timestamp = int(time.time())
                output_filename = os.path.join(self.output_dir, f"youtube_short_{timestamp}.mp4")

            # Start timing the overall process
            overall_start_time = time.time()
            logger.info(f"Creating YouTube Short: {title}")

            # Ensure the output directory exists
            output_dir = os.path.dirname(output_filename)
            if output_dir:  # Only create directories if path is not empty
                os.makedirs(output_dir, exist_ok=True)
            else:
                # If output directory is empty, use the default output directory
                output_filename = os.path.join(self.output_dir, os.path.basename(output_filename))
                os.makedirs(self.output_dir, exist_ok=True)
                logger.info(f"Empty output directory path detected, using default: {output_filename}")

            # If custom background path is provided, validate it
            if custom_background_path:
                if not os.path.exists(custom_background_path):
                    logger.warning(f"Custom background path does not exist: {custom_background_path}")
                    custom_background_path = None
                else:
                    logger.info(f"Using custom background from: {custom_background_path}")

            # Enforce maximum duration between 10-30 seconds
            max_duration = min(max(10, max_duration), 30)
            logger.info(f"Using maximum duration of {max_duration} seconds")
            
            # Calculate total duration of script sections
            initial_total_duration = sum(section.get('duration', 5) for section in script_sections)
            
            # If total exceeds max_duration, scale all sections proportionally
            if initial_total_duration > max_duration:
                logger.info(f"Total duration ({initial_total_duration:.2f}s) exceeds max_duration ({max_duration}s), scaling sections")
                scale_factor = max_duration / initial_total_duration
                for section in script_sections:
                    section['duration'] = section.get('duration', 5) * scale_factor
                
                # Verify scaled durations
                new_total = sum(section.get('duration', 5) for section in script_sections)
                logger.info(f"After scaling: total duration = {new_total:.2f}s")

            # Progress update
            progress_callback(10, "Generating TTS audio for all script sections")
            
            # Generate audio for the entire script at once
            tts_start_time = time.time()
            logger.info(f"Starting unified TTS audio generation")

            # Combine all script sections into a single text with timestamps
            combined_text = ""
            section_starts = []
            current_position = 0
            
            for section in script_sections:
                section_text = section["text"]
                section_duration = section.get("duration", 5)
                
                # Add to combined text with a pause marker (period and space if needed)
                if combined_text and not combined_text.endswith('.'):
                    combined_text += ". "
                elif combined_text:
                    combined_text += " "
                
                section_starts.append((current_position, section_text, section_duration))
                combined_text += section_text
                current_position += len(section_text) + 1  # +1 for the space or period
            
            # Generate a single audio file for the entire script
            full_audio_path = None
            audio_clips = []
            
            try:
                # Create a single audio file for all sections
                full_audio_path = self._create_tts_audio(combined_text, voice_style=voice_style)
                
                if full_audio_path and os.path.exists(full_audio_path):
                    full_audio = AudioFileClip(full_audio_path)
                    total_audio_duration = full_audio.duration
                    logger.info(f"Generated full audio with duration: {total_audio_duration:.2f}s")
                    
                    # If the audio is too short or too long, adjust it
                    total_script_duration = sum(duration for _, _, duration in section_starts)
                    
                    if abs(total_audio_duration - total_script_duration) > 2.0:
                        logger.warning(f"Audio duration ({total_audio_duration:.2f}s) doesn't match script duration ({total_script_duration:.2f}s)")
                        
                        # Scale the audio to match the expected duration
                        if total_audio_duration > 0:
                            scale_factor = total_script_duration / total_audio_duration
                            # Instead of scaling, we'll distribute proportionally
                        else:
                            logger.error("Generated audio has zero duration, falling back to individual section generation")
                            raise ValueError("Zero duration audio generated")
                    
                    # Divide the audio into sections based on proportional text length
                    current_time = 0
                    audio_sections = []
                    
                    for i, (_, section_text, section_duration) in enumerate(section_starts):
                        # Calculate this section's proportion of the total audio
                        if total_script_duration > 0:
                            section_proportion = section_duration / total_script_duration
                        else:
                            section_proportion = 1.0 / len(section_starts)
                        
                        # Calculate audio duration for this section
                        audio_section_duration = total_audio_duration * section_proportion
                        
                        # Extract this section of audio
                        if current_time + audio_section_duration <= total_audio_duration:
                            section_audio = full_audio.subclip(current_time, current_time + audio_section_duration)
                        else:
                            # Handle edge case for last section
                            section_audio = full_audio.subclip(current_time, total_audio_duration)
                        
                        # Make sure the section matches the expected duration
                        if abs(section_audio.duration - section_duration) > 0.1:
                            # Either extend with silence or trim
                            if section_audio.duration < section_duration:
                                # Extend with silence
                                silence_duration = section_duration - section_audio.duration
                                def silent_frame(t):
                                    return np.zeros((2,))
                                silence = AudioClip(make_frame=silent_frame, duration=silence_duration)
                                silence = silence.set_fps(44100 if not hasattr(section_audio, 'fps') or section_audio.fps is None else section_audio.fps)
                                section_audio = concatenate_audioclips([section_audio, silence])
                            else:
                                # Trim
                                section_audio = section_audio.subclip(0, section_duration)
                        
                        # Store the audio section
                        audio_sections.append((i, section_audio, section_duration))
                        current_time += audio_section_duration
                    
                    # Use the divided sections
                    audio_clips = audio_sections
                    logger.info(f"Successfully divided full audio into {len(audio_clips)} sections")
                
                else:
                    logger.error("Failed to generate full audio file, falling back to per-section generation")
                    raise ValueError("Full audio generation failed")
                    
            except Exception as e:
                logger.warning(f"Error with unified audio approach: {e}. Falling back to per-section audio generation.")
                
                # Fall back to generating audio for each section individually (original approach)
                audio_clips = []
                section_durations = []
                
                # Use multithreading for audio generation to improve performance
                with concurrent.futures.ThreadPoolExecutor(max_workers=min(8, len(script_sections))) as executor:
                    # Create a list to hold future objects
                    future_to_section = {}
                    
                    # Submit TTS generation jobs to the executor
                    for i, section in enumerate(script_sections):
                        section_text = section["text"]
                        section_voice_style = section.get("voice_style", voice_style)
                        future = executor.submit(
                            self._create_tts_audio,
                            section_text,
                            None,
                            section_voice_style
                        )
                        future_to_section[future] = (i, section)
                    
                    # Process results as they complete
                    for future in concurrent.futures.as_completed(future_to_section):
                        i, section = future_to_section[future]
                        min_section_duration = section.get("duration", 5)
                        
                        try:
                            audio_path = future.result()
                            
                            # Process the completed audio file
                            if audio_path and os.path.exists(audio_path):
                                try:
                                    # Get actual audio duration
                                    audio_clip = None
                                    try:
                                        audio_clip = AudioFileClip(audio_path)
                                        actual_duration = audio_clip.duration
                                        
                                        # Check if audio has valid duration
                                        if actual_duration <= 0:
                                            logger.warning(f"Audio file for section {i} has zero duration, creating fallback silent audio")
                                            # Close the current clip to prevent file handle leaks
                                            try:
                                                audio_clip.close()
                                            except:
                                                pass
                                            
                                            # Create silent audio clip as fallback
                                            def silent_frame(t):
                                                return np.zeros(2)  # Stereo silence
                                            silent_audio = AudioClip(make_frame=silent_frame, duration=min_section_duration)
                                            silent_audio = silent_audio.set_fps(44100)
                                            audio_clips.append((i, silent_audio, min_section_duration))
                                        else:
                                            audio_clips.append((i, audio_clip, actual_duration))
                                            section_durations.append((i, min(actual_duration, min_section_duration)))
                                    except Exception as e:
                                        logger.error(f"Error processing audio for section {i}: {e}")
                                        # Close the clip if it was created
                                        if audio_clip:
                                            try:
                                                audio_clip.close()
                                            except:
                                                pass
                                        
                                        # Add default duration since audio processing failed
                                        section_durations.append((i, min_section_duration))
                                        
                                        # Create silent audio clip as fallback
                                        def silent_frame(t):
                                            return np.zeros(2)  # Stereo silence
                                        silent_audio = AudioClip(make_frame=silent_frame, duration=min_section_duration)
                                        silent_audio = silent_audio.set_fps(44100)
                                        audio_clips.append((i, silent_audio, min_section_duration))
                                except Exception as e:
                                    logger.error(f"Error processing audio for section {i}: {e}")
                                    section_durations.append((i, min_section_duration))
                                    
                                    # Create silent audio clip as fallback
                                    def silent_frame(t):
                                        return np.zeros(2)  # Stereo silence
                                    silent_audio = AudioClip(make_frame=silent_frame, duration=min_section_duration)
                                    silent_audio = silent_audio.set_fps(44100)
                                    audio_clips.append((i, silent_audio, min_section_duration))
                            else:
                                # If no audio was created, use minimum duration and create silent audio
                                section_durations.append((i, min_section_duration))
                                
                                # Create silent audio clip as fallback
                                def silent_frame(t):
                                    return np.zeros(2)  # Stereo silence
                                silent_audio = AudioClip(make_frame=silent_frame, duration=min_section_duration)
                                silent_audio = silent_audio.set_fps(44100)
                                audio_clips.append((i, silent_audio, min_section_duration))
                        except Exception as e:
                            logger.error(f"Error getting TTS result for section {i}: {e}")
                            section_durations.append((i, min_section_duration))
                            
                            # Create silent audio clip as fallback
                            def silent_frame(t):
                                return np.zeros(2)  # Stereo silence
                            silent_audio = AudioClip(make_frame=silent_frame, duration=min_section_duration)
                            silent_audio = silent_audio.set_fps(44100)
                            audio_clips.append((i, silent_audio, min_section_duration))
                
                # Sort durations by section index
                section_durations.sort(key=lambda x: x[0])
                
                # Update script sections with actual durations
                for i, duration in section_durations:
                    if i < len(script_sections):
                        script_sections[i]['duration'] = duration
                
                # Recalculate total duration based on actual audio lengths
                total_duration = sum(duration for _, duration in section_durations)
                
                # Enforce max duration again if needed
                if total_duration > max_duration:
                    scale_factor = max_duration / total_duration
                    logger.info(f"Scaling sections again to fit max_duration (factor: {scale_factor:.3f})")
                    
                    # Scale all durations
                    for i, (idx, duration) in enumerate(section_durations):
                        scaled_duration = duration * scale_factor
                        section_durations[i] = (idx, scaled_duration)
                        
                        # Also update the script sections
                        if idx < len(script_sections):
                            script_sections[idx]['duration'] = scaled_duration
                    
                    # Scale audio clips
                    for i, (idx, clip, _) in enumerate(audio_clips):
                        new_duration = section_durations[i][1]
                        audio_clips[i] = (idx, clip, new_duration)
                    
                    # Update total duration
                    total_duration = sum(duration for _, duration in section_durations)
            
            logger.info(f"Completed audio generation in {time.time() - tts_start_time:.2f} seconds")
            logger.info(f"Final total audio duration: {total_duration:.1f}s")

            # Progress update
            progress_callback(25, "Generating background images")

            # Process each section
            section_clips = []

            # Check if using a custom background for all sections
            if custom_background_path and os.path.exists(custom_background_path):
                logger.info(f"Using custom background for all sections: {custom_background_path}")
                # Use the same background for all sections
                custom_bg_for_all = True
                # Check file extension
                _, ext = os.path.splitext(custom_background_path)
                if ext.lower() in ['.jpg', '.jpeg', '.png', '.webp']:
                    logger.info("Custom background is an image")
                else:
                    logger.error(f"Unsupported background file type: {ext}")
                    custom_bg_for_all = False
            else:
                custom_bg_for_all = False

            # Process each section for image generation
            section_images = []

            # Generate images for all sections in parallel for efficiency
            with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, len(script_sections))) as executor:
                section_futures = []

                for i, section in enumerate(script_sections):
                    # If using custom background for all, skip image generation
                    if custom_bg_for_all:
                        # Create a unique copy for each section to avoid reuse of same object
                        section_image_path = os.path.join(self.temp_dir, f"section_{i}_custom_bg.jpg")
                        shutil.copy(custom_background_path, section_image_path)
                        section_images.append((i, section_image_path))
                        logger.info(f"Created copy of custom background for section {i}")
                        continue

                    # Get the appropriate query for this section
                    if background_queries and i < len(background_queries):
                        img_query = background_queries[i]
                    else:
                        img_query = background_query

                    # Add some randomization to ensure different images even with similar queries
                    diversified_query = f"{img_query} {random.choice(['view', 'scene', 'perspective', 'style', 'image'])} {i+1}"
                    logger.info(f"Section {i} using query: {diversified_query}")

                    # Submit the image generation task
                    future = executor.submit(
                        self._generate_image_from_prompt,
                        diversified_query,
                        style
                    )
                    section_futures.append((i, future))

                # Update progress as futures complete
                completed = 0
                for i, future in section_futures:
                    try:
                        image_path = future.result()
                        section_images.append((i, image_path))

                        # Update progress
                        completed += 1
                        progress_pct = 25 + (completed / len(section_futures)) * 25
                        progress_callback(int(progress_pct), f"Generated image {completed}/{len(section_futures)}")

                    except Exception as e:
                        logger.error(f"Error generating image for section {i}: {e}")
                        # Use a black background image as fallback
                        fallback_path = self._create_black_background(
                            os.path.join(self.temp_dir, f"black_fallback_{i}.jpg")
                        )
                        section_images.append((i, fallback_path))

            # Sort the section images by index
            section_images.sort(key=lambda x: x[0])

            # Progress update
            progress_callback(50, "Creating video clips from images")

            # Now create video clips for each section
            for i, section in enumerate(script_sections):
                if should_abort_processing():
                    logger.info("Shutdown requested during section processing")
                    return None

                section_text = section["text"]
                section_duration = section["duration"]
                logger.info(f"Processing section {i}: {section_text[:30]}... (duration: {section_duration:.2f}s)")

                # Get the image path for this section
                _, image_path = section_images[i]

                # Ensure the image exists and is valid
                if not os.path.exists(image_path):
                    logger.error(f"Image path for section {i} does not exist: {image_path}")
                    # Create a fallback image
                    image_path = self._create_black_background(
                        os.path.join(self.temp_dir, f"fallback_section_{i}.jpg")
                    )
                    logger.info(f"Created fallback background for section {i}")

                try:
                    # Apply blur to image if requested
                    if blur_background or edge_blur:
                        try:
                            img = Image.open(image_path)
                            if blur_background:
                                img = img.filter(ImageFilter.GaussianBlur(radius=5))
                            if edge_blur:
                                # Create a mask for edge blur (darker at edges)
                                mask = Image.new('L', img.size, 255)
                                draw = ImageDraw.Draw(mask)
                                blur_width = int(min(img.width, img.height) * 0.1)  # 10% of smaller dimension
                                for i in range(blur_width):
                                    # Draw darker rectangle for each step, creating a gradient
                                    value = int(255 * (i / blur_width))
                                    draw.rectangle(
                                        [i, i, img.width - i, img.height - i],
                                        outline=value
                                    )
                                # Apply the mask
                                blurred_img = img.filter(ImageFilter.GaussianBlur(radius=10))
                                result = img.copy()
                                result.paste(blurred_img, mask=mask)
                                img = result

                            # Save the processed image
                            processed_path = os.path.join(self.temp_dir, f"processed_{os.path.basename(image_path)}")
                            img.save(processed_path)
                            image_path = processed_path
                            logger.info(f"Applied blur effects to image for section {i}")
                        except Exception as e:
                            logger.error(f"Error applying blur to image: {e}")

                    # Create base image clip
                    base_clip = self._create_still_image_clip(
                        image_path,
                        duration=section_duration,
                        with_zoom=True,
                        zoom_factor=0.05  # Subtle zoom
                    )

                    # Components to overlay on the base clip
                    components = [base_clip]

                    # Add title text (only to first section)
                    if i == 0 and title:
                        title_clip = self.v_creator._create_text_clip(
                            title,
                            duration=section_duration,
                            font_size=70,
                            position=("center", 150),
                            animation="fade",
                            animation_duration=0.8,
                            with_pill=True,
                            pill_color=(0, 0, 0, 180),
                            pill_radius=30
                        )
                        components.append(title_clip)

                    # Add text overlay for content ONLY if caption is required
                    # Text overlays in the middle should NOT be treated as captions
                    # For the first and last sections, use simple text
                    if i == 0 or i == len(script_sections) - 1:
                        # Create text overlay
                        section_text_clip = self.v_creator._create_text_clip(
                            section_text,
                            duration=section_duration,
                            font_size=60,
                            position=('center', 'center'),
                            animation="fade",
                            animation_duration=0.8,
                            with_pill=True,
                            pill_color=(0, 0, 0, 160),
                            pill_radius=30
                        )
                    else:
                        # For middle sections, use word-by-word animation for more engagement
                        try:
                            section_text_clip = self.v_creator._create_word_by_word_clip(
                                text=section_text,
                                duration=section_duration,
                                font_size=60,
                                position=('center', 'center'),
                                text_color=(255, 255, 255, 255),
                                pill_color=(0, 0, 0, 160)
                            )
                        except Exception as e:
                            logger.error(f"Error creating word-by-word clip: {e}, falling back to standard text")
                            # Fallback to standard text clip
                            section_text_clip = self.v_creator._create_text_clip(
                                section_text,
                                duration=section_duration,
                                font_size=60,
                                position=('center', 'center'),
                                animation="fade",
                                animation_duration=0.8,
                                with_pill=True,
                                pill_color=(0, 0, 0, 160),
                                pill_radius=30
                            )

                    components.append(section_text_clip)

                    # Combine all components
                    section_clip = CompositeVideoClip(components, size=self.resolution)

                    # Add audio if available
                    for idx, audio_clip, audio_duration in audio_clips:
                        if idx == i:
                            try:
                                # Verify audio clip is valid and can be accessed
                                try:
                                    # Test accessing the audio to make sure it's valid
                                    test_frame = audio_clip.get_frame(0)
                                    if test_frame is None:
                                        raise ValueError("Audio clip returned None frame")
                                except Exception as audio_test_error:
                                    logger.error(f"Audio clip validation failed: {audio_test_error}")
                                    # Create a silent audio clip as fallback
                                    from moviepy.audio.AudioClip import AudioClip
                                    import numpy as np
                                    def silent_frame(t):
                                        return np.zeros(2)
                                    audio_clip = AudioClip(make_frame=silent_frame, duration=section_duration)
                                    audio_clip = audio_clip.set_fps(44100)
                                    audio_duration = section_duration
                                    logger.warning(f"Created fallback silent audio for section {i}")

                                # Create a fresh copy of the audio to avoid shared references
                                audio_clip = audio_clip.copy()

                                # If audio duration doesn't match section duration, adjust
                                if abs(audio_duration - section_duration) > 0.1:
                                    # Cut audio if too long
                                    if audio_duration > section_duration:
                                        audio_clip = audio_clip.subclip(0, section_duration)
                                        logger.info(f"Trimmed audio from {audio_duration:.2f}s to {section_duration:.2f}s")
                                    else:
                                        # Handle short audio by padding with silence
                                        from moviepy.audio.AudioClip import AudioClip, CompositeAudioClip
                                        import numpy as np

                                        # Calculate extension needed
                                        extension_needed = section_duration - audio_duration
                                        logger.info(f"Extending audio for section {i} by {extension_needed:.2f}s")

                                        # Create a silent clip for padding
                                        def silent_frame(t):
                                            return np.zeros(2)

                                        silence = AudioClip(make_frame=silent_frame, duration=extension_needed)
                                        silence = silence.set_fps(44100 if not hasattr(audio_clip, 'fps') or audio_clip.fps is None else audio_clip.fps)

                                        # Set exact durations to avoid floating point issues
                                        audio_clip = audio_clip.set_duration(audio_duration)

                                        # Create a composite audio with original followed by silence
                                        extended_audio = CompositeAudioClip([
                                            audio_clip,
                                            silence.set_start(audio_duration)
                                        ])

                                        # Explicitly set the duration of the composite audio
                                        extended_audio = extended_audio.set_duration(section_duration)
                                        audio_clip = extended_audio
                                else:
                                    # Even if durations are close, explicitly set to ensure exact match
                                    audio_clip = audio_clip.set_duration(section_duration)

                                # Verify the final audio duration before adding to clip
                                final_audio_duration = audio_clip.duration
                                if abs(final_audio_duration - section_duration) > 0.01:
                                    logger.warning(f"Audio duration mismatch: audio={final_audio_duration:.2f}s, section={section_duration:.2f}s")
                                    # Force the exact duration to avoid any floating point differences
                                    audio_clip = audio_clip.set_duration(section_duration)

                                # Set the audio on the section clip
                                section_clip = section_clip.set_audio(audio_clip)
                                logger.info(f"Added audio to section {i} (duration: {section_duration:.2f}s)")
                            except Exception as e:
                                logger.error(f"Error adding audio to section {i}: {e}")
                                # Create a silent fallback audio if there was an error
                                try:
                                    from moviepy.audio.AudioClip import AudioClip
                                    import numpy as np
                                    def silent_frame(t):
                                        return np.zeros(2)
                                    silent_audio = AudioClip(make_frame=silent_frame, duration=section_duration)
                                    silent_audio = silent_audio.set_fps(44100)
                                    section_clip = section_clip.set_audio(silent_audio)
                                    logger.warning(f"Added silent fallback audio to section {i}")
                                except Exception as silent_error:
                                    logger.error(f"Failed to add silent audio: {silent_error}")
                            break

                    # Add section clip to list
                    section_clips.append(section_clip)

                except Exception as e:
                    logger.error(f"Error creating clip for section {i}: {e}")
                    # Create a simple fallback clip with text
                    color_clip = ColorClip(size=self.resolution, color=(33, 33, 33))
                    color_clip = color_clip.set_duration(section_duration)

                    # Add text
                    txt_clip = self.v_creator._create_text_clip(
                        section_text,
                        duration=section_duration,
                        font_size=60,
                        position=('center', 'center'),
                        with_pill=True
                    )

                    fallback_clip = CompositeVideoClip([color_clip, txt_clip], size=self.resolution)

                    # Add audio if available
                    for idx, audio_clip, _ in audio_clips:
                        if idx == i:
                            try:
                                fallback_clip = fallback_clip.set_audio(audio_clip)
                            except:
                                pass
                            break

                    section_clips.append(fallback_clip)

            # Progress update
            progress_callback(75, "Concatenating video clips")

            # Check if we have any clips
            if not section_clips:
                logger.error("No clips were created, cannot create video")
                return None

            logger.info(f"Successfully processed {len(section_clips)}/{len(script_sections)} sections")

            # Validate that each clip has unique content and valid audio
            logger.info("Validating section clips to ensure uniqueness and valid audio...")
            validated_clips = []

            for i, clip in enumerate(section_clips):
                try:
                    # Make sure each clip has proper duration
                    if clip.duration <= 0:
                        logger.error(f"Clip {i} has invalid duration: {clip.duration}s, creating fallback")
                        # Create fallback clip with proper duration
                        section_duration = script_sections[i]['duration'] if i < len(script_sections) else 5
                        fallback_clip = ColorClip(size=self.resolution, color=(33, 33, 33)).set_duration(section_duration)

                        # Add text if available
                        if i < len(script_sections):
                            section_text = script_sections[i]['text']
                            try:
                                txt_clip = self.v_creator._create_text_clip(
                                    section_text,
                                    duration=section_duration,
                                    font_size=60,
                                    position=('center', 'center'),
                                    with_pill=True
                                )
                                fallback_clip = CompositeVideoClip([fallback_clip, txt_clip], size=self.resolution)
                            except Exception as e:
                                logger.error(f"Error adding text to fallback clip: {e}")

                        # Add silent audio
                        def silent_frame(t):
                            return np.zeros(2)
                        silent_audio = AudioClip(make_frame=silent_frame, duration=section_duration)
                        silent_audio = silent_audio.set_fps(44100)
                        fallback_clip = fallback_clip.set_audio(silent_audio)

                        # Use fallback clip
                        clip = fallback_clip

                    # Ensure each clip has valid audio, or add silent audio
                    if clip.audio is None:
                        logger.warning(f"Clip {i} has no audio, adding silent audio")
                        from moviepy.audio.AudioClip import AudioClip
                        import numpy as np
                        def silent_frame(t):
                            return np.zeros(2)
                        silent_audio = AudioClip(make_frame=silent_frame, duration=clip.duration)
                        silent_audio = silent_audio.set_fps(44100)
                        clip = clip.set_audio(silent_audio)
                    else:
                        # Verify audio duration matches clip duration
                        audio_duration = clip.audio.duration
                        if abs(audio_duration - clip.duration) > 0.01:
                            logger.warning(f"Clip {i} audio duration mismatch: {audio_duration:.2f}s vs {clip.duration:.2f}s, fixing")
                            # Force audio duration to match clip duration exactly
                            clip.audio = clip.audio.set_duration(clip.duration)

                    # Test that the audio can be accessed at the clip's duration
                    try:
                        if clip.audio is not None:
                            # Test accessing a frame at the start
                            _ = clip.audio.get_frame(0)
                            # Test accessing a frame near the end (but not exactly at the end)
                            end_time = max(0, clip.duration - 0.1)
                            _ = clip.audio.get_frame(end_time)
                    except Exception as audio_test_error:
                        logger.error(f"Clip {i} audio failed validation: {audio_test_error}, replacing with silent audio")
                        # Replace with silent audio
                        from moviepy.audio.AudioClip import AudioClip
                        import numpy as np
                        def silent_frame(t):
                            return np.zeros(2)
                        silent_audio = AudioClip(make_frame=silent_frame, duration=clip.duration)
                        silent_audio = silent_audio.set_fps(44100)
                        clip = clip.set_audio(silent_audio)

                    # If this is valid, add to our validated clips
                    validated_clips.append(clip)
                    logger.info(f"Validated clip {i}: duration={clip.duration:.2f}s, has_valid_audio={clip.audio is not None}")
                except Exception as validation_error:
                    logger.error(f"Error validating clip {i}: {validation_error}, creating fallback clip")

                    # Create fallback clip with proper duration
                    section_duration = script_sections[i]['duration'] if i < len(script_sections) else 5
                    fallback_clip = ColorClip(size=self.resolution, color=(33, 33, 33)).set_duration(section_duration)

                    # Add text if available
                    if i < len(script_sections):
                        section_text = script_sections[i]['text']
                        try:
                            txt_clip = self.v_creator._create_text_clip(
                                section_text,
                                duration=section_duration,
                                font_size=60,
                                position=('center', 'center'),
                                with_pill=True
                            )
                            fallback_clip = CompositeVideoClip([fallback_clip, txt_clip], size=self.resolution)
                        except Exception as e:
                            logger.error(f"Error adding text to fallback clip: {e}")

                    # Add silent audio
                    def silent_frame(t):
                        return np.zeros(2)
                    silent_audio = AudioClip(make_frame=silent_frame, duration=section_duration)
                    silent_audio = silent_audio.set_fps(44100)
                    fallback_clip = fallback_clip.set_audio(silent_audio)

                    # Add to validated clips
                    validated_clips.append(fallback_clip)
                    logger.info(f"Added fallback clip for section {i} with duration {section_duration}s")

            # Replace our section clips with validated ones
            if validated_clips:
                section_clips = validated_clips
                logger.info(f"Using {len(section_clips)} validated clips")
            else:
                logger.error("No valid clips found after validation, creating basic fallback video")

                # Create basic fallback video with the proper duration
                fallback_duration = min(15, max_duration)  # Default to 15 seconds or max_duration if shorter
                logger.info(f"Creating fallback video of {fallback_duration} seconds")

                fallback_clip = ColorClip(size=self.resolution, color=(0, 0, 0)).set_duration(fallback_duration)

                # Add title text if available
                if title:
                    try:
                        title_txt = self.v_creator._create_text_clip(
                            title,
                            duration=fallback_duration,
                            font_size=70,
                            position=('center', 'center'),
                            with_pill=True
                        )
                        fallback_clip = CompositeVideoClip([fallback_clip, title_txt], size=self.resolution)
                    except Exception as e:
                        logger.error(f"Error adding title to fallback clip: {e}")

                # Add silent audio
                from moviepy.audio.AudioClip import AudioClip
                import numpy as np
                def silent_frame(t):
                    return np.zeros(2)
                silent_audio = AudioClip(make_frame=silent_frame, duration=fallback_duration)
                silent_audio = silent_audio.set_fps(44100)
                fallback_clip = fallback_clip.set_audio(silent_audio)

                # Set as single section clip
                section_clips = [fallback_clip]

            # Add captions at the bottom if requested
            # This is the ONLY place captions should be added at the bottom when add_captions=True
            if add_captions and section_clips:
                for i, clip in enumerate(section_clips):
                    if i < len(script_sections):
                        section_text = script_sections[i]['text']
                        try:
                            caption = self.v_creator._create_text_clip(
                                section_text,
                                duration=clip.duration,
                                font_size=40,
                                font_path=self.body_font_path,
                                position=('center', self.resolution[1] - 200),
                                animation="fade",
                                animation_duration=0.5,
                                with_pill=True
                            )
                            section_clips[i] = CompositeVideoClip([clip, caption], size=self.resolution)
                        except Exception as e:
                            logger.error(f"Error adding captions to section {i}: {e}")

            # Use parallel rendering if available
            try:
                # Check for dill library - needed for optimal parallel rendering
                try:
                    import dill
                    logger.info(f"Found dill {dill.__version__} for improved serialization")
                except ImportError:
                    logger.warning("Dill library not found - parallel rendering may be less efficient")

                from .parallel_renderer import render_clips_in_parallel
                logger.info("Using parallel renderer for improved performance")

                # Create temp directory for parallel rendering
                parallel_temp_dir = os.path.join(self.temp_dir, "parallel_render")
                os.makedirs(parallel_temp_dir, exist_ok=True)

                # Log all clips before concatenation for debugging
                total_clip_duration = 0
                for i, clip in enumerate(section_clips):
                    total_clip_duration += clip.duration
                    logger.info(f"Clip {i} before concatenation: duration={clip.duration:.2f}s, " +
                               f"has_audio={clip.audio is not None}")

                logger.info(f"Total duration of all clips: {total_clip_duration:.2f}s (target: {max_duration}s)")

                # Verify we have enough duration
                if total_clip_duration < max_duration * 0.5:  # If we have less than 50% of target duration
                    logger.warning(f"Total clip duration ({total_clip_duration:.2f}s) is much less than target ({max_duration}s)")

                    # Add padding to reach at least 75% of the target duration
                    min_acceptable_duration = max_duration * 0.75
                    if total_clip_duration < min_acceptable_duration:
                        padding_needed = min_acceptable_duration - total_clip_duration
                        logger.info(f"Adding padding clip of {padding_needed:.2f}s to reach minimum duration")

                        # Create a simple padding clip
                        padding_clip = ColorClip(size=self.resolution, color=(0, 0, 0)).set_duration(padding_needed)

                        # Add audio silence
                        from moviepy.audio.AudioClip import AudioClip
                        import numpy as np
                        def silent_frame(t):
                            return np.zeros(2)
                        silent_audio = AudioClip(make_frame=silent_frame, duration=padding_needed)
                        silent_audio = silent_audio.set_fps(44100)
                        padding_clip = padding_clip.set_audio(silent_audio)

                        # Add to section clips
                        section_clips.append(padding_clip)
                        logger.info(f"Added padding clip with duration {padding_needed:.2f}s")

                        # Update total duration
                        total_clip_duration = sum(clip.duration for clip in section_clips)
                        logger.info(f"New total duration after padding: {total_clip_duration:.2f}s")

                # Add extra safety for audio duration before concatenation
                try:
                    for i, clip in enumerate(section_clips):
                        if clip.audio is not None and clip.audio.duration != clip.duration:
                            logger.warning(f"Fixing duration mismatch for clip {i} before concatenation: " +
                                          f"audio={clip.audio.duration:.2f}s, video={clip.duration:.2f}s")

                            # Create a completely new audio clip with exact duration
                            from moviepy.audio.AudioClip import AudioClip
                            original_audio = clip.audio

                            # Create a wrapper function that ensures we only access within the audio duration
                            def safe_make_frame(t):
                                if t < original_audio.duration:
                                    return original_audio.get_frame(t)
                                else:
                                    # Return silence for time beyond audio duration
                                    return np.zeros(2)  # Stereo silence

                            # Create a new audio clip with the safe frame function
                            safe_audio = AudioClip(make_frame=safe_make_frame, duration=clip.duration)
                            if hasattr(original_audio, 'fps') and original_audio.fps:
                                safe_audio = safe_audio.set_fps(original_audio.fps)
                            else:
                                safe_audio = safe_audio.set_fps(44100)

                            # Replace the audio
                            clip = clip.set_audio(safe_audio)
                            section_clips[i] = clip
                            logger.info(f"Created safe audio wrapper for clip {i}")
                except Exception as safe_audio_error:
                    logger.error(f"Error creating safe audio wrappers: {safe_audio_error}")

                # Now concatenate the clips
                try:
                    # Log what we're about to do
                    logger.info(f"Concatenating {len(section_clips)} clips with method='compose'")

                    # Concatenate all clips
                    final_clip = concatenate_videoclips(section_clips, method="compose")

                    # Log the final concatenated clip
                    logger.info(f"Final concatenated clip: duration={final_clip.duration:.2f}s, " +
                               f"has_audio={final_clip.audio is not None}")

                    # Verify the concatenated duration is correct
                    if abs(final_clip.duration - total_clip_duration) > 0.5:  # More than half second difference
                        logger.warning(f"Concatenated duration ({final_clip.duration:.2f}s) doesn't match " +
                                      f"expected total duration ({total_clip_duration:.2f}s)")
                except Exception as concat_error:
                    logger.error(f"Error during clip concatenation: {concat_error}")

                    # If concatenation fails, try with a different method
                    try:
                        logger.warning("Trying alternative concatenation method")
                        # Try simple method without audio first
                        temp_clips = []
                        for clip in section_clips:
                            # Remove audio temporarily
                            temp_clip = clip.without_audio()
                            temp_clips.append(temp_clip)

                        # Concatenate videos without audio
                        logger.info(f"Trying alternative concatenation with {len(temp_clips)} clips")
                        final_clip = concatenate_videoclips(temp_clips, method="compose")

                        # Now create a composite audio from all the original audio clips
                        audio_clips = []
                        current_time = 0
                        for clip in section_clips:
                            if clip.audio is not None:
                                # Set the start time for this audio clip
                                audio_clip = clip.audio.set_start(current_time)
                                audio_clips.append(audio_clip)
                            current_time += clip.duration

                        if audio_clips:
                            # Combine all audio clips
                            from moviepy.audio.AudioClip import CompositeAudioClip
                            final_audio = CompositeAudioClip(audio_clips)
                            final_clip = final_clip.set_audio(final_audio)
                        else:
                            # If no audio clips, create silent audio
                            from moviepy.audio.AudioClip import AudioClip
                            import numpy as np
                            def silent_frame(t):
                                return np.zeros(2)
                            silent_audio = AudioClip(make_frame=silent_frame, duration=final_clip.duration)
                            silent_audio = silent_audio.set_fps(44100)
                            final_clip = final_clip.set_audio(silent_audio)

                        logger.info(f"Created composite video with duration={final_clip.duration:.2f}s")
                    except Exception as fallback_error:
                        logger.error(f"Alternative concatenation also failed: {fallback_error}")

                        # Last resort: create a single clip with the desired duration
                        try:
                            logger.warning("All concatenation methods failed. Creating single clip with target duration.")
                            final_duration = min(15, max_duration)  # Default to 15 seconds or max_duration if shorter

                            # Create a basic clip
                            final_clip = ColorClip(size=self.resolution, color=(0, 0, 0)).set_duration(final_duration)

                            # Add text if we have a title
                            if title:
                                title_txt = self.v_creator._create_text_clip(
                                    title,
                                    duration=final_duration,
                                    font_size=70,
                                    position=('center', 'center'),
                                    with_pill=True
                                )
                                final_clip = CompositeVideoClip([final_clip, title_txt], size=self.resolution)

                            # Add silent audio
                            from moviepy.audio.AudioClip import AudioClip
                            import numpy as np
                            def silent_frame(t):
                                return np.zeros(2)
                            silent_audio = AudioClip(make_frame=silent_frame, duration=final_duration)
                            silent_audio = silent_audio.set_fps(44100)
                            final_clip = final_clip.set_audio(silent_audio)

                            logger.info(f"Created last-resort clip with duration {final_duration:.2f}s")
                        except Exception as e:
                            logger.error(f"Failed to create even a basic clip: {e}")
                            raise ValueError("Failed to create any usable video after multiple attempts")

                # Ensure we don't exceed maximum duration
                if final_clip.duration > max_duration:
                    logger.warning(f"Video exceeds maximum duration ({final_clip.duration}s > {max_duration}s), trimming")
                    final_clip = final_clip.subclip(0, max_duration)

                # Log final duration after any trimming
                logger.info(f"Final video duration: {final_clip.duration:.2f}s")

                # Add watermark if requested
                if add_watermark_text:
                    final_clip = self.add_watermark(final_clip, watermark_text=add_watermark_text)

                # Progress update
                progress_callback(85, "Rendering final video")

                # Render clips in parallel
                render_start_time = time.time()
                logger.info(f"Starting parallel video rendering")

                # Make sure the final clip has the proper duration before rendering
                logger.info(f"Final clip duration before rendering: {final_clip.duration:.2f}s")
                if final_clip.duration < max_duration * 0.75:
                    logger.warning(f"Final duration ({final_clip.duration:.2f}s) is significantly less than target ({max_duration}s)")

                output_filename = render_clips_in_parallel(
                    [final_clip],
                    output_filename,
                    temp_dir=parallel_temp_dir,
                    fps=self.fps,
                    preset="veryfast"
                )

                logger.info(f"Completed video rendering in {time.time() - render_start_time:.2f} seconds")

            except Exception as e:
                logger.warning(f"Parallel renderer failed: {e}. Using standard rendering.")

                # Concatenate all clips
                concat_start_time = time.time()
                logger.info(f"Starting standard video rendering")

                # Log all clips before concatenation for debugging
                for i, clip in enumerate(section_clips):
                    logger.info(f"Clip {i} before concatenation: duration={clip.duration:.2f}s, " +
                               f"has_audio={clip.audio is not None}")

                # Calculate total expected duration
                expected_duration = sum(clip.duration for clip in section_clips)
                logger.info(f"Expected total duration: {expected_duration:.2f}s (target: {max_duration}s)")

                # Add padding if needed
                if expected_duration < max_duration * 0.75:
                    padding_needed = max_duration * 0.75 - expected_duration
                    logger.info(f"Adding padding clip of {padding_needed:.2f}s to reach minimum duration")

                    # Create a simple padding clip
                    padding_clip = ColorClip(size=self.resolution, color=(0, 0, 0)).set_duration(padding_needed)

                    # Add audio silence
                    from moviepy.audio.AudioClip import AudioClip
                    import numpy as np
                    def silent_frame(t):
                        return np.zeros(2)
                    silent_audio = AudioClip(make_frame=silent_frame, duration=padding_needed)
                    silent_audio = silent_audio.set_fps(44100)
                    padding_clip = padding_clip.set_audio(silent_audio)

                    # Add to section clips
                    section_clips.append(padding_clip)
                    expected_duration += padding_needed
                    logger.info(f"Added padding clip, new expected duration: {expected_duration:.2f}s")

                # Concatenate with the explicit method
                logger.info(f"Concatenating {len(section_clips)} clips with method='chain_together'")
                try:
                    final_clip = concatenate_videoclips(section_clips, method="chain_together")

                    # Log the final concatenated clip
                    logger.info(f"Final concatenated clip: duration={final_clip.duration:.2f}s, " +
                              f"has_audio={final_clip.audio is not None}")

                    # Verify the concat duration is close to expected
                    if abs(final_clip.duration - expected_duration) > 0.5:
                        logger.warning(f"Concatenated duration ({final_clip.duration:.2f}s) doesn't match " +
                                    f"expected duration ({expected_duration:.2f}s)")
                except Exception as concat_error:
                    logger.error(f"Standard concatenation failed: {concat_error}, trying fallback method")

                    try:
                        # Try alternative concatenation method
                        temp_clips = []
                        for clip in section_clips:
                            # Remove audio temporarily
                            temp_clip = clip.without_audio()
                            temp_clips.append(temp_clip)

                        # Concatenate videos without audio
                        final_clip = concatenate_videoclips(temp_clips, method="compose")

                        # Create silent audio for the final clip
                        from moviepy.audio.AudioClip import AudioClip
                        import numpy as np
                        def silent_frame(t):
                            return np.zeros(2)
                        silent_audio = AudioClip(make_frame=silent_frame, duration=final_clip.duration)
                        silent_audio = silent_audio.set_fps(44100)
                        final_clip = final_clip.set_audio(silent_audio)

                        logger.info(f"Used fallback concatenation, duration: {final_clip.duration:.2f}s")
                    except Exception as fallback_error:
                        logger.error(f"Fallback concatenation also failed: {fallback_error}")

                        # Create a simple duration-guaranteed clip as last resort
                        final_duration = min(15, max_duration)
                        logger.warning(f"Creating simple {final_duration}s clip as last resort")

                        final_clip = ColorClip(size=self.resolution, color=(0, 0, 0)).set_duration(final_duration)
                        if title:
                            try:
                                txt_clip = self.v_creator._create_text_clip(
                                    title,
                                    duration=final_duration,
                                    font_size=70,
                                    position=('center', 'center'),
                                    with_pill=True
                                )
                                final_clip = CompositeVideoClip([final_clip, txt_clip], size=self.resolution)
                            except:
                                logger.error("Failed to add text to last resort clip")

                        # Add silent audio
                        from moviepy.audio.AudioClip import AudioClip
                        import numpy as np
                        def silent_frame(t):
                            return np.zeros(2)
                        silent_audio = AudioClip(make_frame=silent_frame, duration=final_duration)
                        silent_audio = silent_audio.set_fps(44100)
                        final_clip = final_clip.set_audio(silent_audio)

                # Ensure we don't exceed maximum duration
                if final_clip.duration > max_duration:
                    logger.warning(f"Video exceeds maximum duration ({final_clip.duration}s > {max_duration}s), trimming")
                    final_clip = final_clip.subclip(0, max_duration)

                # Verify the final duration
                logger.info(f"Final video duration before writing: {final_clip.duration:.2f}s")
                if final_clip.duration < max_duration * 0.5:
                    logger.warning(f"Final video duration ({final_clip.duration:.2f}s) is much less than target ({max_duration}s)")

                # Add watermark if requested
                if add_watermark_text:
                    final_clip = self.add_watermark(final_clip, watermark_text=add_watermark_text)

                # Progress update
                progress_callback(85, "Rendering final video")

                # Process concatenated video before writing to file
                # This is a critical part to prevent audio access errors
                try:
                    # Verify the audio can be properly accessed
                    if final_clip.audio is not None:
                        # Create a completely new audio clip to replace any problematic composite audio
                        audio_duration = final_clip.audio.duration

                        # Rewrite the audio to ensure it's a clean, contiguous clip
                        temp_audio_file = os.path.join(self.temp_dir, f"final_audio_{int(time.time())}.mp3")
                        try:
                            logger.info(f"Writing temporary audio file to ensure integrity: {temp_audio_file}")
                            final_clip.audio.write_audiofile(temp_audio_file, fps=44100, nbytes=2, codec='libmp3lame', logger=None)

                            # Load it back as a fresh audio clip
                            fresh_audio = AudioFileClip(temp_audio_file)

                            # Ensure its duration matches the video
                            if abs(fresh_audio.duration - final_clip.duration) > 0.1:
                                logger.warning(f"Reloaded audio has different duration: {fresh_audio.duration:.2f}s vs {final_clip.duration:.2f}s, adjusting")
                                fresh_audio = fresh_audio.set_duration(final_clip.duration)

                            # Replace the original audio
                            final_clip = final_clip.set_audio(fresh_audio)
                            logger.info(f"Audio reloaded successfully with duration {fresh_audio.duration:.2f}s")
                        except Exception as audio_rewrite_error:
                            logger.error(f"Failed to rewrite audio: {audio_rewrite_error}, creating silent audio")
                            # Create a silent audio clip as fallback
                            from moviepy.audio.AudioClip import AudioClip
                            import numpy as np
                            def silent_frame(t):
                                return np.zeros(2)
                            silent_audio = AudioClip(make_frame=silent_frame, duration=final_clip.duration)
                            silent_audio = silent_audio.set_fps(44100)
                            final_clip = final_clip.set_audio(silent_audio)
                    else:
                        logger.warning("Final clip has no audio, adding silent audio")
                        # Add silent audio
                        from moviepy.audio.AudioClip import AudioClip
                        import numpy as np
                        def silent_frame(t):
                            return np.zeros(2)
                        silent_audio = AudioClip(make_frame=silent_frame, duration=final_clip.duration)
                        silent_audio = silent_audio.set_fps(44100)
                        final_clip = final_clip.set_audio(silent_audio)

                    # Perform final duration check
                    logger.info(f"Final clip ready for writing: duration={final_clip.duration:.2f}s, audio_duration={final_clip.audio.duration if final_clip.audio else 0:.2f}s")

                except Exception as final_proc_error:
                    logger.error(f"Error during final clip processing: {final_proc_error}")

                # Write the final video with improved settings
                logger.info(f"Writing video to {output_filename} (duration: {final_clip.duration:.2f}s)")

                final_clip.write_videofile(
                    output_filename,
                    fps=self.fps,
                    codec="libx264",
                    audio_codec="aac",
                    threads=4,
                    preset="veryfast",
                    ffmpeg_params=[
                        "-bufsize", "24M",      # Larger buffer
                        "-maxrate", "8M",       # Higher max rate
                        "-b:a", "192k",         # Higher audio bitrate
                        "-ar", "48000",         # Audio sample rate
                        "-pix_fmt", "yuv420p"   # Compatible pixel format for all players
                    ]
                )

                logger.info(f"Completed video rendering in {time.time() - concat_start_time:.2f} seconds")

            # Final progress update
            progress_callback(100, "YouTube Short created successfully")

            # Print summary of creation process
            overall_duration = time.time() - overall_start_time
            logger.info(f"YouTube short creation completed in {overall_duration:.2f} seconds")
            logger.info(f"Video saved to: {output_filename}")

            # Clean up temporary files
            self._cleanup()

            return output_filename

        except Exception as e:
            logger.error(f"Error creating YouTube Short: {e}")
            import traceback
            logger.error(traceback.format_exc())
            # Clean up temporary files even on error
            try:
                # Close any open audio clips before cleanup
                for idx, audio_clip, _ in audio_clips:
                    try:
                        if audio_clip and hasattr(audio_clip, 'close'):
                            audio_clip.close()
                    except Exception as close_error:
                        logger.warning(f"Error closing audio clip {idx}: {close_error}")

                # Close any section clips
                for clip in section_clips:
                    try:
                        if clip and hasattr(clip, 'close'):
                            clip.close()
                    except Exception as close_error:
                        logger.warning(f"Error closing section clip: {close_error}")

                self._cleanup()
            except:
                pass
            raise

    @measure_time
    def _cleanup(self):
        """Clean up temporary files"""
        try:
            logger.info("Starting cleanup of temporary files")

            # First close any open audio or video clips
            # This is important for Windows which won't allow deleting files that are in use
            try:
                import gc
                # Force garbage collection to close file handles
                gc.collect()
                time.sleep(0.5)  # Small delay to allow file handles to be properly released
                logger.info("Garbage collection performed to close file handles")
            except Exception as gc_error:
                logger.warning(f"Error during garbage collection: {gc_error}")

            # List of files that couldn't be deleted
            failed_files = []

            # Try to remove files with proper error handling
            for filename in os.listdir(self.temp_dir):
                file_path = os.path.join(self.temp_dir, filename)
                try:
                    if os.path.isfile(file_path):
                        try:
                            os.unlink(file_path)
                        except Exception as file_error:
                            logger.warning(f"Could not delete file {file_path}: {file_error}")
                            failed_files.append(file_path)
                    elif os.path.isdir(file_path):
                        try:
                            shutil.rmtree(file_path)
                        except Exception as dir_error:
                            logger.warning(f"Could not delete directory {file_path}: {dir_error}")
                except Exception as e:
                    logger.warning(f"Error processing {file_path}: {e}")

            # Report on cleanup results
            if failed_files:
                logger.warning(f"Cleanup completed with {len(failed_files)} files that could not be deleted")
                # Schedule these for deletion on exit
                import atexit
                for path in failed_files:
                    # Use a function definition instead of a lambda to correctly capture the path
                    def create_deletion_callback(file_path):
                        def deletion_callback():
                            if os.path.exists(file_path):
                                try:
                                    os.remove(file_path)
                                except Exception as e:
                                    logger.warning(f"Failed to delete {file_path} during exit: {e}")
                        return deletion_callback

                    atexit.register(create_deletion_callback(path))
                logger.info("Scheduled remaining files for deletion on program exit")
            else:
                logger.info("All temporary files were successfully cleaned up")

        except Exception as e:
            logger.error(f"Error cleaning up temporary files: {e}")

    @measure_time
    def create_youtube_short_from_images(self, image_paths, texts=None, audio_clips=None, section_duration=5.0,
                                       output_filename=None, add_watermark_text=None):
        """
        Create a YouTube short from a list of images with optional text overlays and audio clips.

        Args:
            image_paths (list): List of paths to images
            texts (list, optional): List of text overlays for each image. Defaults to None.
            audio_clips (list, optional): List of paths to audio clips for each section. Defaults to None.
            section_duration (float): Duration for each section in seconds. Defaults to 5.0.
            output_filename (str, optional): Name of the output file. Defaults to None.
            add_watermark_text (str, optional): Text to add as watermark. Defaults to None.

        Returns:
            str: Path to the created video file
        """
        try:
            # Validate inputs
            if not image_paths:
                raise ValueError("At least one image path must be provided")

            # Initialize empty lists if not provided
            texts = texts or [None] * len(image_paths)
            audio_clips = audio_clips or [None] * len(image_paths)

            # Ensure all lists have the same length
            if len(texts) != len(image_paths) or len(audio_clips) != len(image_paths):
                raise ValueError("The lengths of image_paths, texts, and audio_clips must match")

            # Generate output filename if not provided
            if output_filename is None:
                timestamp = time.strftime("%Y%m%d_%H%M%S")
                output_filename = os.path.join(self.output_dir, f"short_{timestamp}.mp4")

            # Create video clips for each section
            video_clips = []
            for i, (image_path, text, audio_path) in enumerate(zip(image_paths, texts, audio_clips)):
                # Create image clip
                image_clip = self._create_still_image_clip(
                    image_path,
                    duration=section_duration,
                    text=text,
                    text_position=('center', 'center'),
                    with_zoom=True
                )

                # If audio is provided for this section, add it
                if audio_path and os.path.exists(audio_path):
                    try:
                        audio_clip = AudioFileClip(audio_path)
                        
                        # Verify audio is valid
                        if audio_clip.duration <= 0:
                            logger.warning(f"Audio file for section {i} has invalid duration: {audio_clip.duration}s")
                            raise ValueError("Invalid audio duration")
                            
                        # Trim or extend audio to match section duration
                        if audio_clip.duration > section_duration:
                            audio_clip = audio_clip.subclip(0, section_duration)
                        elif audio_clip.duration < section_duration:
                            # Create silent audio for the remaining duration
                            silence_duration = section_duration - audio_clip.duration
                            def silent_frame(t):
                                return np.zeros((2,))  # Stereo silence
                            silence = AudioClip(make_frame=silent_frame, duration=silence_duration)
                            if hasattr(audio_clip, 'fps') and audio_clip.fps:
                                silence = silence.set_fps(audio_clip.fps)
                            else:
                                silence = silence.set_fps(44100)
                            audio_clip = concatenate_audioclips([audio_clip, silence])
                        
                        # Ensure audio has correct duration
                        audio_clip = audio_clip.set_duration(section_duration)
                        
                        # Set the audio for the clip
                        image_clip = image_clip.set_audio(audio_clip)
                    except Exception as e:
                        logger.error(f"Error processing audio for section {i}: {e}")
                        # Create silent audio as fallback
                        def silent_frame(t):
                            return np.zeros((2,))  # Stereo silence
                        silent_audio = AudioClip(make_frame=silent_frame, duration=section_duration)
                        silent_audio = silent_audio.set_fps(44100)
                        image_clip = image_clip.set_audio(silent_audio)

                video_clips.append(image_clip)

            # Concatenate all clips
            final_clip = concatenate_videoclips(video_clips, method="compose")

            # Add watermark if specified
            if add_watermark_text:
                final_clip = self.add_watermark(final_clip, watermark_text=add_watermark_text)

            # Write the final video
            final_clip.write_videofile(
                output_filename,
                fps=self.fps,
                codec='libx264',
                audio_codec='aac',
                temp_audiofile=os.path.join(self.temp_dir, "temp_audio.m4a"),
                remove_temp=True,
                threads=4,
                preset='ultrafast'
            )

            logger.info(f"Successfully created YouTube short: {output_filename}")
            return output_filename

        except Exception as e:
            logger.error(f"Error creating YouTube short from images: {str(e)}")
            raise
        finally:
            # Clean up any clips
            try:
                for clip in video_clips:
                    if clip and hasattr(clip, 'close'):
                        try:
                            clip.close()
                        except:
                            pass
                
                if 'final_clip' in locals() and final_clip and hasattr(final_clip, 'close'):
                    try:
                        final_clip.close()
                    except:
                        pass
            except:
                pass



