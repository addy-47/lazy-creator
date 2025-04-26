import os # for file path operations
import sys # for script path appending
import time # for timing and measurement
import json # for configuration parsing
import random # for random selections
import logging # for logging
import numpy as np # for image processing
import tempfile # for temporary files
import shutil # for file operations
import math # for mathematical operations
import requests # for HTTP requests
from gtts import gTTS # for text-to-speech
from pathlib import Path # for path manipulations
from datetime import datetime # for timestamps
from PIL import Image, ImageFilter, ImageEnhance # for image processing
import concurrent.futures # for parallel processing

# MoviePy imports for video processing
from moviepy.editor import (
    VideoFileClip, ImageClip, TextClip, CompositeVideoClip, ColorClip,
    concatenate_videoclips, CompositeAudioClip, AudioFileClip, AudioClip,
    concatenate_audioclips, vfx
)

# Set numpy to be more memory-conservative
np.seterr(all='ignore')  # Suppress numpy warnings
# Limit numpy memory usage (may cause slower execution but prevents memory errors)
try:
    # Try to limit max memory usage
    np.core.multiarray.set_max_memory_usage(2 * 1024 * 1024 * 1024)  # 2GB limit
except (AttributeError, ImportError):
    # If function not available, use alternate approach
    pass

# Configure logging for easier debugging
# Do NOT initialize basicConfig here - this will be handled by main.py
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Timer function for performance monitoring
def measure_time(func):
    """Decorator to measure the execution time of functions"""
    def wrapper(*args, **kwargs):
        # Only log timing for major functions (create_youtube_short)
        if func.__name__ == "create_youtube_short":
            start_time = time.time()
            logger.info(f"Starting YouTube short creation")
            result = func(*args, **kwargs)
            end_time = time.time()
            duration = end_time - start_time
            logger.info(f"Completed YouTube short creation in {duration:.2f} seconds")
        else:
            # For all other functions, just run without detailed logging
            result = func(*args, **kwargs)
        return result
    return wrapper

