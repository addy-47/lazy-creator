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
    VideoFileClip, VideoClip, TextClip, CompositeVideoClip, ImageClip,
    AudioFileClip, concatenate_videoclips, ColorClip, CompositeAudioClip
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
from .parallel_renderer import is_shutdown_requested

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
        
        try:
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

                # Function to resize based on zoom level
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
                        bg_clip = ColorClip(size=(bg_width, bg_height), color=(0, 0, 0))
                        bg_clip = bg_clip.set_position(('center', int(self.resolution[1] * 0.85) - 20)).set_duration(duration).set_opacity(0.7)

                        # Combine all elements
                        return CompositeVideoClip([image, bg_clip, simple_txt_clip], size=self.resolution)
                    except Exception as e2:
                        logger.error(f"Fallback text clip also failed: {e2}")
                        # If all text methods fail, just return the image without text
                        logger.warning("Returning image without text overlay due to text rendering failures")
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
            return filename

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
                        output_filename=None, add_captions=False, style="photorealistic", voice_style=None, max_duration=30,
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
            progress_callback(10, "Generating TTS audio for each section")
            
            # Generate audio clips with TTS for each section
            tts_start_time = time.time()
            logger.info(f"Starting TTS audio generation")

            audio_clips = []
            section_durations = []  # Store actual durations after TTS generation

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
                                audio_clip = AudioFileClip(audio_path)
                                actual_duration = audio_clip.duration

                                # Check if audio has valid duration
                                if actual_duration <= 0:
                                    logger.warning(f"Audio file for section {i} has zero duration, creating fallback silent audio")
                                    # Create silent audio as fallback
                                    from moviepy.audio.AudioClip import AudioClip
                                    import numpy as np

                                    def make_frame(t):
                                        return np.zeros(2)  # Stereo silence

                                    # Use minimum section duration for silent audio
                                    audio_clip = AudioClip(make_frame=make_frame, duration=min_section_duration)
                                    audio_clip = audio_clip.set_fps(44100)
                                    actual_duration = min_section_duration

                                # Ensure minimum duration
                                actual_duration = max(actual_duration, min_section_duration)

                                # Store the final duration and clip
                                section_durations.append((i, actual_duration))
                                audio_clips.append((i, audio_clip, actual_duration))
                            except Exception as e:
                                logger.error(f"Error processing audio for section {i}: {e}")
                                section_durations.append((i, min_section_duration))
                        else:
                            # If no audio was created, use minimum duration
                            section_durations.append((i, min_section_duration))
                    except Exception as e:
                        logger.error(f"Error getting TTS result for section {i}: {e}")
                        section_durations.append((i, min_section_duration))

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

            logger.info(f"Completed TTS audio generation in {time.time() - tts_start_time:.2f} seconds")
            logger.info(f"Final total duration: {total_duration:.1f}s")

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
                                # If audio duration doesn't match section duration, adjust
                                if abs(audio_duration - section_duration) > 0.1:
                                    # Cut audio if too long
                                    if audio_duration > section_duration:
                                        audio_clip = audio_clip.subclip(0, section_duration)
                                    else:
                                        # Handle short audio more intelligently to prevent repetitive sound
                                        # Instead of creating loop which can sound unnatural,
                                        # extend the last portion with a fade out
                                        from moviepy.audio.AudioClip import CompositeAudioClip
                                        
                                        # Calculate extension needed
                                        extension_needed = section_duration - audio_duration
                                        logger.info(f"Extending audio for section {i} by {extension_needed:.2f}s")
                                        
                                        # Create a fade out of the last part to extend gracefully
                                        if extension_needed > 0.5:  # Only if we need significant extension
                                            # Take last second of audio and fade it out for the extension
                                            last_part = audio_clip.subclip(max(0, audio_duration - 1))
                                            # Create a silent clip for the extension
                                            from moviepy.audio.AudioClip import AudioClip
                                            import numpy as np
                                            
                                            def make_silence(t):
                                                return np.zeros(2)  # Stereo silence
                                            
                                            # Create a silent extension with the needed duration
                                            silence = AudioClip(make_frame=make_silence, duration=extension_needed)
                                            silence = silence.set_fps(audio_clip.fps)
                                            
                                            # Combine original audio with silence to reach desired duration
                                            audio_clip = audio_clip.set_duration(audio_duration)
                                            extended_audio = CompositeAudioClip([
                                                audio_clip, 
                                                silence.set_start(audio_duration)
                                            ])
                                            audio_clip = extended_audio.set_duration(section_duration)
                                        else:
                                            # For very small extensions, just set the duration directly
                                            audio_clip = audio_clip.set_duration(section_duration)
                                
                                # Ensure audio has the exact right duration
                                audio_clip = audio_clip.set_duration(section_duration)
                                section_clip = section_clip.set_audio(audio_clip)
                                logger.info(f"Added audio to section {i} (duration: {section_duration:.2f}s)")
                            except Exception as e:
                                logger.error(f"Error adding audio to section {i}: {e}")
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
            
            # Validate that each clip has unique content
            logger.info("Validating section clips to ensure uniqueness...")
            validated_clips = []
            
            for i, clip in enumerate(section_clips):
                # Make sure each clip has proper duration
                if clip.duration <= 0:
                    logger.error(f"Clip {i} has invalid duration: {clip.duration}s")
                    continue
                
                # Ensure each clip has audio
                if clip.audio is None:
                    logger.warning(f"Clip {i} has no audio, may cause issues in playback")
                
                # If this is valid, add to our validated clips
                validated_clips.append(clip)
                logger.info(f"Validated clip {i}: duration={clip.duration:.2f}s")
            
            # Replace our section clips with validated ones
            if validated_clips:
                section_clips = validated_clips
                logger.info(f"Using {len(section_clips)} validated clips")
            else:
                logger.error("No valid clips found after validation")
                return None
                
            # Add captions at the bottom if requested
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
                for i, clip in enumerate(section_clips):
                    logger.info(f"Clip {i} before concatenation: duration={clip.duration:.2f}s, " +
                               f"has_audio={clip.audio is not None}")
                
                # Concatenate all clips with explicit method
                logger.info(f"Concatenating {len(section_clips)} clips with method='chain_together'")
                final_clip = concatenate_videoclips(section_clips, method="chain_together")
                
                # Log the final concatenated clip
                logger.info(f"Final concatenated clip: duration={final_clip.duration:.2f}s, " +
                           f"has_audio={final_clip.audio is not None}")
                
                # Ensure we don't exceed maximum duration
                if final_clip.duration > max_duration:
                    logger.warning(f"Video exceeds maximum duration ({final_clip.duration}s > {max_duration}s), trimming")
                    final_clip = final_clip.subclip(0, max_duration)
                
                # Add watermark if requested
                if add_watermark_text:
                    final_clip = self.add_watermark(final_clip, watermark_text=add_watermark_text)
                
                # Progress update
                progress_callback(85, "Rendering final video")
                
                # Render clips in parallel
                render_start_time = time.time()
                logger.info(f"Starting parallel video rendering")
                
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
                
                # Concatenate with the explicit method
                logger.info(f"Concatenating {len(section_clips)} clips with method='chain_together'")
                final_clip = concatenate_videoclips(section_clips, method="chain_together")
                
                # Log the final concatenated clip
                logger.info(f"Final concatenated clip: duration={final_clip.duration:.2f}s, " +
                           f"has_audio={final_clip.audio is not None}")
                
                # Ensure we don't exceed maximum duration
                if final_clip.duration > max_duration:
                    logger.warning(f"Video exceeds maximum duration ({final_clip.duration}s > {max_duration}s), trimming")
                    final_clip = final_clip.subclip(0, max_duration)
                
                # Add watermark if requested
                if add_watermark_text:
                    final_clip = self.add_watermark(final_clip, watermark_text=add_watermark_text)
                
                # Progress update
                progress_callback(85, "Rendering final video")
                
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
                self._cleanup()
            except:
                pass
            raise
            
    @measure_time
    def _cleanup(self):
        """Clean up temporary files"""
        try:
            for filename in os.listdir(self.temp_dir):
                file_path = os.path.join(self.temp_dir, filename)
                if os.path.isfile(file_path):
                    os.unlink(file_path)
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
        except Exception as e:
            logger.error(f"Error cleaning up temporary files: {e}")



