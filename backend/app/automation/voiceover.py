import os # for interacting with the operating system
import logging # for logging messages
import re # for regular expressions
import time # for handling retries

logger = logging.getLogger(__name__)

class GoogleVoiceover:
    """Class to handle Google Cloud Text-to-Speech functionality"""

    def __init__(self, voice="en-US-Neural2-D", output_dir="temp"):
        """
        Initialize Google Cloud TTS service.

        Args:
            voice (str): Voice ID to use. Default is en-US-Neural2-D.
            output_dir (str): Directory to save audio files.
        """
        import os
        import json
        from google.cloud import texttospeech

        logger.info(f"Initializing Google TTS with voice: {voice}")
        
        # Get API key from environment variables
        self.api_key = os.getenv("GOOGLE_API_KEY")
        
        # Set the environment variable for Google Cloud credentials
        credentials_path = os.getenv("GOOGLE_CREDENTIALS_JSON")
        
        # Track credential method for debugging
        self.credentials_method = "unknown"
        
        try:
            if credentials_path and os.path.exists(credentials_path):
                logger.info(f"Using Google Cloud credentials from file: {credentials_path}")
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path
                self.client = texttospeech.TextToSpeechClient()
                self.credentials_method = "credentials_file"
            elif self.api_key:
                # If using API key authentication
                logger.info("Using Google Cloud API key authentication")
                if os.path.exists(self.api_key):  # If API key is a file path
                    self.client = texttospeech.TextToSpeechClient.from_service_account_json(self.api_key)
                    self.credentials_method = "service_account_json"
                else:
                    # If API key is the actual key string (JSON content)
                    try:
                        # Check if it's valid JSON
                        json_obj = json.loads(self.api_key)
                        # Write to temporary file and use that
                        import tempfile
                        temp_cred_file = tempfile.NamedTemporaryFile(delete=False, suffix='.json')
                        with open(temp_cred_file.name, 'w') as f:
                            json.dump(json_obj, f)
                        logger.info(f"Created temporary credentials file from JSON string")
                        self.client = texttospeech.TextToSpeechClient.from_service_account_json(temp_cred_file.name)
                        self.credentials_method = "json_string"
                        os.unlink(temp_cred_file.name)  # Clean up temp file
                    except json.JSONDecodeError:
                        # Not JSON, must be API key string - try default auth
                        logger.info("API key provided but not JSON format, using default auth")
                        self.client = texttospeech.TextToSpeechClient()
                        self.credentials_method = "default_auth_with_api_key"
            else:
                # Try default authentication
                logger.info("No explicit credentials provided, attempting to use default authentication")
                self.client = texttospeech.TextToSpeechClient()
                self.credentials_method = "default_auth"
                
            # Verify credentials by making a simple list voices call
            logger.info("Verifying Google Cloud TTS credentials")
            response = self.client.list_voices(language_code="en-US")
            logger.info(f"Successfully connected to Google Cloud TTS with {len(response.voices)} English voices available")
                
        except Exception as e:
            logger.error(f"Failed to initialize Google TTS client: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise ValueError(f"Google Cloud TTS initialization failed: {e}")

        # Parse the voice into language and name components
        parts = voice.split("-")
        if len(parts) >= 3:
            self.language_code = f"{parts[0]}-{parts[1]}"
            self.voice_name = voice
        else:
            # Default to US English if the format is unexpected
            self.language_code = "en-US"
            self.voice_name = voice
            
        logger.info(f"Using voice: {self.voice_name} with language code: {self.language_code}")

        # Create output directory if it doesn't exist
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)

        # Available neural voices mapping
        self.available_voices = {
            "female_casual": "en-US-Neural2-F",
            "female_professional": "en-US-Neural2-C",
            "male_casual": "en-US-Neural2-D",
            "male_professional": "en-US-Neural2-A",
            "female_enthusiastic": "en-US-Neural2-E",
            "male_narrative": "en-US-Neural2-J"
        }

    def generate_speech(self, text, output_filename=None, voice_style=None):
        """
        Generate speech from text using Google Cloud TTS.

        Args:
            text (str): Text to convert to speech.
            output_filename (str): Output filename. If None, a filename will be generated.
            voice_style (str): Optional style parameter (not directly supported in Google Cloud TTS).

        Returns:
            str: Path to the generated audio file.
        """
        from google.cloud import texttospeech
        import logging
        import re
        import time
        import os

        logger = logging.getLogger(__name__)

        if not output_filename:
            output_filename = os.path.join(self.output_dir, f"google_tts_{hash(text)}.mp3")
            
        logger.info(f"Generating speech with Google TTS (credentials: {self.credentials_method})")
        logger.info(f"Text: \"{text[:50]}...\" (length: {len(text)} chars)")
        logger.info(f"Output file: {output_filename}")
        if voice_style:
            logger.info(f"Voice style: {voice_style}")

        # Implement retry logic
        max_retries = 3
        retry_count = 0
        backoff_time = 2  # seconds

        while retry_count < max_retries:
            try:
                # Break long text into smaller chunks if more than 5000 characters (Google's limit)
                if len(text) > 5000:
                    logger.info(f"Text exceeds 5000 char limit ({len(text)} chars), splitting into chunks")
                    # Split into sentences and process in chunks
                    sentences = re.split(r'(?<=[.!?])\s+', text)
                    chunks = []
                    current_chunk = ""

                    for sentence in sentences:
                        if len(current_chunk) + len(sentence) < 5000:
                            current_chunk += sentence + " "
                        else:
                            if current_chunk:
                                chunks.append(current_chunk.strip())
                            current_chunk = sentence + " "

                    if current_chunk:
                        chunks.append(current_chunk.strip())

                    # Process each chunk separately
                    temp_files = []
                    for i, chunk in enumerate(chunks):
                        temp_file = output_filename.replace(".mp3", f"_chunk_{i}.mp3")

                        # Set the text input to be synthesized
                        synthesis_input = texttospeech.SynthesisInput(text=chunk)

                        # Build the voice request
                        voice = texttospeech.VoiceSelectionParams(
                            language_code=self.language_code,
                            name=self.voice_name
                        )

                        # Select the type of audio file to return
                        audio_config = texttospeech.AudioConfig(
                            audio_encoding=texttospeech.AudioEncoding.MP3,
                            speaking_rate=1.0,  # Normal speed
                            pitch=0.0  # Default pitch
                        )

                        # Apply voice style if provided (limited support in Google Cloud TTS)
                        if voice_style:
                            if voice_style == "excited" or voice_style == "cheerful":
                                audio_config = texttospeech.AudioConfig(
                                    audio_encoding=texttospeech.AudioEncoding.MP3,
                                    speaking_rate=1.1,  # Slightly faster for excitement
                                    pitch=1.0  # Higher pitch for excitement
                                )
                            elif voice_style == "sad":
                                audio_config = texttospeech.AudioConfig(
                                    audio_encoding=texttospeech.AudioEncoding.MP3,
                                    speaking_rate=0.9,  # Slower for sadness
                                    pitch=-1.0  # Lower pitch for sadness
                                )
                            elif voice_style == "calm" or voice_style == "gentle":
                                audio_config = texttospeech.AudioConfig(
                                    audio_encoding=texttospeech.AudioEncoding.MP3,
                                    speaking_rate=0.9,  # Slower for calmness
                                    pitch=0.0  # Normal pitch
                                )

                        # Perform the text-to-speech request
                        response = self.client.synthesize_speech(
                            input=synthesis_input,
                            voice=voice,
                            audio_config=audio_config
                        )

                        # Write the response to the output file
                        with open(temp_file, "wb") as out:
                            out.write(response.audio_content)

                        temp_files.append(temp_file)

                    # Combine audio files using moviepy
                    from moviepy.editor import concatenate_audioclips, AudioFileClip

                    audio_clips = [AudioFileClip(file) for file in temp_files]
                    concatenated = concatenate_audioclips(audio_clips)
                    concatenated.write_audiofile(output_filename, fps=24000)

                    # Clean up temp files
                    for clip in audio_clips:
                        clip.close()
                    for file in temp_files:
                        if os.path.exists(file):
                            os.remove(file)

                    logger.info(f"Speech synthesized for text [{text[:20]}...] and saved to [{output_filename}]")
                    return output_filename
                else:
                    # Set the text input to be synthesized
                    synthesis_input = texttospeech.SynthesisInput(text=text)

                    # Build the voice request
                    voice = texttospeech.VoiceSelectionParams(
                        language_code=self.language_code,
                        name=self.voice_name
                    )

                    # Select the type of audio file to return
                    audio_config = texttospeech.AudioConfig(
                        audio_encoding=texttospeech.AudioEncoding.MP3,
                        speaking_rate=1.0,  # Normal speed
                        pitch=0.0  # Default pitch
                    )

                    # Apply voice style if provided (limited support in Google Cloud TTS)
                    if voice_style:
                        if voice_style == "excited" or voice_style == "cheerful":
                            audio_config = texttospeech.AudioConfig(
                                audio_encoding=texttospeech.AudioEncoding.MP3,
                                speaking_rate=1.1,  # Slightly faster for excitement
                                pitch=1.0  # Higher pitch for excitement
                            )
                        elif voice_style == "sad":
                            audio_config = texttospeech.AudioConfig(
                                audio_encoding=texttospeech.AudioEncoding.MP3,
                                speaking_rate=0.9,  # Slower for sadness
                                pitch=-1.0  # Lower pitch for sadness
                            )
                        elif voice_style == "calm" or voice_style == "gentle":
                            audio_config = texttospeech.AudioConfig(
                                audio_encoding=texttospeech.AudioEncoding.MP3,
                                speaking_rate=0.9,  # Slower for calmness
                                pitch=0.0  # Normal pitch
                            )

                    # Perform the text-to-speech request
                    response = self.client.synthesize_speech(
                        input=synthesis_input,
                        voice=voice,
                        audio_config=audio_config
                    )

                    # Write the response to the output file
                    with open(output_filename, "wb") as out:
                        out.write(response.audio_content)

                    logger.info(f"Speech synthesized for text [{text[:20]}...] and saved to [{output_filename}]")
                    return output_filename

            except Exception as e:
                retry_count += 1
                if retry_count < max_retries:
                    logger.warning(f"Google TTS error (attempt {retry_count}/{max_retries}): {e}. Retrying...")
                    time.sleep(backoff_time)
                    backoff_time *= 2  # Exponential backoff
                else:
                    logger.error(f"Google TTS failed after {max_retries} attempts: {e}")
                    raise Exception(f"Google TTS error: {e}")

        return output_filename
