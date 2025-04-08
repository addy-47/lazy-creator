import os
import time
import random
import requests
import numpy as np
import logging
from PIL import Image, ImageFilter, ImageDraw, ImageFont
from moviepy.editor import (
    VideoFileClip, VideoClip, TextClip, CompositeVideoClip, ImageClip,
    AudioFileClip, concatenate_videoclips, ColorClip, CompositeAudioClip
)
from moviepy.config import change_settings
change_settings({"IMAGEMAGICK_BINARY": "magick"})
from gtts import gTTS
from dotenv import load_dotenv
import shutil
import tempfile
from typing import List, Dict, Union, Optional
import textwrap
from .parallel_renderer import render_clips_in_parallel

# Configure logging
logger = logging.getLogger(__name__)

class ImageShortsCreator:
    def __init__(self, output_dir="output", fps=30):
        """Initialize the YouTube Shorts creator with necessary settings"""
        # Setup directories
        self.output_dir = output_dir
        self.temp_dir = tempfile.mkdtemp()
        os.makedirs(output_dir, exist_ok=True)
        os.makedirs(self.temp_dir, exist_ok=True)

        # Video settings
        self.resolution = (1080, 1920)  # Portrait mode for shorts
        self.fps = fps

        # Font settings
        self.fonts_dir = os.path.join(os.path.dirname(__file__), 'fonts')
        os.makedirs(self.fonts_dir, exist_ok=True)
        self.title_font_path = self._get_font_path("default_font.ttf")
        self.body_font_path = self._get_font_path("default_font.ttf")

        # Load API keys
        load_dotenv()
        self.huggingface_api_key = os.getenv("HUGGINGFACE_API_KEY")
        self.hf_model = os.getenv("HF_MODEL", "stabilityai/stable-diffusion-2-1")
        self.hf_api_url = f"https://api-inference.huggingface.co/models/{self.hf_model}"
        self.hf_headers = {"Authorization": f"Bearer {self.huggingface_api_key}"}
        self.unsplash_api_key = os.getenv("UNSPLASH_API_KEY")

        # Initialize TTS
        self.azure_tts = None
        if os.getenv("USE_AZURE_TTS", "false").lower() == "true":
            try:
                from .voiceover import AzureVoiceover
                self.azure_tts = AzureVoiceover(
                    voice=os.getenv("AZURE_VOICE", "en-US-JennyNeural"),
                    output_dir=self.temp_dir
                )
            except Exception as e:
                logger.warning(f"Azure TTS failed: {e}")

        # Define transitions
        self.transitions = {
            "fade": lambda clip, duration: clip.fadein(duration).fadeout(duration),
            "slide_left": lambda clip, duration: clip.set_position(
                lambda t: ((t/duration) * self.resolution[0] - clip.w if t < duration else 0, 'center')),
            "zoom_in": lambda clip, duration: clip.resize(lambda t: max(1, 1 + 0.5 * min(t/duration, 1)))
        }

    def _get_font_path(self, font_name):
        """Get the path to a font file, downloading it if necessary"""
        font_path = os.path.join(self.fonts_dir, font_name)

        # If font doesn't exist, use a system font as fallback
        if not os.path.exists(font_path):
            if os.name == 'nt':  # Windows
                system_font = "C:\\Windows\\Fonts\\arial.ttf"
            else:  # Linux/Mac
                system_font = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

            if os.path.exists(system_font):
                shutil.copy2(system_font, font_path)
            else:
                # If no system font found, create a simple placeholder
                img = Image.new('RGB', (100, 100), color='white')
                d = ImageDraw.Draw(img)
                d.text((10, 10), "Text", fill='black')
                img.save(font_path)

        return font_path

    def _generate_image_from_prompt(self, prompt, style="photorealistic", file_path=None):
        """
        Generate an image using Hugging Face Diffusion API based on prompt

        Args:
            prompt (str): Image generation prompt
            style (str): Style to apply to the image
            file_path (str): Path to save the image

        Returns:
            str: Path to generated image or None if failed
        """
        if not file_path:
            file_path = os.path.join(self.temp_dir, f"gen_img_{int(time.time())}_{random.randint(1000, 9999)}.png")

        # Remove any existing style descriptors from the prompt
        style_keywords = ["digital art", "photorealistic", "oil painting", "realistic", "anime",
                         "concept art", "cinematic", "cartoon", "3d render", "watercolor",
                         "sketch", "illustration", "painting"]

        # Clean the prompt of any existing style descriptors
        clean_prompt = prompt
        for keyword in style_keywords:
            clean_prompt = clean_prompt.replace(f", {keyword}", "")
            clean_prompt = clean_prompt.replace(f" {keyword}", "")
            clean_prompt = clean_prompt.replace(f"{keyword} ", "")
            clean_prompt = clean_prompt.replace(f"{keyword},", "")

        # Clean up any double commas or spaces
        while ",," in clean_prompt:
            clean_prompt = clean_prompt.replace(",,", ",")
        while "  " in clean_prompt:
            clean_prompt = clean_prompt.replace("  ", " ")
        clean_prompt = clean_prompt.strip(" ,")

        # Add the desired style and quality enhancements
        enhanced_prompt = f"{clean_prompt}, {style}, highly detailed, crisp focus, 4K, high resolution"

        logger.info(f"Generating image with prompt: {enhanced_prompt[:50]}...")

        # Check if Hugging Face API key is available
        if not self.huggingface_api_key:
            logger.error("No Hugging Face API key provided. Will fall back to Unsplash.")
            return None

        retry_count = 0
        max_retries = 2

        while retry_count < max_retries:
            try:
                response = requests.post(
                    self.hf_api_url,
                    headers=self.hf_headers,
                    json={"inputs": enhanced_prompt},
                    timeout=30
                )

                if response.status_code == 200:
                    with open(file_path, "wb") as f:
                        f.write(response.content)
                    logger.info(f"Image saved to {file_path}")
                    return file_path
                else:
                    logger.warning(f"Failed to generate image: {response.status_code}")
                    retry_count += 1
                    time.sleep(2)
            except Exception as e:
                logger.error(f"Error generating image: {e}")
                retry_count += 1
                time.sleep(2)

        # If all retries failed, return None to signal fallback to Unsplash
        logger.error("Failed to generate image with Hugging Face API")
        return None

    def _fetch_unsplash_image(self, query):
        """
        Fetch an image from Unsplash API as fallback

        Args:
            query (str): Search query

        Returns:
            str: Path to downloaded image or None if failed
        """
        if not self.unsplash_api_key:
            logger.error("No Unsplash API key provided.")
            return None

        try:
            # Make request to Unsplash API
            url = f"https://api.unsplash.com/photos/random?query={query}&orientation=portrait"
            headers = {
                "Authorization": f"Client-ID {self.unsplash_api_key}",
                "Accept-Version": "v1"
            }

            response = requests.get(url, headers=headers)

            if response.status_code == 200:
                data = response.json()
                image_url = data["urls"]["regular"]

                # Download the image
                file_path = os.path.join(self.temp_dir, f"unsplash_{int(time.time())}.jpg")
                img_response = requests.get(image_url)

                if img_response.status_code == 200:
                    with open(file_path, "wb") as f:
                        f.write(img_response.content)
                    logger.info(f"Unsplash image saved to {file_path}")
                    return file_path

            logger.error(f"Failed to fetch Unsplash image: {response.status_code}")
            return None
        except Exception as e:
            logger.error(f"Error fetching Unsplash image: {e}")
            return None

    def _create_still_image_clip(self, image_path, duration, text=None, text_position=('center','center'),
                               font_size=60, with_zoom=True, zoom_factor=0.05):
        """
        Create a still image clip with optional text and zoom effect

        Args:
            image_path (str): Path to the image
            duration (float): Duration of the clip in seconds
            text (str): Optional text overlay
            text_position (tuple): Position of text
            font_size (int): Font size for text
            with_zoom (bool): Whether to add a subtle zoom effect
            zoom_factor (float): Rate of zoom

        Returns:
            VideoClip: MoviePy clip with the image and effects
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

            image = image.resize(zoom)

        # Set the duration
        image = image.set_duration(duration)

        # Add text if provided
        if text:
            try:
                # Create text clip
                txt_clip = TextClip(
                    txt=text,
                    fontsize=font_size,
                    color='white',
                    align='center',
                    method='caption',
                    size=(int(self.resolution[0] * 0.9), None)
                ).set_position(('center', int(self.resolution[1] * 0.85))).set_duration(duration)

                # Create a semi-transparent background for better readability
                txt_w, txt_h = txt_clip.size
                bg_width = txt_w + 40
                bg_height = txt_h + 40
                bg_clip = ColorClip(size=(bg_width, bg_height), color=(0, 0, 0, 128))
                bg_clip = bg_clip.set_position(('center', int(self.resolution[1] * 0.85) - 20)).set_duration(duration).set_opacity(0.7)

                # Combine all elements
                return CompositeVideoClip([image, bg_clip, txt_clip], size=self.resolution)
            except Exception as e:
                logger.error(f"Error creating text overlay: {e}")
                return image

        return image

    def _create_text_clip(self, text, duration=5, font_size=60, font_path=None, color='white',
                          position='center', animation="fade", animation_duration=1.0, shadow=True,
                          outline=True, with_pill=False, pill_color=(0, 0, 0, 160), pill_radius=30):
        """
        Create a text clip with various effects and animations

        Args:
            text (str): Text to display
            duration (float): Duration of clip
            font_size (int): Font size
            font_path (str): Path to font file
            color (str): Text color
            position (str or tuple): Position of text
            animation (str): Animation type
            animation_duration (float): Duration of animation
            shadow (bool): Whether to add shadow
            outline (bool): Whether to add outline
            with_pill (bool): Whether to add pill background
            pill_color (tuple): Pill background color with alpha
            pill_radius (int): Pill corner radius

        Returns:
            TextClip: Processed text clip
        """
        if not font_path:
            font_path = self.body_font_path

        # Create text clip with specified font and size
        text_clip = TextClip(
            txt=text,
            fontsize=font_size,
            color=color,
            font=font_path,
            align='center',
            method='caption',
            size=(int(self.resolution[0] * 0.8), None)
        )

        # Calculate the duration
        text_clip = text_clip.set_duration(duration)

        # Position the clip
        text_clip = text_clip.set_position(position)

        # Add pill background if requested
        if with_pill:
            # Create a pill background (rounded rectangle) that's slightly larger than the text
            txt_w, txt_h = text_clip.size
            pill_width = txt_w + 40  # Add padding
            pill_height = txt_h + 40

            # Create pill image and convert to clip
            pill_img = self._create_pill_image((pill_width, pill_height), pill_color, pill_radius)
            pill_clip = ImageClip(pill_img).set_duration(duration)

            # Position the pill behind the text
            if isinstance(position, tuple):
                pill_position = position
            else:
                pill_position = position  # Both centered

            pill_clip = pill_clip.set_position(pill_position)

            # Composite text over pill
            text_clip = CompositeVideoClip([pill_clip, text_clip])

        # Apply animation
        if animation == "fade":
            text_clip = text_clip.fadeout(animation_duration)
            text_clip = text_clip.fadein(animation_duration)
        elif animation == "slide_left" and animation in self.transitions:
            text_clip = self.transitions[animation](text_clip, animation_duration)

        return text_clip

    def _create_pill_image(self, size, color=(0, 0, 0, 160), radius=30):
        """
        Create a pill-shaped background image with rounded corners

        Args:
            size (tuple): Size of the image (width, height)
            color (tuple): Color with alpha channel
            radius (int): Corner radius

        Returns:
            PIL.Image: Pill-shaped image
        """
        width, height = size
        # Create a transparent image
        image = Image.new('RGBA', size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)

        # Draw a rounded rectangle
        draw.rounded_rectangle([(0, 0), (width, height)], radius, fill=color)

        return image

    def _create_tts_audio(self, text, filename=None, voice_style="none"):
        """
        Create TTS audio file with robust error handling

        Args:
            text (str): Text to convert to speech
            filename (str): Output filename
            voice_style (str): Style of voice

        Returns:
            str: Path to audio file or None if failed
        """
        if not filename:
            filename = os.path.join(self.temp_dir, f"tts_{int(time.time())}.mp3")

        # Make sure text is not empty and has minimum length
        if not text or len(text.strip()) == 0:
            text = "No text provided"
        elif len(text.strip()) < 5:
            text = text.strip() + "."

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

        # Fall back to gTTS
        retry_count = 0
        max_retries = 3

        while retry_count < max_retries:
            try:
                tts = gTTS(text=text, lang='en', slow=False)
                tts.save(filename)
                logger.info(f"Created TTS audio at {filename}")
                return filename
            except Exception as e:
                logger.error(f"gTTS error (attempt {retry_count+1}/{max_retries}): {e}")
                retry_count += 1
                time.sleep(2)

        # If all TTS methods fail, create a silent audio clip
        try:
            logger.warning("All TTS methods failed. Creating silent audio.")
            words = text.split()
            duration = max(3, len(words) / 2.5)  # Average speaking rate

            # Create silent audio clip
            from moviepy.audio.AudioClip import AudioClip

            def make_frame(t):
                return np.zeros(2)  # Stereo silence

            silent_clip = AudioClip(make_frame=make_frame, duration=duration)
            silent_clip.write_audiofile(filename, fps=44100, nbytes=2, codec='libmp3lame')

            return filename
        except Exception as e:
            logger.error(f"Failed to create silent audio: {e}")
            return None

    def create_youtube_short(self, config: Dict) -> str:
        """
        Create a YouTube Short using AI-generated images for each script section

        Args:
            config (dict): Configuration dictionary with:
                - title (str): Video title
                - script_sections (list): List of dicts with text/duration
                - max_duration (int): Maximum video duration
                - background_type: Should be "image"
                - background_source: "provided" or "custom"
                - background_path: Required if custom source
                - background_query: Required if provided source
                - style (str): Visual style for image generation
                - voice_style (str): TTS style

        Returns:
            str: Path to created video
        """
        # Extract configuration parameters
        title = config.get('title', 'YouTube Short')
        script_sections = config.get('script_sections', [])
        output_filename = config.get('output_filename')
        add_captions = config.get('add_captions', False)
        style = config.get('style', 'photorealistic')
        voice_style = config.get('voice_style', 'none')
        max_duration = config.get('max_duration', 25)
        background_source = config.get('background_source', 'provided')
        background_queries = config.get('background_queries', [])

        # Validate essential parameters
        if not script_sections:
            raise ValueError("No script sections provided")

        logger.info(f"Creating YouTube Short: {title}")

        # Set output filename if not provided
        if not output_filename:
            timestamp = int(time.time())
            output_filename = f"youtube_short_{timestamp}.mp4"
        output_path = os.path.join(self.output_dir, output_filename)

        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # Process background image based on source
        background_imgs = []

        if background_source == 'custom':
            # Use custom image
            background_path = config.get('background_path')
            if not background_path or not os.path.exists(background_path):
                raise ValueError("Custom background path not found")

            # Use the same image for all sections
            for _ in script_sections:
                background_imgs.append(background_path)
        else:
            # Use provided query to generate images
            background_query = config.get('background_query', 'abstract background')

            # Generate image for each section
            for i, section in enumerate(script_sections):
                # Get the query for this section
                if i < len(background_queries):
                    query = background_queries[i]
                else:
                    query = background_query

                # Try to generate image with Hugging Face
                image_path = self._generate_image_from_prompt(query, style=style)

                # Fallback to Unsplash if generation fails
                if not image_path:
                    logger.info(f"Falling back to Unsplash for section {i+1}")
                    image_path = self._fetch_unsplash_image(query)

                    # If Unsplash fails too, create a basic text image
                    if not image_path:
                        logger.warning(f"Unsplash fallback failed for section {i+1}, creating text image")
                        image_path = self._create_text_based_image(section["text"])

                background_imgs.append(image_path)

        # Generate audio clips with TTS for each section
        audio_clips = []

        for i, section in enumerate(script_sections):
            section_text = section["text"]
            section_voice_style = section.get("voice_style", voice_style)

            # Create TTS audio
            audio_path = self._create_tts_audio(section_text, voice_style=section_voice_style)

            if audio_path and os.path.exists(audio_path):
                # Get actual audio duration
                try:
                    audio_clip = AudioFileClip(audio_path)
                    actual_duration = audio_clip.duration

                    # Ensure minimum duration
                    actual_duration = max(actual_duration, section["duration"])

                    # Update section duration
                    section["duration"] = actual_duration

                    audio_clips.append((i, audio_clip, actual_duration))
                except Exception as e:
                    logger.error(f"Error processing audio for section {i}: {e}")

        # Create video clips for each section
        section_clips = []

        for i, section in enumerate(script_sections):
            section_text = section["text"]
            section_duration = section["duration"]

            # Get the corresponding background image
            if i < len(background_imgs):
                image_path = background_imgs[i]
            else:
                # Fallback to the first image if we somehow don't have enough
                image_path = background_imgs[0]

            # Create image clip with text overlay
            if i == 0 and title:  # First section with title
                # Create base image clip
                base_clip = self._create_still_image_clip(
                    image_path,
                    duration=section_duration,
                    with_zoom=True
                )

                # Create title text
                title_clip = self._create_text_clip(
                    title,
                    duration=section_duration,
                    font_size=70,
                    position=("center", 150),
                    animation="fade",
                    with_pill=True,
                    pill_color=(0, 0, 0, 180)
                )

                # Create section text
                text_clip = self._create_text_clip(
                    section_text,
                    duration=section_duration,
                    font_size=60,
                    position=('center', 'center'),
                    animation="fade",
                    with_pill=True
                )

                # Combine clips
                section_clip = CompositeVideoClip([base_clip, title_clip, text_clip], size=self.resolution)
            else:
                # Create base image clip
                base_clip = self._create_still_image_clip(
                    image_path,
                    duration=section_duration,
                    with_zoom=True
                )

                # Create section text
                text_clip = self._create_text_clip(
                    section_text,
                    duration=section_duration,
                    font_size=60,
                    position=('center', 'center'),
                    animation="fade",
                    with_pill=True
                )

                # Combine clips
                section_clip = CompositeVideoClip([base_clip, text_clip], size=self.resolution)

            # Add audio if available
            for idx, audio_clip, duration in audio_clips:
                if idx == i:
                    try:
                        section_clip = section_clip.set_audio(audio_clip)
                    except Exception as e:
                        logger.error(f"Error setting audio for section {i}: {e}")
                    break

            section_clips.append(section_clip)

        # Add captions at the bottom if requested
        if add_captions:
            for i, clip in enumerate(section_clips):
                if i < len(script_sections):
                    section_text = script_sections[i]['text']
                    caption = self._create_text_clip(
                        section_text,
                        duration=clip.duration,
                        font_size=40,
                        position=('center', self.resolution[1] - 200),
                        animation="fade"
                    )
                    section_clips[i] = CompositeVideoClip([clip, caption], size=self.resolution)

        # Concatenate all clips
        if not section_clips:
            raise ValueError("No clips were created")

        # Use parallel rendering if available
        try:
            logger.info(f"Using parallel renderer for improved performance")

            # Create temp directory for parallel rendering
            parallel_temp_dir = os.path.join(self.temp_dir, "parallel_render")
            os.makedirs(parallel_temp_dir, exist_ok=True)

            # Render clips in parallel
            logger.info(f"Starting parallel video rendering")

            output_path = render_clips_in_parallel(
                section_clips,
                output_path,
                temp_dir=parallel_temp_dir,
                fps=self.fps,
                preset="veryfast"
            )

            logger.info(f"Completed parallel video rendering")
        except Exception as e:
            logger.warning(f"Parallel renderer failed: {e}. Using standard rendering.")

            # Standard rendering as fallback
            final_clip = concatenate_videoclips(section_clips)

            # Ensure we don't exceed maximum duration
            if final_clip.duration > max_duration:
                logger.warning(f"Video exceeds maximum duration ({final_clip.duration}s > {max_duration}s), trimming")
                final_clip = final_clip.subclip(0, max_duration)

            # Write the final video
            final_clip.write_videofile(
                output_path,
                fps=self.fps,
                codec="libx264",
                audio_codec="aac",
                threads=4,
                preset="veryfast",
                ffmpeg_params=[
                    "-bufsize", "24M",
                    "-maxrate", "8M",
                    "-b:a", "192k",
                    "-ar", "48000",
                    "-pix_fmt", "yuv420p"
                ]
            )

        # Clean up
        self._cleanup()

        return output_path

    def _create_text_based_image(self, text, file_path=None):
        """
        Create a basic text image as a last resort fallback

        Args:
            text (str): Text to display on the image
            file_path (str): Path to save the image

        Returns:
            str: Path to the created image
        """
        if not file_path:
            file_path = os.path.join(self.temp_dir, f"text_img_{int(time.time())}.png")

        # Create a blank image
        width, height = self.resolution
        image = Image.new('RGB', (width, height), (0, 0, 0))
        draw = ImageDraw.Draw(image)

        # Try to load a font
        try:
            font = ImageFont.truetype(self.body_font_path, 60)
        except:
            font = ImageFont.load_default()

        # Wrap text
        margin = 100
        wrapped_text = textwrap.fill(text, width=20)

        # Draw text
        draw.text(
            (width/2, height/2),
            wrapped_text,
            font=font,
            fill=(255, 255, 255),
            align="center",
            anchor="mm"
        )

        # Save image
        image.save(file_path)

        return file_path

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
