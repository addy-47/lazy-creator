import os
import time
import random
import subprocess
import requests
import numpy as np
import logging
from PIL import Image, ImageFilter, ImageDraw, ImageFont
from moviepy.editor import (
    VideoFileClip, VideoClip, TextClip, CompositeVideoClip, ImageClip,AudioClip,
    AudioFileClip, concatenate_videoclips, ColorClip, CompositeAudioClip
)
from moviepy.config import change_settings
change_settings({"IMAGEMAGICK_BINARY": "magick"})
from gtts import gTTS
from dotenv import load_dotenv
import shutil
import tempfile
import concurrent.futures
from typing import List, Dict, Union, Optional

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class YTShortsCreator:
    def __init__(self, output_dir="output", fps=30):
        """Initialize YouTube Shorts creator with configurable options"""
        # Setup directories
        self.output_dir = output_dir
        self.temp_dir = tempfile.mkdtemp()
        os.makedirs(output_dir, exist_ok=True)

        # Video settings
        self.resolution = (1080, 1920)
        self.fps = fps
        self.audio_sync_offset = 0.25

        # Font settings
        self.fonts_dir = os.path.join(os.path.dirname(__file__), 'fonts')
        os.makedirs(self.fonts_dir, exist_ok=True)
        self.title_font_path = self._get_font_path("default_font.ttf")
        self.body_font_path = self._get_font_path("default_font.ttf")

        # API configurations
        load_dotenv()
        self.pexels_api_key = os.getenv("PEXELS_API_KEY")
        self.pixabay_api_key = os.getenv("PIXABAY_API_KEY")
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

        # Setup transitions and cache
        self._setup_transitions()
        self.media_cache = {}

    def _get_font_path(self, font_name):

        """Get font path with fallback to system font"""
        font_path = os.path.join(self.fonts_dir, font_name)
        if not os.path.exists(font_path):
            try:
                from matplotlib.font_manager import findfont, FontProperties
                font_path = findfont(FontProperties(family=['sans-serif']))
            except:
                font_path = "Arial"
        return font_path

    def _setup_transitions(self):

        """Define transition effects"""
        self.transitions = {
            "fade": lambda clip, duration: clip.fadein(duration).fadeout(duration),
            "slide_left": lambda clip, duration: clip.set_position(
                lambda t: ((t/duration) * self.resolution[0] - clip.w if t < duration else 0, 'center')),
            "zoom_in": lambda clip, duration: clip.resize(lambda t: max(1, 1 + 0.5 * min(t/duration, 1))),
            "slide_up": lambda clip, duration: clip.set_position(
                lambda t: ('center', (t/duration) * self.resolution[1] - clip.h if t < duration else 0))
        }

        self.video_transitions = {
            "crossfade": lambda clip1, clip2, duration: concatenate_videoclips([
                clip1.set_end(clip1.duration),
                clip2.set_start(0).crossfadein(duration)
            ], padding=-duration, method="compose"),
            "fade_black": lambda clip1, clip2, duration: concatenate_videoclips([
                clip1.fadeout(duration),
                clip2.fadein(duration)
            ]),
            "slide_left": lambda clip1, clip2, duration: concatenate_videoclips([
                clip1.set_end(clip1.duration),
                clip2.set_start(0).set_position(lambda t: (
                    (t/duration) * self.resolution[0] if t < duration else 0, 'center'))
            ], padding=-duration, method="compose")
        }

    def _download_file(self, url, file_path):

        """Download file with retries and progress tracking"""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                with requests.get(url, stream=True, timeout=10) as r:
                    r.raise_for_status()
                    with open(file_path, 'wb') as f:
                        for chunk in r.iter_content(chunk_size=8192):
                            f.write(chunk)
                return True
            except Exception as e:
                logger.warning(f"Download attempt {attempt + 1} failed: {str(e)}")
                if attempt == max_retries - 1:
                    return False
                time.sleep(1)

    def create_youtube_short(self, config: Dict) -> str:
        """
        Create YouTube Short with flexible configuration

        Args:
            config (dict): Configuration dictionary with:
                - title (str): Video title
                - script_sections (list): List of dicts with text/duration
                - max_duration (int): 10,15,20,25,30 etc.
                - background_type: "image" or "video"
                - background_source: "provided" or "custom"
                - background_path: Required if custom source
                - background_query: Required if provided source
                - add_captions (bool): Whether to add captions
                - style (str): Visual style
                - voice_style (str): TTS style

        Returns:
            str: Path to created video
        """
        start_time = time.time()

        # Validate configuration
        self._validate_config(config)

        # Set output filename
        output_filename = self._get_output_filename(config.get("output_filename"))

        # Process script sections and durations
        script_sections = self._process_script_sections(
            config["script_sections"],
            config["max_duration"]
        )

        # Start audio processing in parallel with background preparation
        with concurrent.futures.ThreadPoolExecutor() as executor:
            # Start background preparation
            background_future = executor.submit(
                self._prepare_background,
                config["background_type"],
                config["background_source"],
                config.get("background_path"),
                config.get("background_query"),
                sum(s['duration'] for s in script_sections),
                script_sections
            )

            # Start audio generation in parallel
            audio_future = executor.submit(
                self._generate_tts_audio,
                script_sections
            )

            # Get results from futures
            background = background_future.result()
            audio_clips, updated_script_sections = audio_future.result()

        # Update script sections with any timing changes from audio generation
        script_sections = updated_script_sections

        # Create combined audio
        combined_audio = CompositeAudioClip(audio_clips) if audio_clips else None

        # Create text overlays
        text_clips = self._create_text_overlays(
            config.get("title"),
            script_sections,
            config.get("add_captions", False)
        )

        # Render final video
        self._render_final_video(
            background,
            text_clips,
            combined_audio,
            output_filename
        )

        logger.info(f"Video created in {time.time()-start_time:.1f}s")
        return output_filename

    def _validate_config(self, config: Dict) -> None:
        """Validate input configuration"""
        required = ['script_sections', 'max_duration', 'background_type', 'background_source']
        missing = [field for field in required if field not in config]
        if missing:
            raise ValueError(f"Missing required config fields: {missing}")

        if config['background_source'] == 'custom' and not config.get('background_path'):
            raise ValueError("Custom background requires background_path")

        if config['background_source'] == 'provided' and not config.get('background_query'):
            raise ValueError("Provided background requires background_query")

    def _get_output_filename(self, user_filename: Optional[str]) -> str:
        """Generate output filename if not provided"""
        if user_filename:
            # Check if user_filename already contains a path
            if os.path.sep in user_filename or '/' in user_filename:
                return user_filename  # Use as is if it's a full path
            else:
                return os.path.join(self.output_dir, user_filename)
        return os.path.join(self.output_dir, f"short_{int(time.time())}.mp4")

    def _process_script_sections(self, sections: List[Dict], max_duration: int) -> List[Dict]:
        """Process script sections and adjust durations"""
        total_duration = sum(s.get('duration', 5) for s in sections)

        if total_duration > max_duration:
            scale_factor = max_duration / total_duration
            logger.info(f"Scaling durations by {scale_factor:.2f}")
            for section in sections:
                section['duration'] = section.get('duration', 5) * scale_factor

        return sections

    def _prepare_background(self, background_type: str, background_source: str,
                      background_path: Optional[str], background_query: Optional[str],
                      total_duration: float, script_sections: List[Dict]) -> VideoClip:
        """Prepare background with proper segmentation"""
        # Calculate segment durations
        segment_durations = self._calculate_segment_durations(script_sections)
        transition_duration = 0.5

        # Add transition time to all segments except last
        for i in range(len(segment_durations)-1):
            segment_durations[i] += transition_duration

        # Fetch/process backgrounds
        if background_source == "custom":
            if background_type == "video":
                clip = VideoFileClip(background_path)
                return self._process_background_clip(clip, total_duration)
            else:  # image
                return ImageClip(background_path, duration=total_duration)\
                    .resize(height=self.resolution[1])\
                    .set_position('center')
        else:
            # Fetch multiple backgrounds for provided source
            bg_paths = []
            for _ in segment_durations:
                paths = self._fetch_videos(background_query, count=1, min_duration=5) if background_type == "video" \
                    else [self._fetch_unsplash_image(background_query)]
                if paths:
                    bg_paths.append(paths[0])

            if not bg_paths:
                raise ValueError("No backgrounds available")

            # Process in parallel
            with concurrent.futures.ThreadPoolExecutor() as executor:
                futures = []
                for path, duration in zip(bg_paths, segment_durations):
                    if background_type == "video":
                        futures.append(executor.submit(
                            self._process_background_clip,
                            VideoFileClip(path),
                            duration
                        ))
                    else:  # image
                        futures.append(executor.submit(
                            lambda p, d: ImageClip(p, duration=d)
                                        .resize(height=self.resolution[1])
                                        .set_position('center'),
                            path, duration
                        ))

                bg_clips = [f.result() for f in concurrent.futures.as_completed(futures)]

            # Create seamless background
            background = bg_clips[0]
            for i in range(1, len(bg_clips)):
                next_clip = bg_clips[i].crossfadein(transition_duration)
                background = concatenate_videoclips(
                    [background, next_clip],
                    padding=-transition_duration,
                    method="compose"
                )

            return background

    def _process_custom_video(self, video_path: str, duration: float) -> VideoClip:
        """Process user-provided video background"""
        clip = VideoFileClip(video_path)
        return self._process_background_clip(clip, duration)

    def _process_custom_image(self, image_path: str, duration: float) -> VideoClip:
        """Process user-provided image background"""
        img = ImageClip(image_path, duration=duration)
        return img.resize(height=self.resolution[1]).set_position('center')

    def _create_provided_video_background(self, query: str, total_duration: float,
                                        script_sections: List[Dict]) -> VideoClip:
        """Create video background from API sources"""
        segment_durations = self._calculate_segment_durations(script_sections)

        bg_paths = []
        for _ in range(len(segment_durations)):
            paths = self._fetch_videos(query, count=1, min_duration=5)
            if paths:
                bg_paths.append(paths[0])
            else:
                raise ValueError(f"No videos found for query: {query}")

        with concurrent.futures.ThreadPoolExecutor() as executor:
            futures = [
                executor.submit(
                    self._process_background_clip,
                    VideoFileClip(path),
                    duration
                )
                for path, duration in zip(bg_paths, segment_durations)
            ]
            bg_clips = [f.result() for f in concurrent.futures.as_completed(futures)]

        return self._create_seamless_background(bg_clips, total_duration)

    def _create_provided_image_background(self, query: str, total_duration: float,
                                        script_sections: List[Dict]) -> VideoClip:
        """Create image background from Unsplash"""
        image_path = self._fetch_unsplash_image(query)
        img = ImageClip(image_path, duration=total_duration)
        return img.resize(height=self.resolution[1]).set_position('center')

    def _fetch_unsplash_image(self, query: str) -> str:
        """Fetch image from Unsplash API"""
        cache_key = f"unsplash_{query}"
        if cache_key in self.media_cache:
            return self.media_cache[cache_key]

        try:
            url = f"https://api.unsplash.com/photos/random?query={query}&orientation=portrait&client_id={self.unsplash_api_key}"
            response = requests.get(url, timeout=10)
            response.raise_for_status()

            image_url = response.json()['urls']['regular']
            image_path = os.path.join(self.temp_dir, f"unsplash_{query.replace(' ', '_')}.jpg")

            with requests.get(image_url, stream=True) as img_r:
                img_r.raise_for_status()
                with open(image_path, 'wb') as f:
                    for chunk in img_r.iter_content(chunk_size=8192):
                        f.write(chunk)

            self.media_cache[cache_key] = image_path
            return image_path

        except Exception as e:
            logger.error(f"Unsplash API error: {e}")
            raise ValueError(f"Could not fetch image for query: {query}")

    def _calculate_segment_durations(self, script_sections: List[Dict]) -> List[float]:
        """Calculate durations for each background segment"""
        # Always use at least 3 segments (intro, middle, outro)
        num_segments = max(3, min(5, len(script_sections)))  # 3-5 segments max

        segment_durations = []

        # Intro segment (first section)
        segment_durations.append(script_sections[0]['duration'])

        # Middle segments (distribute remaining time)
        middle_duration = sum(s['duration'] for s in script_sections[1:-1])
        num_middle_segments = num_segments - 2  # subtract intro and outro

        if num_middle_segments > 0:
            middle_per_segment = middle_duration / num_middle_segments
            segment_durations.extend([middle_per_segment] * num_middle_segments)

        # Outro segment (last section)
        if len(script_sections) > 1:
            segment_durations.append(script_sections[-1]['duration'])

        return segment_durations

    def _create_seamless_background(self, bg_clips: List[VideoClip], total_duration: float) -> VideoClip:
        """Create seamless background with transitions"""
        transition_duration = 0.5
        final_bg = bg_clips[0]

        for i in range(1, len(bg_clips)):
            next_clip = bg_clips[i].crossfadein(transition_duration)
            final_bg = concatenate_videoclips(
                [final_bg, next_clip],
                padding=-transition_duration,
                method="compose"
            )

        if abs(final_bg.duration - total_duration) > 0.5:
            if final_bg.duration < total_duration:
                needed = total_duration - final_bg.duration + 0.8
                extra = self._process_background_clip(bg_clips[-1].copy(), needed)
                extra = extra.crossfadein(transition_duration)
                final_bg = concatenate_videoclips(
                    [final_bg, extra],
                    padding=-transition_duration,
                    method="compose"
                )
            else:
                final_bg = final_bg.subclip(0, total_duration)

        return final_bg

    def _process_background_clip(self, clip: VideoClip, target_duration: float,
                               blur_background: bool = False, edge_blur: bool = False) -> VideoClip:
        """Process background clip to match duration and apply effects"""
        # Scale resolution down for processing to save CPU cycles
        processing_scale = 0.5  # Process at half resolution
        original_size = clip.size

        if clip.size[0] > 540:  # Only scale down if resolution is high enough
            clip = clip.resize(width=int(clip.size[0] * processing_scale))

        # Handle duration
        if clip.duration < target_duration:
            loops = int(np.ceil(target_duration / clip.duration))
            clips = [clip] * loops
            clip = concatenate_videoclips(clips)

        clip = clip.subclip(0, target_duration)

        # Only apply effects if specifically requested (they're CPU intensive)
        if blur_background:
            clip = self.custom_blur(clip, radius=2)  # Reduced blur radius
        if edge_blur:
            clip = self.custom_edge_blur(clip, edge_width=50, radius=5)  # Reduced parameters

        # Scale back to original size for final output
        if clip.size != original_size:
            clip = clip.resize(width=original_size[0])

        return clip

    def _generate_tts_audio(self, script_sections: List[Dict]) -> tuple:
        """Generate TTS audio for all sections"""
        audio_clips = []
        current_time = 0

        for i, section in enumerate(script_sections):
            text = section['text']
            tts_path = os.path.join(self.temp_dir, f"tts_{i}.mp3")

            if self.azure_tts:
                try:
                    tts_path = self.azure_tts.generate_speech(
                        text,
                        output_filename=tts_path,
                        voice_style=section.get('voice_style', 'normal')
                    )
                except Exception as e:
                    logger.warning(f"Azure TTS failed: {e}. Using gTTS.")
                    tts = gTTS(text, lang='en', slow=True)
                    tts.save(tts_path)
            else:
                tts = gTTS(text, lang='en', slow=True)
                tts.save(tts_path)

            speech = AudioFileClip(tts_path)
            speech_duration = speech.duration

            if speech_duration > section['duration'] - 0.5:
                section['duration'] = speech_duration * 1.15

            speech = speech.set_start(current_time + 0.2)
            audio_clips.append(speech)
            current_time += section['duration']

        return audio_clips, script_sections

    def _create_text_overlays(self, title: Optional[str], script_sections: List[Dict],
                            add_captions: bool) -> List[VideoClip]:
        """Create all text overlays for the video"""
        text_clips = []
        current_time = 0

        for i, section in enumerate(script_sections):
            text = section['text']
            duration = section['duration']

            if i == 0 and title:
                title_clip = self._create_text_clip(
                    title, duration=duration, font_size=70,
                    position=('center', 150), animation="fade",
                    with_pill=True, pill_color=(0, 0, 0, 160)
                ).set_start(current_time)
                text_clips.append(title_clip)

            if i == 0 or i == len(script_sections) - 1:
                text_clip = self._create_text_clip(
                    text, duration=duration, font_size=55,
                    position=('center', 'center'), animation="fade",
                    with_pill=True, pill_color=(0, 0, 0, 160)
                ).set_start(current_time)
            else:
                text_clip = self._create_word_by_word_clip(
                    text, duration=duration, font_size=60,
                    position=('center', 'center')
                ).set_start(current_time)

            text_clips.append(text_clip)
            current_time += duration

            if add_captions:
                caption = self._create_text_clip(
                    text, duration=duration, font_size=40,
                    position=('center', self.resolution[1] - 200),
                    animation="fade"
                ).set_start(current_time - duration)
                text_clips.append(caption)

        return text_clips

    def _create_text_clip(self, text: str, duration: float = 5, font_size: int = 60,
                         font_path: Optional[str] = None, color: str = 'white',
                         position: Union[str, tuple] = 'center', animation: str = "fade",
                         animation_duration: float = 1.0, shadow: bool = False,
                         outline: bool = False, with_pill: bool = False,
                         pill_color: tuple = (0, 0, 0, 160), pill_radius: int = 30) -> VideoClip:
        """Create text clip with effects"""
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
            logger.warning(f"Text rendering error: {e}. Using default font.")
            txt_clip = TextClip(
                txt=text,
                fontsize=font_size,
                color=color,
                method='caption',
                align='center',
                size=(self.resolution[0] - 100, None))

        txt_clip = txt_clip.set_duration(duration)
        clips = []

        if with_pill:
            pill_image = self._create_pill_image(txt_clip.size, color=pill_color, radius=pill_radius)
            pill_clip = ImageClip(np.array(pill_image), duration=duration)
            clips.append(pill_clip)

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

        if outline:
            for dx, dy in [(-1,-1), (-1,1), (1,-1), (1,1)]:
                oc = TextClip(
                    txt=text,
                    font=font_path,
                    fontsize=font_size,
                    color='black',
                    method='caption',
                    align='center',
                    size=(self.resolution[0] - 100, None))
                oc.set_position((dx, dy), relative=True).set_opacity(0.5).set_duration(duration)
                clips.append(oc)

        clips.append(txt_clip)
        text_composite = CompositeVideoClip(clips).set_position(position)

        if animation in self.transitions:
            text_composite = self.transitions[animation](text_composite, animation_duration)

        bg = ColorClip(size=self.resolution, color=(0,0,0,0)).set_duration(duration)
        return CompositeVideoClip([bg, text_composite], size=self.resolution)

    def _create_word_by_word_clip(self, text: str, duration: float, font_size: int = 60,
                                font_path: Optional[str] = None,
                                text_color: tuple = (255, 255, 255, 255),
                                pill_color: tuple = (0, 0, 0, 160),
                                position: tuple = ('center', 'center')) -> VideoClip:
        """Create word-by-word animation"""
        if not font_path:
            font_path = self.body_font_path

        words = text.split()
        word_durations = self._calculate_word_durations(words, duration)

        clips = []
        current_time = 0

        for word, word_duration in zip(words, word_durations):
            word_image = self._render_word_on_pill(
                word, font_size, font_path, text_color, pill_color)
            word_clip = ImageClip(np.array(word_image), duration=word_duration)
            clips.append(word_clip)
            current_time += word_duration

        transition_duration = min(0.1, duration * 0.05)
        clips_with_transitions = []
        for i, clip in enumerate(clips):
            if i < len(clips) - 1:
                clip = clip.crossfadein(transition_duration)
            clips_with_transitions.append(clip)

        word_sequence = concatenate_videoclips(clips_with_transitions, method="compose")

        bg = ColorClip(size=self.resolution, color=(0,0,0,0)).set_duration(word_sequence.duration)
        positioned_sequence = word_sequence.set_position(position)
        return CompositeVideoClip([bg, positioned_sequence], size=self.resolution)

    def _calculate_word_durations(self, words: List[str], total_duration: float) -> List[float]:
        """Calculate durations for each word"""
        char_counts = [len(word) for word in words]
        total_chars = sum(char_counts)
        transition_duration = 0.05
        total_transition_time = transition_duration * (len(words) - 1)
        speech_duration = total_duration * 0.95
        effective_duration = speech_duration - total_transition_time

        word_durations = []
        min_word_time = 0.3
        for word in words:
            char_ratio = len(word) / max(1, total_chars)
            word_time = min_word_time + (effective_duration - min_word_time * len(words)) * char_ratio * 1.2
            word_durations.append(word_time)

        adjust_factor = (total_duration - total_transition_time) / sum(word_durations)
        return [d * adjust_factor for d in word_durations]

    def _render_word_on_pill(self, word: str, font_size: int, font_path: str,
                           text_color: tuple, pill_color: tuple) -> Image.Image:
        """Render word on pill-shaped background"""
        font = ImageFont.truetype(font_path, font_size)

        dummy_img = Image.new('RGBA', (1, 1))
        dummy_draw = ImageDraw.Draw(dummy_img)
        text_bbox = dummy_draw.textbbox((0, 0), word, font=font)
        text_width = text_bbox[2] - text_bbox[0]
        text_height = text_bbox[3] - text_bbox[1]

        padding_x = int(font_size * 0.7)
        padding_y = int(font_size * 0.35)
        img_width = text_width + padding_x * 2
        img_height = text_height + padding_y * 2

        img = Image.new('RGBA', (img_width, img_height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        radius = img_height // 2
        draw.rectangle([(radius, 0), (img_width - radius, img_height)], fill=pill_color)
        draw.ellipse([(0, 0), (radius * 2, img_height)], fill=pill_color)
        draw.ellipse([(img_width - radius * 2, 0), (img_width, img_height)], fill=pill_color)

        text_x = (img_width - text_width) // 2
        text_y = (img_height - text_height) // 2
        draw.text((text_x, text_y), word, font=font, fill=text_color)

        return img

    def custom_blur(self, clip: VideoClip, radius: int = 5) -> VideoClip:
        """Apply Gaussian blur effect"""
        def blur_frame(get_frame, t):
            frame = get_frame(t)
            img = Image.fromarray(frame)
            blurred = img.filter(ImageFilter.GaussianBlur(radius=radius))
            return np.array(blurred)
        return clip.fl(lambda gf, t: blur_frame(gf, t))

    def custom_edge_blur(self, clip: VideoClip, edge_width: int = 50, radius: int = 10) -> VideoClip:
        """Apply edge blur effect"""
        def blur_frame(get_frame, t):
            frame = get_frame(t)
            img = Image.fromarray(frame)
            width, height = img.size

            mask = Image.new('L', (width, height), 0)
            draw = ImageDraw.Draw(mask)
            draw.rectangle(
                [(edge_width, edge_width), (width - edge_width, height - edge_width)],
                fill=255
            )

            blurred = img.filter(ImageFilter.GaussianBlur(radius=radius))
            composite = Image.composite(img, blurred, mask)
            return np.array(composite)
        return clip.fl(lambda gf, t: blur_frame(gf, t))

    def _create_pill_image(self, size: tuple, color: tuple = (0, 0, 0, 160),
                         radius: int = 30) -> Image.Image:
        """Create pill-shaped background image"""
        width, height = size
        img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        draw.rectangle([(radius, 0), (width - radius, height)], fill=color)
        draw.rectangle([(0, radius), (width, height - radius)], fill=color)
        draw.ellipse([(0, 0), (radius * 2, radius * 2)], fill=color)
        draw.ellipse([(width - radius * 2, 0), (width, radius * 2)], fill=color)
        draw.ellipse([(0, height - radius * 2), (radius * 2, height)], fill=color)
        draw.ellipse([(width - radius * 2, height - radius * 2), (width, height)], fill=color)

        return img

    def _render_final_video(self, background: VideoClip, text_clips: List[VideoClip],
                          audio: Optional[AudioClip], output_path: str) -> None:
        """Render final video with all components"""
        final_clips = [background] + text_clips
        final_video = CompositeVideoClip(final_clips, size=self.resolution)

        if audio:
            final_video = final_video.set_audio(audio)

        final_video.write_videofile(
            output_path,
            codec="libx264",
            audio_codec="aac",
            fps=self.fps,
            preset="veryfast",
            threads=8,
            ffmpeg_params=["-movflags", "+faststart"],
            ffmpeg_params_input=["-hwaccel", "auto"]
        )

    def _fetch_videos(self, query: str, count: int = 5, min_duration: int = 5) -> List[str]:
        """Fetch background videos from multiple sources"""
        cache_key = f"{query}_{min_duration}"
        if cache_key in self.media_cache:
            cached = self.media_cache[cache_key]
            if len(cached) >= count:
                return random.sample(cached, count)

        videos = []
        apis = ["pexels", "pixabay"]
        random.shuffle(apis)

        for api in apis:
            if len(videos) >= count:
                break

            try:
                if api == "pexels" and self.pexels_api_key:
                    api_videos = self._fetch_from_pexels(query, count - len(videos), min_duration)
                elif api == "pixabay" and self.pixabay_api_key:
                    api_videos = self._fetch_from_pixabay(query, count - len(videos), min_duration)
                else:
                    continue

                videos.extend(api_videos)
            except Exception as e:
                logger.error(f"Error fetching from {api}: {str(e)}")

        if videos:
            self.media_cache[cache_key] = videos

        return videos[:count]

    def _fetch_from_pixabay(self, query: str, count: int, min_duration: int) -> List[str]:
        """Fetch videos from Pixabay API"""
        try:
            url = f"https://pixabay.com/api/videos/?key={self.pixabay_api_key}&q={query}&min_width=1080&min_height=1920&per_page=20"
            response = requests.get(url, timeout=10)
            response.raise_for_status()

            data = response.json()
            videos = data.get("hits", [])
            valid_videos = [v for v in videos if v.get("duration", 0) >= min_duration]
            selected_videos = random.sample(valid_videos, min(count, len(valid_videos)))

            video_paths = []
            for video in selected_videos:
                video_id = video["id"]
                video_path = os.path.join(self.temp_dir, f"pixabay_{video_id}.mp4")

                if os.path.exists(video_path):
                    video_paths.append(video_path)
                    continue

                video_url = video["videos"]["large"]["url"]
                if self._download_file(video_url, video_path):
                    video_paths.append(video_path)

            return video_paths

        except Exception as e:
            logger.error(f"Pixabay API error: {str(e)}")
            return []

    def _fetch_from_pexels(self, query: str, count: int, min_duration: int) -> List[str]:
        """Fetch videos from Pexels API"""
        try:
            headers = {"Authorization": self.pexels_api_key}
            url = f"https://api.pexels.com/videos/search?query={query}&per_page=20&orientation=portrait"
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()

            data = response.json()
            videos = data.get("videos", [])
            valid_videos = [v for v in videos if v.get("duration", 0) >= min_duration]
            selected_videos = random.sample(valid_videos, min(count, len(valid_videos)))

            video_paths = []
            for video in selected_videos:
                video_id = video["id"]
                video_path = os.path.join(self.temp_dir, f"pexels_{video_id}.mp4")

                if os.path.exists(video_path):
                    video_paths.append(video_path)
                    continue

                video_files = video.get("video_files", [])
                if not video_files:
                    continue

                video_url = max(video_files, key=lambda x: x.get("width", 0)).get("link")
                if video_url and self._download_file(video_url, video_path):
                    video_paths.append(video_path)

            return video_paths

        except Exception as e:
            logger.error(f"Pexels API error: {str(e)}")
            return []

    def __del__(self):
        """Cleanup when instance is destroyed"""
        self._cleanup()

    def _cleanup(self):
        """Clean up temporary resources"""
        try:
            shutil.rmtree(self.temp_dir, ignore_errors=True)
            logger.info("Temporary files cleaned up")
        except Exception as e:
            logger.warning(f"Cleanup error: {str(e)}")
