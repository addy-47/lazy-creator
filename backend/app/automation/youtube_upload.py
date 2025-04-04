import os  # for file operations
import googleapiclient.discovery # for interacting with the YouTube API
import googleapiclient.errors # for handling API errors
import googleapiclient.http
from .youtube_auth import authenticate_youtube, get_credentials
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def get_authenticated_service(user_id=None):
    """Load YouTube API credentials for a specific user or default credentials."""
    if user_id:
        credentials = get_credentials(user_id)
        if not credentials:
            return None
    else:
        credentials = authenticate_youtube()

    return googleapiclient.discovery.build("youtube", "v3", credentials=credentials)

def upload_video(youtube, file_path, title, description, tags, privacy="public"):
    """Upload a video to YouTube."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Video file '{file_path}' not found.")

    body = {
        "snippet": {
            "title": title,
            "description": description,
            "tags": tags,
            "categoryId": "22"  # People & Blogs
        },
        "status": {
            "privacyStatus": privacy
        }
    }

    media_body = googleapiclient.http.MediaFileUpload(file_path, chunksize=-1, resumable=True) # creates a object of the file to be uploaded
    try:
        request = youtube.videos().insert(  # creates a request object to upload the video
            part="snippet,status",
            body=body,
            media_body=media_body
        )
        response = None
        status = None

        # Handle chunked upload with progress
        while response is None:
            status, response = request.next_chunk()
            if status:
                progress = int(status.progress() * 100)
                logger.info(f"Upload is {progress}% complete.")

        logger.info(f"✅ Upload successful! Video ID: {response.get('id')}")
        return response
    except googleapiclient.errors.HttpError as e:
        logger.error(f"Upload failed: {e}")
        raise

def check_auth_status(user_id):
    """Check if a user is authenticated with YouTube."""
    if not user_id:
        return False

    credentials = get_credentials(user_id)
    if not credentials:
        return False

    # Verify credentials work by trying to get channel info
    try:
        youtube = googleapiclient.discovery.build("youtube", "v3", credentials=credentials)
        youtube.channels().list(part="snippet", mine=True).execute()
        return True
    except:
        return False

if __name__ == "__main__":
    youtube = get_authenticated_service()
    upload_video(youtube, "short_output.mp4", "Test Short", "A test video.", ["shorts", "test"])
