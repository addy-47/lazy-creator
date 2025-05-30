import os
import logging
import tempfile
from typing import Tuple, Dict, Any, Optional
from moviepy.editor import VideoFileClip, AudioFileClip, CompositeVideoClip, TextClip, ColorClip
from moviepy.video.fx.all import resize, fadein, fadeout
from app.video_generation.helper.gcs_temp import use_in_memory_or_gcs, get_gcs_temp_manager
from app.automation.script_generator import generate_comprehensive_content
from app.automation.tts_generator import generate_tts
from app.automation.background_handler import get_background_video

# Configure logging
logger = logging.getLogger(__name__)

def generate_youtube_short(
    topic: str,
    style: str = "photorealistic",
    max_duration: int = 25,
    background_type: str = "video",
    background_source: str = "provided",
    background_path: Optional[str] = None
) -> Tuple[str, Dict[str, Any]]:
    """
    Generate a YouTube short video with the given topic and parameters.
    
    Args:
        topic (str): The main topic for the video
        style (str): The style of the video (default: "photorealistic")
        max_duration (int): Maximum duration in seconds (default: 25)
        background_type (str): Type of background ("video" or "image")
        background_source (str): Source of background ("provided" or "custom")
        background_path (Optional[str]): Path to custom background file
        
    Returns:
        Tuple[str, Dict[str, Any]]: Path to generated video and comprehensive content
    """
    try:
        # Generate comprehensive content
        comprehensive_content = generate_comprehensive_content(
            topic=topic,
            max_duration=max_duration
        )
        
        # Extract script from comprehensive content
        script = comprehensive_content.get('script', '')
        if not script:
            raise ValueError("Failed to generate script")
            
        # Generate TTS audio
        audio_path = generate_tts(script)
        if not audio_path or not os.path.exists(audio_path):
            raise ValueError("Failed to generate TTS audio")
            
        # Get background video/image
        background_clip = get_background_video(
            background_type=background_type,
            background_source=background_source,
            background_path=background_path,
            duration=max_duration
        )
        
        # Create temporary directory for processing
        with tempfile.TemporaryDirectory() as temp_dir:
            # Load audio clip
            audio_clip = AudioFileClip(audio_path)
            audio_duration = audio_clip.duration
            
            # Resize background to match YouTube Shorts dimensions (9:16)
            background_clip = background_clip.resize(height=1920)
            background_clip = background_clip.crop(x1=0, y1=0, width=1080, height=1920)
            
            # Trim background to match audio duration
            background_clip = background_clip.subclip(0, audio_duration)
            
            # Add fade effects
            background_clip = background_clip.fx(fadein, duration=1).fx(fadeout, duration=1)
            
            # Create text clips for subtitles
            text_clips = []
            for i, line in enumerate(script.split('\n')):
                if line.strip():
                    text_clip = TextClip(
                        line,
                        fontsize=70,
                        color='white',
                        stroke_color='black',
                        stroke_width=2,
                        font='Arial-Bold',
                        size=(1000, None),
                        method='caption'
                    )
                    text_clip = text_clip.set_position(('center', 1500 + (i * 100)))
                    text_clip = text_clip.set_duration(audio_duration)
                    text_clips.append(text_clip)
            
            # Combine all clips
            final_clip = CompositeVideoClip(
                [background_clip] + text_clips,
                size=(1080, 1920)
            )
            
            # Set audio
            final_clip = final_clip.set_audio(audio_clip)
            
            # Generate output path
            output_path = os.path.join(temp_dir, 'output.mp4')
            
            # Write final video
            final_clip.write_videofile(
                output_path,
                fps=30,
                codec='libx264',
                audio_codec='aac',
                temp_audiofile=os.path.join(temp_dir, 'temp_audio.m4a'),
                remove_temp=True,
                threads=4,
                preset='ultrafast'
            )
            
            # Clean up clips
            final_clip.close()
            audio_clip.close()
            background_clip.close()
            for text_clip in text_clips:
                text_clip.close()
            
            # Use GCS temp storage for the output file
            gcs_temp_manager = get_gcs_temp_manager()
            final_path = gcs_temp_manager.save_file(output_path)
            
            return final_path, comprehensive_content
            
    except Exception as e:
        logger.error(f"Error generating YouTube short: {e}")
        raise
    finally:
        # Clean up temporary files
        if 'audio_path' in locals() and os.path.exists(audio_path):
            try:
                os.remove(audio_path)
            except Exception as e:
                logger.warning(f"Failed to clean up audio file: {e}") 