class YTShortsCreator_V:
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
        self.audio_sync_offset = 0.0  # Remove audio delay to improve sync

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

        # Load Pexels API key for background videos
        load_dotenv()
        self.pexels_api_key = os.getenv("PEXELS_API_KEY")
        self.pixabay_api_key = os.getenv("PIXABAY_API_KEY")

        # Watermark settings
        self.watermark_text = "Lazy Creator"  # Default watermark text
        self.watermark_font_size = 40  # Smaller font size for watermark
        self.watermark_opacity = 0.7  # Semi-transparent

    @measure_time
    def _fetch_videos(self, query, count=5, min_duration=5):
        """
        Fetch background videos from multiple sources with randomized API selection

        Args:
            query (str): Search term for videos
            count (int): Number of videos to fetch
            min_duration (int): Minimum video duration in seconds

        Returns:
            list: Paths to downloaded video files
        """
        # Determine how many videos to fetch from each source
        videos = []

        # Randomly decide which API to try first
        apis = ["pexels", "pixabay"]
        random.shuffle(apis)  # Shuffle the list to try APIs in random order

        # Try each API in sequence
        for api in apis:
            logger.info(f"Fetching {count} videos using {api} API")

            if api == "pexels":
                try:
                    api_videos = self._fetch_from_pexels(query, count, min_duration)
                    if api_videos:  # If we got videos, add them and stop trying
                        videos.extend(api_videos)
                        break
                except Exception as e:
                    logger.error(f"Error fetching videos from Pexels: {e}")
                    # Continue to next API
            else:  # pixabay
                try:
                    api_videos = self._fetch_from_pixabay(query, count, min_duration)
                    if api_videos:  # If we got videos, add them and stop trying
                        videos.extend(api_videos)
                        break
                except Exception as e:
                    logger.error(f"Error fetching videos from Pixabay: {e}")
                    # Continue to next API

        # If we have fewer videos than requested, but at least one, return what we have
        if not videos:
            logger.warning(f"Could not fetch any videos for query: {query}")

        return videos[:count]

    @measure_time
    def _fetch_from_pixabay(self, query, count, min_duration):
        """
        Fetch background videos from Pixabay API

        Args:
            query (str): Search term for videos
            count (int): Number of videos to fetch
            min_duration (int): Minimum video duration in seconds

        Returns:
            list: Paths to downloaded video files
        """
        try:
            url = f"https://pixabay.com/api/videos/?key={self.pixabay_api_key}&q={query}&min_width=1080&min_height=1920&per_page=20"
            response = requests.get(url) # make a request to the API
            if response.status_code == 200: # if the request is successful
                data = response.json()  # changes the response in json to py dict data
                videos = data.get("hits", []) # get the videos from the data
                video_paths = []
                # Randomly select videos from the top 10
                top_videos = videos[:10]
                # Then randomly select 'count' videos from the top 10
                if len(top_videos) > count:
                    selected_videos = random.sample(top_videos, count)
                else:
                    selected_videos = top_videos

                # Check if we have videos to process
                if not selected_videos:
                    logger.warning(f"No videos found from Pixabay for query: {query}")
                    return []

                def download_and_check_video(video):
                    try:
                        video_url = video["videos"]["large"]["url"]
                        video_path = os.path.join(self.temp_dir, f"pixabay_{video['id']}.mp4") # create a path for the video
                        with requests.get(video_url, stream=True) as r:  # get the video from the url
                            r.raise_for_status() # raise an error if the request is not successful
                            with open(video_path, 'wb') as f: # open the video file in write binary mode
                                for chunk in r.iter_content(chunk_size=8192): # iterate over the content of the video
                                    f.write(chunk)
                        clip = VideoFileClip(video_path)
                        if clip.duration >= min_duration:
                            clip.close()
                            return video_path
                        clip.close()
                        # Remove the video if it's too short
                        if os.path.exists(video_path):
                            os.remove(video_path)
                        return None
                    except Exception as e:
                        logger.error(f"Error downloading video from Pixabay: {e}")
                        return None

                # Use ThreadPoolExecutor to download videos in parallel
                num_workers = max(1, min(len(selected_videos), 5))
                with concurrent.futures.ThreadPoolExecutor(max_workers=num_workers) as executor:
                    # Submit all download tasks and collect futures
                    future_to_video = {executor.submit(download_and_check_video, video): video for video in selected_videos}

                    # Process completed futures
                    for future in concurrent.futures.as_completed(future_to_video):
                        video_path = future.result()
                        if video_path:
                            video_paths.append(video_path)

                return video_paths

            # If response wasn't 200, return empty list
            logger.warning(f"Pixabay API returned status code {response.status_code}")
            return []
        except Exception as e:
            logger.error(f"Error fetching videos from Pixabay: {e}")
            return []

    @measure_time
    def _fetch_from_pexels(self, query, count=5, min_duration=15):
        """
        Fetch background videos from Pexels API

        Args:
            query (str): Search term for videos
            count (int): Number of videos to fetch
            min_duration (int): Minimum video duration in seconds

        Returns:
            list: Paths to downloaded video files
        """
        try:
            url = f"https://api.pexels.com/videos/search?query={query}&per_page=20&orientation=portrait"
            headers = {"Authorization": self.pexels_api_key}
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                data = response.json()
                videos = data.get("videos", [])
                video_paths = []
                # Randomly select videos from the top 10
                top_videos = videos[:10]
                # Then randomly select 'count' videos from those top 10
                if len(top_videos) > count:
                    selected_videos = random.sample(top_videos, count)
                else:
                    selected_videos = top_videos

                def download_and_check_video(video):
                    try:
                        video_files = video.get("video_files", []) # get the video files
                        if not video_files:
                            return None

                        video_url = video_files[0].get("link") # get the video link
                        if not video_url:
                            return None

                        video_path = os.path.join(self.temp_dir, f"pexels_{video['id']}.mp4")
                        with requests.get(video_url, stream=True) as r:
                            r.raise_for_status()
                            with open(video_path, 'wb') as f:
                                for chunk in r.iter_content(chunk_size=8192):
                                    f.write(chunk)

                        clip = VideoFileClip(video_path)
                        if clip.duration >= min_duration:
                            clip.close()
                            return video_path
                        clip.close()
                        # Remove the video if it's too short
                        if os.path.exists(video_path):
                            os.remove(video_path)
                        return None
                    except Exception as e:
                        logger.error(f"Error downloading video from Pexels: {e}")
                        return None

                # Check if we have videos to process before ThreadPoolExecutor
                if not selected_videos:
                    logger.warning(f"No videos found from Pexels for query: {query}")
                    return []

                # Use ThreadPoolExecutor with at least 1 worker
                num_workers = max(1, min(len(selected_videos), 5))
                with concurrent.futures.ThreadPoolExecutor(max_workers=num_workers) as executor:
                    # Submit all download tasks and collect futures
                    future_to_video = {executor.submit(download_and_check_video, video): video for video in selected_videos}

                    # Process completed futures
                    for future in concurrent.futures.as_completed(future_to_video):
                        video_path = future.result()
                        if video_path:
                            video_paths.append(video_path)

                return video_paths

            # If response wasn't 200, return empty list
            logger.warning(f"Pexels API returned status code {response.status_code}")
            return []
        except Exception as e:
            logger.error(f"Error fetching videos from Pexels: {e}")
            return []

    @measure_time
    def _create_pill_image(self, size, color=(0, 0, 0, 160), radius=30):
        """
        Create a pill-shaped background image with rounded corners.

        Args:
            size (tuple): Size of the image (width, height)
            color (tuple): Color of the pill background (RGBA)
            radius (int): Radius of the rounded corners

        Returns:
            Image: PIL Image with the pill-shaped background
        """
        width, height = size
        img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # Draw the rounded rectangle
        draw.rectangle([(radius, 0), (width - radius, height)], fill=color)
        draw.rectangle([(0, radius), (width, height - radius)], fill=color)
        draw.ellipse([(0, 0), (radius * 2, radius * 2)], fill=color)
        draw.ellipse([(width - radius * 2, 0), (width, radius * 2)], fill=color)
        draw.ellipse([(0, height - radius * 2), (radius * 2, height)], fill=color)
        draw.ellipse([(width - radius * 2, height - radius * 2), (width, height)], fill=color)

        return img

    @measure_time
    def _create_text_clip(self, text, duration=5, font_size=60, font_path=None, color='white',
                          position='center', animation="fade", animation_duration=1.0, shadow=True,
                          outline=True, with_pill=False, pill_color=(0, 0, 0, 160), pill_radius=30):
        """
        Create a text clip with various effects and animations.

        Args:
            text (str): Text content
            duration (float): Duration in seconds
            font_size (int): Font size
            font_path (str): Path to font file
            color (str): Text color
            position (str): Position of text (top, center, bottom)
            animation (str): Animation type
            animation_duration (float): Duration of animation effects
            shadow (bool): Whether to add shadow
            outline (bool): Whether to add outline
            with_pill (bool): Whether to add pill background
            pill_color (tuple): RGBA color for pill background
            pill_radius (int): Radius for pill corners

        Returns:
            TextClip: MoviePy text clip with effects
        """
        if not font_path:
            font_path = self.body_font_path

        try:
            txt_clip = TextClip(
                txt=text,
                font=font_path,
                fontsize=font_size,
                color=color,
                method='caption',
                align='center',
                size=(self.resolution[0] - 100, None)
            )
        except Exception as e:
            logger.warning(f"Text rendering error with custom font: {e}. Using default.")
            txt_clip = TextClip(
                txt=text,
                fontsize=font_size,
                color=color,
                method='caption',
                align='center',
                size=(self.resolution[0] - 100, None)
            )

        txt_clip = txt_clip.set_duration(duration)
        clips = []

        # Add pill-shaped background if requested
        if with_pill:
            pill_image = self._create_pill_image(txt_clip.size, color=pill_color, radius=pill_radius)
            pill_clip = ImageClip(np.array(pill_image), duration=duration)
            clips.append(pill_clip)

        # Add shadow effect
        if shadow:
            shadow_clip = TextClip(
                txt=text,
                font=font_path,
                fontsize=font_size,
                color='black',
                method='caption',
                align='center',
                size=(self.resolution[0] - 100, None)
            ).set_position((5, 5), relative=True).set_opacity(0.7).set_duration(duration)
            clips.append(shadow_clip)

        # Add outline effect
        if outline:
            outline_clips = []
            for dx, dy in [(-1,-1), (-1,1), (1,-1), (1,1)]:
                oc = TextClip(
                    txt=text,
                    font=font_path,
                    fontsize=font_size,
                    color='black',
                    method='caption',
                    align='center',
                    size=(self.resolution[0] - 100, None)
                ).set_position((dx, dy), relative=True).set_opacity(0.5).set_duration(duration)
                outline_clips.append(oc)
            clips.extend(outline_clips)

        clips.append(txt_clip)
        text_composite = CompositeVideoClip(clips)

        # Set the position of the entire composite
        text_composite = text_composite.set_position(position)

        # Apply animation
        if animation in self.transitions:
            anim_func = self.transitions[animation]
            text_composite = anim_func(text_composite, animation_duration)

        # Create transparent background for the text
        bg = ColorClip(size=self.resolution, color=(0,0,0,0)).set_duration(duration)
        final_clip = CompositeVideoClip([bg, text_composite], size=self.resolution)

        return final_clip

    @measure_time
    def _create_word_by_word_clip(self, text, duration, font_size=60, font_path=None,
                             text_color=(255, 255, 255, 255),
                             pill_color=(0, 0, 0, 160),  # Semi-transparent black
                             position=('center', 'center')):
        """
        Create a word-by-word animation clip with pill-shaped backgrounds

            text: text to be animated
            duration: duration of the animation
            font_size: size of the font
            font_path: path to the font file
            text_color: color of the text
            pill_color: color of the pill background (with transparency)
            position: position of the text

        Returns:
            VideoClip: Word-by-word animation clip
        """
        if not font_path:
            font_path = self.body_font_path

        # Split text into words and calculate durations
        words = text.split()
        char_counts = [len(word) for word in words]
        total_chars = sum(char_counts)
        transition_duration = 0.02  # Faster transitions for better sync
        total_transition_time = transition_duration * (len(words) - 1)
        speech_duration = duration * 0.98  # Use more of the time for speech
        effective_duration = speech_duration - total_transition_time

        word_durations = []
        min_word_time = 0.2  # Slightly faster minimum word display time
        for word in words:
            char_ratio = len(word) / max(1, total_chars)
            word_time = min_word_time + (effective_duration - min_word_time * len(words)) * char_ratio
            word_durations.append(word_time)

        # Adjust durations to match total duration
        actual_sum = sum(word_durations) + total_transition_time
        if abs(actual_sum - duration) > 0.01:
            adjust_factor = (duration - total_transition_time) / sum(word_durations)
            word_durations = [d * adjust_factor for d in word_durations]

        clips = []
        current_time = 0

        for i, (word, word_duration) in enumerate(zip(words, word_durations)):
            # Create a function to draw the frame with the word on a pill background
            def make_frame_with_pill(word=word, font_size=font_size, font_path=font_path,
                                    text_color=text_color, pill_color=pill_color):
                # Load font
                font = ImageFont.truetype(font_path, font_size)

                # Calculate text size
                dummy_img = Image.new('RGBA', (1, 1))
                dummy_draw = ImageDraw.Draw(dummy_img)
                text_bbox = dummy_draw.textbbox((0, 0), word, font=font)
                text_width = text_bbox[2] - text_bbox[0]
                text_height = text_bbox[3] - text_bbox[1]

                # Get ascent and descent for more precise vertical positioning
                ascent, descent = font.getmetrics()

                # Add padding for the pill
                padding_x = int(font_size * 0.7)  # Horizontal padding
                padding_y = int(font_size * 0.35)  # Vertical padding

                # Create image
                img_width = text_width + padding_x * 2
                img_height = text_height + padding_y * 2

                # Create a transparent image
                img = Image.new('RGBA', (img_width, img_height), (0, 0, 0, 0))
                draw = ImageDraw.Draw(img)

                # Create the pill shape (rounded rectangle)
                radius = img_height // 2

                # Draw the pill
                # Draw the center rectangle
                draw.rectangle([(radius, 0), (img_width - radius, img_height)], fill=pill_color)
                # Draw the left semicircle
                draw.ellipse([(0, 0), (radius * 2, img_height)], fill=pill_color)
                # Draw the right semicircle
                draw.ellipse([(img_width - radius * 2, 0), (img_width, img_height)], fill=pill_color)

                # For horizontal centering:
                text_x = (img_width - text_width) // 2
                # For vertical centering:
                offset_y = (descent - ascent) // 4 # This small adjustment often helps
                text_y = (img_height - text_height) // 2 + offset_y

                draw.text((text_x, text_y), word, font=font, fill=text_color)

                return img

            # Create the frame with the word on a pill
            word_image = make_frame_with_pill()

            # Convert to clip
            word_clip = ImageClip(np.array(word_image), duration=word_duration)

            # Add to clips list
            clips.append(word_clip)

            # Update current time
            current_time += word_duration + transition_duration

        # Concatenate clips
        clips_with_transitions = []
        for i, clip in enumerate(clips):
            if i < len(clips) - 1:  # Not the last clip
                clip = clip.crossfadein(transition_duration)
            clips_with_transitions.append(clip)

        word_sequence = concatenate_videoclips(clips_with_transitions, method="compose")

        # Create a transparent background the size of the entire clip
        bg = ColorClip(size=self.resolution, color=(0,0,0,0)).set_duration(word_sequence.duration)

        # Position the word sequence in the center of the background
        positioned_sequence = word_sequence.set_position(position)

        # Combine the background and positioned sequence
        final_clip = CompositeVideoClip([bg, positioned_sequence], size=self.resolution)

        return final_clip

    @measure_time
    def custom_blur(self, clip, radius=5):
        """
        Apply a Gaussian blur effect to video clips

        Args:
            clip (VideoClip): Video clip to blur
            radius (int): Blur radius

        Returns:
            VideoClip: Blurred video clip
        """
        def blur_frame(get_frame, t):
            frame = get_frame(t)
            img = Image.fromarray(frame)
            blurred = img.filter(ImageFilter.GaussianBlur(radius=radius))
            return np.array(blurred)

        def apply_blur(get_frame, t):
            return blur_frame(get_frame, t)

        return clip.fl(apply_blur)

    @measure_time
    def custom_edge_blur(self, clip, edge_width=50, radius=10):
        """
        Apply blur only to the edges of a video clip

        Args:
            clip (VideoClip): Video clip to blur edges of
            edge_width (int): Width of the edge to blur
            radius (int): Blur radius

        Returns:
            VideoClip: Video clip with blurred edges
        """
        def blur_frame(get_frame, t):
            frame = get_frame(t)
            img = Image.fromarray(frame)
            width, height = img.size

            # Create a mask for the unblurred center
            mask = Image.new('L', (width, height), 0)
            draw = ImageDraw.Draw(mask)
            draw.rectangle(
                [(edge_width, edge_width), (width - edge_width, height - edge_width)],
                fill=255
            )

            # Blur the entire image
            blurred = img.filter(ImageFilter.GaussianBlur(radius=radius))

            # Composite the blurred image with the original using the mask
            composite = Image.composite(img, blurred, mask)

            return np.array(composite)

        def apply_edge_blur(get_frame, t):
            return blur_frame(get_frame, t)

        return clip.fl(apply_edge_blur)

    @measure_time
    def _process_background_clip(self, clip, target_duration, blur_background=False, edge_blur=False):
        """
        Process a background clip to match the required duration

        Args:
            clip (VideoClip): The video clip to process
            target_duration (float): The desired duration in seconds
            blur_background (bool): Whether to apply blur effect
            edge_blur (bool): Whether to apply edge blur effect

        Returns:
            VideoClip: Processed clip with matching duration
        """
        # Handle videos shorter than needed duration with proper looping
        if clip.duration < target_duration:
            # Create enough loops to cover the needed duration
            loops_needed = int(np.ceil(target_duration / clip.duration))
            looped_clips = []

            for loop in range(loops_needed):
                if loop == loops_needed - 1:
                    # For the last segment, only take what we need
                    remaining_needed = target_duration - (loop * clip.duration)
                    if remaining_needed > 0:
                        segment = clip.subclip(0, min(remaining_needed, clip.duration))
                        looped_clips.append(segment)
                else:
                    looped_clips.append(clip.copy())

            clip = concatenate_videoclips(looped_clips)
        else:
            # If longer than needed, take a random segment
            if clip.duration > target_duration + 1:
                max_start = clip.duration - target_duration - 0.5
                start_time = random.uniform(0, max_start)
                clip = clip.subclip(start_time, start_time + target_duration)
            else:
                # Just take from the beginning if not much longer
                clip = clip.subclip(0, target_duration)

        # Resize to match height
        clip = clip.resize(height=self.resolution[1])

       # Apply blur effect only if requested
        if blur_background and not edge_blur:
            clip = self.custom_blur(clip, radius=5)
        elif edge_blur:
            clip = self.custom_edge_blur(clip, edge_width=75, radius=10)

        # Center the video if it's not wide enough
        if clip.w < self.resolution[0]:
            bg = ColorClip(size=self.resolution, color=(0, 0, 0)).set_duration(clip.duration)
            x_pos = (self.resolution[0] - clip.w) // 2
            clip = CompositeVideoClip([bg, clip.set_position((x_pos, 0))], size=self.resolution)

        # Crop width if wider than needed
        elif clip.w > self.resolution[0]:
            x_centering = (clip.w - self.resolution[0]) // 2
            clip = clip.crop(x1=x_centering, x2=x_centering + self.resolution[0])

        # Make sure we have exact duration to prevent timing issues
        clip = clip.set_duration(target_duration)

        return clip

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

    @measure_time
    def create_youtube_short(self, title, script_sections, background_query="abstract background",
                            output_filename=None, add_captions=False, style="video", voice_style=None, max_duration=25,
                            background_queries=None, blur_background=False, edge_blur=False, custom_background_path=None,
                            progress_callback=None):
        """
        Create a YouTube short video with narrated script and background video

        Args:
            title: Title of the script to display
            script_sections: List of script sections to narrate
            background_query: Query for background videos
            output_filename: Name of output file (generated if None)
            add_captions: Whether to add captions
            style: Video style ('video' or 'slideshow')
            voice_style: Voice style for TTS
            max_duration: Maximum duration in seconds
            background_queries: Optional list of specific queries for each section
            blur_background: Whether to blur the background
            edge_blur: Whether to apply edge blur effect
            custom_background_path: Path to custom background file
            progress_callback: Optional callback function to track rendering progress

        Returns:
            Path to the created video
        """
        # Create output filename if not provided
        if not output_filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_filename = os.path.join(self.output_dir, f"short_{timestamp}.mp4")

        logger.info(f"Creating YouTube short: {title}")
        logger.info(f"Script has {len(script_sections)} sections")

        # Calculate optimal number of backgrounds based on duration
        # We want roughly 1 background per 5 seconds
        optimal_bg_count = max(1, int(max_duration / 5))
        logger.info(f"Using optimal background count of {optimal_bg_count} for {max_duration}s duration")

        # Ensure we have an output directory
        os.makedirs(os.path.dirname(os.path.abspath(output_filename)), exist_ok=True)

        try:
            # Time tracking
            start_time = time.time()
            
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
                            # Try calling without arguments first (for compatibility with video_progress_tracker)
                            return progress_callback()
                        except TypeError:
                            # If that fails, try calling with default progress values
                            try:
                                return progress_callback(75, "Processing video")
                            except Exception as e:
                                logger.error(f"Error calling progress callback: {e}")
                                return False
                    return False
            else:
                # No-op if no callback provided
                def check_progress():
                    return False

            # Process background videos - limit the count based on duration
            background_clips = []

            # Check if we have a custom background path
            if custom_background_path and os.path.exists(custom_background_path):
                logger.info(f"Using custom background: {custom_background_path}")

                try:
                    # Use user-provided background video
                    custom_clip = VideoFileClip(custom_background_path)

                    # Create the optimal number of background clips
                    for _ in range(min(optimal_bg_count, len(script_sections))):
                        # Copy the clip for each section to avoid modification issues
                        background_clips.append(custom_clip.copy())

                except Exception as e:
                    logger.error(f"Error loading custom background: {e}")
                    background_clips = []
            else:
                # Use generated backgrounds
                logger.info(f"Fetching background videos for query: {background_query}")

                # If specific background queries are provided, use them but limit to optimal count
                if background_queries and len(background_queries) > 0:
                    # Limit to optimal count
                    limited_queries = background_queries[:optimal_bg_count]
                    logger.info(f"Using {len(limited_queries)} background queries out of {len(background_queries)}")

                    # Fetch different background for each section
                    for query in limited_queries:
                        try:
                            clips = self._fetch_videos(query, count=1)
                            if clips:
                                background_clips.append(VideoFileClip(clips[0]))
                            else:
                                # If fetch fails, use a fallback solid color clip
                                background_clips.append(ColorClip(self.resolution, color=(0, 0, 0)))
                        except Exception as e:
                            logger.error(f"Error fetching background for query '{query}': {e}")
                            # Fallback to solid color
                            background_clips.append(ColorClip(self.resolution, color=(0, 0, 0)))
                else:
                    # Fetch a set of backgrounds based on optimal count
                    try:
                        video_paths = self._fetch_videos(background_query, count=optimal_bg_count)

                        if not video_paths:
                            logger.warning("No background videos found, using solid colors")
                            # Create solid color clips as fallback
                            for _ in range(optimal_bg_count):
                                background_clips.append(ColorClip(self.resolution, color=(0, 0, 0)))
                        else:
                            # Load videos
                            for path in video_paths:
                                try:
                                    background_clips.append(VideoFileClip(path))
                                except Exception as e:
                                    logger.error(f"Error loading background video {path}: {e}")
                                    # Fallback to solid color
                                    background_clips.append(ColorClip(self.resolution, color=(0, 0, 0)))
                    except Exception as e:
                        logger.error(f"Error fetching background videos: {e}")
                        # Create solid color clips as fallback
                        for _ in range(optimal_bg_count):
                            background_clips.append(ColorClip(self.resolution, color=(0, 0, 0)))

            # Ensure we have at least as many background clips as sections by duplicating if needed
            if len(background_clips) < len(script_sections):
                logger.info(f"Duplicating backgrounds to match {len(script_sections)} sections")
                while len(background_clips) < len(script_sections):
                    # Duplicate existing backgrounds cyclically
                    index = len(background_clips) % len(background_clips)
                    background_clips.append(background_clips[index].copy())

            # Process backgrounds - resize, blur if needed
            processed_bg_clips = []
            for i, bg_clip in enumerate(background_clips):
                # Check progress and abort if requested
                if check_progress():
                    logger.info("Progress callback requested abort")
                    return None
                    
                if bg_clip is not None:
                    try:
                        # Process each background clip (resize, apply effects)
                        processed_clip = self._process_background_clip(
                            bg_clip,
                            max_duration / len(background_clips),
                            blur_background=blur_background,
                            edge_blur=edge_blur
                        )
                        processed_bg_clips.append(processed_clip)
                    except Exception as e:
                        logger.error(f"Error processing background clip {i}: {e}")
                        # Fallback to a solid color clip
                        processed_bg_clips.append(ColorClip(self.resolution, color=(0, 0, 0)).set_duration(max_duration / len(background_clips)))
                else:
                    # If bg_clip is None, use a fallback
                    processed_bg_clips.append(ColorClip(self.resolution, color=(0, 0, 0)).set_duration(max_duration / len(background_clips)))

            # Replace the original list with processed clips
            background_clips = processed_bg_clips

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
            if progress_callback:
                try:
                    progress_callback(10, "Generating TTS audio for script sections")
                except:
                    pass

            # Try unified audio generation with text synchronization approach
            # Similar to the approach in image_maker.py
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
            section_durations = []
            
            try:
                # Create a single audio file for all sections
                full_audio_path = self._generate_audio(combined_text, voice_style=voice_style)
                
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
                        section_durations.append((i, section_duration))
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
                            self._generate_audio,
                            section_text,
                            section_voice_style
                        )
                        future_to_section[future] = (i, section)
                    
                    # Process results as they complete
                    for future in concurrent.futures.as_completed(future_to_section):
                        i, section = future_to_section[future]
                        min_section_duration = max(3, section.get('duration', 5))
                        
                        try:
                            audio_path = future.result()
                            if audio_path and os.path.exists(audio_path):
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
                                        section_durations.append((i, min_section_duration))
                                    else:
                                        audio_clips.append((i, audio_clip, actual_duration))
                                        section_durations.append((i, min(actual_duration, min_section_duration)))
                                except Exception as e:
                                    logger.error(f"Error processing audio file for section {i}: {e}")
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
            logger.info(f"Final total audio duration: {total_duration:.1f}s" if 'total_duration' in locals() else "Audio generation completed")

            # Progress update
            if progress_callback:
                try:
                    progress_callback(25, "Processing video sections")
                except:
                    pass

            # Create final video
            section_clips = []

            for i, (section, bg_clip) in enumerate(zip(script_sections, background_clips)):
                # Check progress and abort if requested
                if check_progress():
                    logger.info("Progress callback requested abort")
                    return None
                    
                try:
                    # Get matching audio clip for this section
                    matching_audio = None
                    for idx, audio_clip, audio_duration in audio_clips:
                        if idx == i:
                            matching_audio = audio_clip
                            # Make sure the audio matches the background duration
                            if abs(audio_duration - section.get('duration', 5)) > 0.1:
                                logger.info(f"Adjusting audio duration for section {i} " +
                                          f"from {audio_duration:.2f}s to {section.get('duration', 5):.2f}s")
                                matching_audio = matching_audio.set_duration(section.get('duration', 5))
                            break
                    
                    if not matching_audio:
                        logger.warning(f"No matching audio found for section {i}, creating silent audio")
                        # Create silent audio
                        def silent_frame(t):
                            return np.zeros(2)  # Stereo silence
                        matching_audio = AudioClip(make_frame=silent_frame, duration=section.get('duration', 5))
                        matching_audio = matching_audio.set_fps(44100)

                    # Get section duration (use audio duration to ensure sync)
                    section_duration = matching_audio.duration
                    logger.info(f"Processing section {i}: duration={section_duration:.2f}s")

                    # Ensure background clip is long enough
                    if bg_clip.duration < section_duration:
                        logger.warning(f"Section duration ({section_duration:.2f}s) exceeds available background ({bg_clip.duration:.2f}s), looping")
                        # Instead of using vfx.loop which causes serialization issues, manually create a looped clip
                        loops_needed = int(np.ceil(section_duration / bg_clip.duration))
                        looped_clips = []

                        for _ in range(loops_needed):
                            looped_clips.append(bg_clip.copy())

                        # Concatenate the loops
                        try:
                            # Fix any position issues in looped clips before concatenation
                            for j, looped_clip in enumerate(looped_clips):
                                if hasattr(looped_clip, 'pos') and callable(looped_clip.pos):
                                    try:
                                        # Sample at middle of clip
                                        mid_time = looped_clip.duration / 2
                                        mid_pos = looped_clip.pos(mid_time)

                                        # Fix nested tuples
                                        if isinstance(mid_pos, tuple) and len(mid_pos) > 0 and isinstance(mid_pos[0], tuple):
                                            mid_pos = mid_pos[0]
                                            logger.debug(f"Flattened nested position tuple in looped clip {j}")

                                        looped_clips[j] = looped_clip.set_position(mid_pos)
                                    except Exception as e:
                                        logger.warning(f"Failed to fix clip position: {e}, using default")
                                        looped_clips[j] = looped_clip.set_position('center')

                            bg_clip = concatenate_videoclips(looped_clips)
                        except Exception as concat_error:
                            logger.error(f"Error looping background clip: {concat_error}, using unlooped clip")
                    
                    # Trim or pad bg_clip to match section_duration exactly
                    bg_clip = bg_clip.subclip(0, section_duration)
                    bg_clip = bg_clip.set_duration(section_duration)
                    
                    # Create text overlay for this section
                    text = section["text"]
                    text_clip = None
                    try:
                        # Create text overlay
                        text_clip = self._create_text_clip(
                            text,
                            duration=section_duration,
                            font_size=60,
                            position=('center', 0.8),  # Lower on screen
                            animation="fade",
                            with_pill=True
                        )
                    except Exception as e:
                        logger.error(f"Error creating text clip for section {i}: {e}")
                        # Create empty text clip as fallback
                        text_clip = ColorClip(
                            size=(1, 1),
                            color=(0, 0, 0, 0),
                            duration=section_duration
                        ).set_opacity(0)
                    
                    # Add text and audio to background
                    try:
                        # Verify clip dimensions and positions
                        if text_clip.size[0] > bg_clip.size[0] or text_clip.size[1] > bg_clip.size[1]:
                            logger.warning(f"Text clip size {text_clip.size} exceeds background {bg_clip.size}, resizing")
                            text_clip = text_clip.resize(width=min(text_clip.size[0], bg_clip.size[0]))
                        
                        # Composite background, text and add audio
                        composite_clip = CompositeVideoClip([bg_clip, text_clip])
                        composite_clip = composite_clip.set_audio(matching_audio)
                        
                        # Ensure duration is consistent
                        composite_clip = composite_clip.set_duration(section_duration)
                        
                        # Store the section clip
                        section_clips.append(composite_clip)
                    except Exception as e:
                        logger.error(f"Error compositing section {i}: {e}")
                        # Create a fallback clip
                        logger.warning(f"Creating fallback clip for section {i}")
                        
                        try:
                            # Use just the background with audio as fallback
                            fallback_clip = bg_clip.set_audio(matching_audio)
                            section_clips.append(fallback_clip)
                        except Exception as fallback_error:
                            logger.error(f"Even fallback clip creation failed: {fallback_error}")
                            # Last resort: create a blank clip with audio
                            blank_clip = ColorClip(self.resolution, color=(0, 0, 0)).set_duration(section_duration)
                            blank_clip = blank_clip.set_audio(matching_audio)
                            section_clips.append(blank_clip)
                except Exception as section_error:
                    logger.error(f"Error processing section {i}: {section_error}")
                    # Create a fallback clip for this section
                    section_duration = section.get('duration', 5)
                    blank_clip = ColorClip(self.resolution, color=(0, 0, 0)).set_duration(section_duration)
                    
                    # Try to add audio if available
                    try:
                        # Look for audio for this section
                        matching_audio = None
                        for idx, audio_clip, _ in audio_clips:
                            if idx == i:
                                matching_audio = audio_clip
                                break
                        
                        if matching_audio:
                            blank_clip = blank_clip.set_audio(matching_audio)
                        else:
                            # Create silent audio
                            def silent_frame(t):
                                return np.zeros(2)
                            silent_audio = AudioClip(make_frame=silent_frame, duration=section_duration)
                            silent_audio = silent_audio.set_fps(44100)
                            blank_clip = blank_clip.set_audio(silent_audio)
                    except Exception as audio_error:
                        logger.error(f"Error adding audio to fallback clip: {audio_error}")
                    
                    section_clips.append(blank_clip)

            # Create watermark for the entire video duration
            total_duration = sum(clip.duration for clip in section_clips)
            watermark = self._create_watermark(total_duration)

            if watermark:
                # Add watermark to each section clip with memory error handling
                processed_section_clips = []
                for clip in section_clips:
                    # Use our safer compositing method
                    watermarked_clip = self._safely_create_composite(
                        [clip, watermark.set_duration(clip.duration)],
                        duration=clip.duration
                    )
                    processed_section_clips.append(watermarked_clip)
                section_clips = processed_section_clips

            # Process and validate section clips
            validated_section_clips = []
            for i, clip in enumerate(section_clips):
                try:
                    # Ensure audio duration is valid for this section
                    if clip.audio is not None:
                        # Get actual duration of the audio and clip
                        audio_duration = clip.audio.duration
                        clip_duration = clip.duration

                        # If audio is too short, loop or extend it
                        if audio_duration < clip_duration:
                            logger.warning(f"Audio for section {i} is shorter than clip ({audio_duration}s vs {clip_duration}s), extending")
                            # Create a new audio that exactly matches the clip duration
                            from moviepy.audio.AudioClip import CompositeAudioClip, AudioClip
                            extended_audio = clip.audio.set_duration(clip_duration)
                            clip = clip.set_audio(extended_audio)

                        # If audio is longer, trim it
                        elif audio_duration > clip_duration:
                            logger.warning(f"Audio for section {i} is longer than clip ({audio_duration}s vs {clip_duration}s), trimming")
                            trimmed_audio = clip.audio.subclip(0, clip_duration)
                            clip = clip.set_audio(trimmed_audio)

                    validated_section_clips.append(clip)
                except Exception as e:
                    logger.error(f"Error validating section clip {i}: {e}")
                    # Use clip as-is if validation fails
                    validated_section_clips.append(clip)

            # Try parallel rendering first
            try:
                logger.info("Using parallel renderer for improved performance")

                # Check for dill library - needed for optimal parallel rendering
                try:
                    import dill
                    logger.info(f"Found dill {dill.__version__} for improved serialization")
                except ImportError:
                    logger.warning("Dill library not found - parallel rendering may be less efficient")
                    logger.warning("Consider installing dill with: pip install dill")

                from .parallel_renderer import render_clips_in_parallel
                output_filename = render_clips_in_parallel(
                    validated_section_clips,
                    output_filename,
                    temp_dir=self.temp_dir,
                    fps=self.fps,
                    preset="ultrafast"  # Changed from veryfast to ultrafast for faster rendering
                )
            except Exception as parallel_error:
                logger.warning(f"Parallel renderer failed: {parallel_error}. Using standard rendering.")

                # Use standard rendering as fallback
                logger.info("Starting standard video rendering")
                try:
                    # Concatenate all section clips
                    final_clip = concatenate_videoclips(validated_section_clips)

                    # Write final video with reduced memory settings
                    # Set up a progress_function that reports every 5% of frames
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

                    final_clip.write_videofile(
                        output_filename,
                        fps=self.fps,
                        codec="libx264",
                        audio_codec="aac",
                        threads=2,  # Using fewer threads to reduce memory usage
                        preset="ultrafast",  # Faster encoding, less memory usage
                        ffmpeg_params=[
                            "-pix_fmt", "yuv420p",  # For compatibility with all players
                            "-profile:v", "main",   # Better compatibility with mobile devices
                            "-crf", "25",           # Reduced quality slightly to save memory
                            "-maxrate", "2M",       # Reduced bitrate to save memory
                            "-bufsize", "4M"        # Reduced buffer size
                        ],
                        logger="bar",        # Enable progress bar
                        callback=write_progress  # Use our custom progress function
                    )
                finally:
                    # Clean up all clips
                    for clip in validated_section_clips:
                        try:
                            clip.close()
                        except:
                            pass

            # Final cleanup
            self._cleanup()

            return output_filename

        except Exception as e:
            logger.error(f"Error in create_youtube_short: {e}")
            # If there's a temp directory, clean it up
            if hasattr(self, 'temp_dir') and os.path.exists(self.temp_dir):
                try:
                    shutil.rmtree(self.temp_dir)
                except Exception as cleanup_error:
                    logger.error(f"Error cleaning up temp directory: {cleanup_error}")
            raise

    def _cleanup(self):
        """Clean up temporary files"""
        try:
            # Instead of deleting the whole temp directory at once, try to delete files individually
            for root, dirs, files in os.walk(self.temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    try:
                        os.remove(file_path)
                    except Exception as file_error:
                        logger.warning(f"Could not remove file {file_path}: {str(file_error)}")

            # Try to remove empty directories
            try:
                shutil.rmtree(self.temp_dir)
                logger.info("Temporary directory cleaned up successfully.")
            except Exception as dir_error:
                logger.warning(f"Could not remove temp directory: {str(dir_error)}")
                # If directory removal fails, schedule it for deletion on exit
                import atexit
                atexit.register(lambda path=self.temp_dir: shutil.rmtree(path, ignore_errors=True))

        except Exception as e:
            logger.warning(f"Error cleaning up temporary files: {str(e)}")

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

    def _generate_audio(self, section, voice_style=None):
        """
        Generate audio for a script section using the configured TTS service

        Args:
            section: Script section (string or dictionary)
            voice_style: Voice style to use

        Returns:
            Path to the generated audio file or None if all methods fail
        """
        # Handle both string and dictionary section formats
        text = section
        if isinstance(section, dict):
            text = section.get('text', '')
            # Allow per-section voice style override
            voice_style = section.get('voice_style', voice_style)

        # Create a unique filename based on content hash and voice style
        # This enables caching for repeated sections
        section_hash = str(hash(text + str(voice_style)))[:12]
        section_audio_file = os.path.join(self.temp_dir, f"section_{section_hash}.mp3")
        
        # Check if we already have this audio cached
        if os.path.exists(section_audio_file):
            logger.info(f"Using cached audio for section: {text[:20]}...")
            return section_audio_file

        logger.info(f"Generating audio for text: \"{text[:50]}{'...' if len(text) > 50 else ''}\" (length: {len(text)})")
        if voice_style:
            logger.info(f"Voice style requested: {voice_style}")
            
        # Create a unique filename based on content hash and timestamp
        timestamp = int(time.time())
        section_audio_file = os.path.join(self.temp_dir, f"section_{section_hash}_{timestamp}.mp3")
        logger.info(f"Output file: {section_audio_file}")

        # Try Google Cloud TTS first if available
        if self.google_tts:
            try:
                logger.info("Attempting to use Google Cloud TTS")
                audio_path = self.google_tts.generate_speech(
                    text,
                    output_filename=section_audio_file,
                    voice_style=voice_style
                )
                logger.info(f"Successfully generated audio using Google Cloud TTS: {audio_path}")
                return audio_path
            except Exception as e:
                logger.error(f"Google Cloud TTS failed: {str(e)}")
                logger.error(f"Falling back to Azure TTS or gTTS")
                import traceback
                logger.error(f"Google TTS error traceback: {traceback.format_exc()}")

        # Try Azure TTS next if available
        if self.azure_tts:
            try:
                logger.info("Attempting to use Azure TTS")
                audio_path = self.azure_tts.generate_speech(
                    text,
                    output_filename=section_audio_file,
                    voice_style=voice_style
                )
                logger.info(f"Successfully generated audio using Azure TTS: {audio_path}")
                return audio_path
            except Exception as e:
                logger.error(f"Azure TTS failed: {str(e)}")
                logger.error(f"Falling back to gTTS")
                import traceback
                logger.error(f"Azure TTS error traceback: {traceback.format_exc()}")

        # Fall back to gTTS (Google's free TTS)
        logger.info("Using gTTS fallback")
        retry_count = 0
        max_retries = 3
        
        while retry_count < max_retries:
            try:
                logger.info(f"gTTS attempt {retry_count+1}/{max_retries}")
                tts = gTTS(text=text, lang='en', slow=False)
                tts.save(section_audio_file)
                logger.info(f"Successfully created TTS audio with gTTS: {section_audio_file}")
                return section_audio_file
            except requests.exceptions.RequestException as e:
                logger.error(f"Network error in gTTS (attempt {retry_count+1}/{max_retries}): {e}")
                time.sleep(2)
                retry_count += 1
            except Exception as e:
                logger.error(f"gTTS error (attempt {retry_count+1}/{max_retries}): {e}")
                time.sleep(2)
                retry_count += 1
                
        # If all TTS methods fail, create a silent audio clip
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
            silent_clip.write_audiofile(section_audio_file, fps=44100, nbytes=2, codec='libmp3lame')

            logger.info(f"Created silent audio clip as fallback: {section_audio_file}")
            return section_audio_file
        except Exception as e:
            logger.error(f"Failed to create even silent audio: {e}")
            raise


