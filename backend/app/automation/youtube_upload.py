import os  # for file operations
import googleapiclient.discovery # for interacting with the YouTube API
import googleapiclient.errors # for handling API errors
import googleapiclient.http
from youtube_auth import get_credentials, get_authenticated_service, check_auth_status
import logging
import time

# Configure logging
logger = logging.getLogger(__name__)

def upload_video(youtube, file_path, title, description, tags, thumbnail_path=None, privacy="public"):
    """
    Upload a video to YouTube with optional thumbnail.

    Args:
        youtube: Authenticated YouTube API service
        file_path (str): Path to the video file
        title (str): Title for the video
        description (str): Video description
        tags (list): List of tags
        thumbnail_path (str): Optional path to thumbnail image
        privacy (str): Privacy status ('public', 'private', 'unlisted')

    Returns:
        str: Video ID of the uploaded video or None if failed

    Raises:
        FileNotFoundError: If the video file doesn't exist
        googleapiclient.errors.HttpError: If the YouTube API returns an error
        Exception: For any other errors
    """
    # Validate file exists and is accessible
    if not file_path or not os.path.exists(file_path):
        logger.error(f"Video file '{file_path}' not found or inaccessible.")
        raise FileNotFoundError(f"Video file '{file_path}' not found or inaccessible.")

    # Validate file is not empty
    if os.path.getsize(file_path) == 0:
        logger.error(f"Video file '{file_path}' is empty (0 bytes).")
        raise ValueError(f"Video file '{file_path}' is empty (0 bytes).")

    # Check file extension and basic validation
    _, ext = os.path.splitext(file_path)
    if ext.lower() not in ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.mkv']:
        logger.warning(f"File '{file_path}' has an unusual extension '{ext}'. Upload may fail.")

    # Prepare the video metadata
    body = {
        "snippet": {
            "title": title[:100],  # YouTube title limit is 100 characters
            "description": description[:5000],  # YouTube description limit is 5000 characters
            "tags": tags[:500] if tags else [],  # YouTube allows up to 500 tags
            "categoryId": "22"  # People & Blogs
        },
        "status": {
            "privacyStatus": privacy
        }
    }

    try:
        # Create the media upload object with chunked uploading
        logger.info(f"Preparing to upload video: {file_path} (Size: {os.path.getsize(file_path) / (1024*1024):.2f} MB)")
        media_body = googleapiclient.http.MediaFileUpload(
            file_path,
            mimetype='video/*',  # Let the API detect the correct MIME type
            chunksize=1024*1024*5,  # 5MB chunks for better error recovery
            resumable=True
        )

        # Create the upload request
        logger.info(f"Starting upload for video: {title}")
        request = youtube.videos().insert(
            part="snippet,status",
            body=body,
            media_body=media_body,
            notifySubscribers=True
        )

        response = None
        last_progress = 0
        retries = 0
        max_retries = 5

        # Handle chunked upload with progress reporting
        while response is None:
            try:
                status, response = request.next_chunk()
                retries = 0  # Reset retries on successful chunk

                if status:
                    progress = int(status.progress() * 100)
                    # Only log if progress has increased by at least 10%
                    if progress >= last_progress + 10:
                        logger.info(f"Upload is {progress}% complete.")
                        last_progress = progress
            except googleapiclient.errors.HttpError as chunk_error:
                retries += 1
                if retries > max_retries:
                    logger.error(f"Upload failed after {max_retries} retries: {chunk_error}")
                    raise

                logger.warning(f"Chunk upload error (retry {retries}/{max_retries}): {chunk_error}")
                # Exponential backoff
                time.sleep(2 ** retries)
                continue

        # Get the uploaded video ID
        if not response or 'id' not in response:
            logger.error("Upload completed but no video ID returned")
            raise ValueError("Upload completed but YouTube did not return a video ID")

        video_id = response.get('id')
        logger.info(f"✅ Video upload successful! Video ID: {video_id}")

        # Upload thumbnail if provided
        if thumbnail_path and os.path.exists(thumbnail_path):
            try:
                logger.info(f"Uploading thumbnail for video ID: {video_id}")
                youtube.thumbnails().set(
                    videoId=video_id,
                    media_body=googleapiclient.http.MediaFileUpload(
                        thumbnail_path,
                        mimetype='image/jpeg'
                    )
                ).execute()
                logger.info(f"✅ Thumbnail upload successful!")
            except googleapiclient.errors.HttpError as thumbnail_error:
                logger.error(f"Thumbnail upload failed: {thumbnail_error}")
                if "403" in str(thumbnail_error):
                    logger.warning("This could be because the channel isn't verified for custom thumbnails")
                # Continue even if thumbnail upload fails - we still have a successful video upload

        return video_id

    except googleapiclient.errors.HttpError as api_error:
        error_content = str(api_error)

        # Provide better error messages based on status codes
        if "401" in error_content:
            logger.error("YouTube API authentication failed (401). Token may be expired or invalid.")
            raise ValueError("YouTube authentication expired. Please reconnect your account.") from api_error
        elif "403" in error_content:
            if "quotaExceeded" in error_content:
                logger.error("YouTube API quota exceeded (403).")
                raise ValueError("YouTube API quota exceeded. Please try again tomorrow.") from api_error
            else:
                logger.error(f"YouTube API permission denied (403): {api_error}")
                raise ValueError("Permission denied. Your account may not have upload privileges.") from api_error
        elif "404" in error_content:
            logger.error(f"YouTube API resource not found (404): {api_error}")
            raise ValueError("YouTube API resource not found. Service might be unavailable.") from api_error
        else:
            logger.error(f"YouTube API error: {api_error}")
            raise
    except Exception as general_error:
        logger.error(f"Unexpected error during video upload: {general_error}")
        raise

if __name__ == "__main__":
    youtube = get_authenticated_service()
    upload_video(youtube, "short_output.mp4", "Test Short", "A test video.", ["shorts", "test"])
