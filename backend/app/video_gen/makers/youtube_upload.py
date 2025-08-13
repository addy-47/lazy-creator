import os
import googleapiclient.discovery
import googleapiclient.errors
import logging
import io

logger = logging.getLogger(__name__)

def upload_video(youtube, file_path, title, description, tags, thumbnail_path=None, privacy="public"):
    """
    Upload a video to YouTube with optional thumbnail.

    Args:
        youtube: Authenticated YouTube API service object.
        file_path (str): Path to the video file.
        title (str): Title for the video.
        description (str): Video description.
        tags (list): List of tags.
        thumbnail_path (str): Optional path to thumbnail image.
        privacy (str): Privacy status ('public', 'private', 'unlisted').

    Returns:
        str: Video ID of the uploaded video or None if failed.
    """
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

    media_body = googleapiclient.http.MediaFileUpload(file_path, chunksize=-1, resumable=True)
    try:
        logger.info(f"Uploading video: {title}")
        request = youtube.videos().insert(
            part="snippet,status",
            body=body,
            media_body=media_body
        )
        response = request.execute()
        video_id = response.get('id')
        logger.info(f"✅ Video upload successful! Video ID: {video_id}")

        if thumbnail_path and os.path.exists(thumbnail_path):
            try:
                logger.info(f"Uploading thumbnail for video ID: {video_id}")
                media = googleapiclient.http.MediaFileUpload(
                    thumbnail_path,
                    mimetype='image/jpeg',
                    resumable=True
                )
                youtube.thumbnails().set(
                    videoId=video_id,
                    media_body=media
                ).execute()
                logger.info(f"✅ Thumbnail upload successful!")
            except googleapiclient.errors.HttpError as e:
                logger.error(f"Thumbnail upload failed: {e}")

        return video_id
    except googleapiclient.errors.HttpError as e:
        logger.error(f"Video upload failed: {e}")
        raise