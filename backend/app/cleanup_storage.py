import os
import logging
import re
from pymongo import MongoClient
from bson.objectid import ObjectId
from storage import CloudStorage
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO,
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize storage
cloud_storage = CloudStorage()

# Connect to MongoDB
mongo_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/lazy-creator')
db_name = os.getenv('MONGODB_DB_NAME', 'lazy-creator')
client = MongoClient(mongo_uri)
db = client[db_name]
videos_collection = db['videos']

def cleanup_storage():
    """Clean up orphaned files and fix storage organization"""

    # Get all completed videos
    videos = list(videos_collection.find({'status': 'completed'}))

    logger.info(f"Found {len(videos)} completed videos to check")

    for video in videos:
        try:
            video_id = str(video['_id'])
            user_id = video.get('user_id')
            filename = video.get('filename')
            current_path = video.get('path')

            if not user_id or not filename or not current_path:
                logger.warning(f"Video {video_id} has missing data: user_id={user_id}, filename={filename}")
                continue

            # Check if the path is at the root level
            if 'videos/' not in current_path and current_path.startswith('gs://'):
                logger.info(f"Found video at root level: {current_path}")

                # Extract the bucket name and blob name
                match = re.match(r'gs://([^/]+)/(.+)', current_path)
                if not match:
                    logger.warning(f"Invalid path format: {current_path}")
                    continue

                bucket_name = match.group(1)
                blob_name = match.group(2)

                # Define the new path in the videos/user_id/ directory
                new_blob_name = f"videos/{user_id}/{filename}"
                new_path = f"gs://{bucket_name}/{new_blob_name}"

                # Check if the file exists at the root level
                if cloud_storage.file_exists(blob_name, bucket_name):
                    logger.info(f"Moving file from {blob_name} to {new_blob_name}")

                    # Download file to temporary location
                    import tempfile
                    with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_file:
                        try:
                            # Download the file
                            cloud_storage.download_file(blob_name, temp_file.name, bucket_name)

                            # Upload to new location
                            cloud_storage.upload_file(
                                temp_file.name,
                                new_blob_name,
                                bucket_name=bucket_name,
                                user_id=user_id,
                                metadata={'video_id': video_id}
                            )

                            # Update database with new path
                            videos_collection.update_one(
                                {'_id': ObjectId(video_id)},
                                {'$set': {'path': new_path}}
                            )

                            logger.info(f"Updated database record for video {video_id}")

                            # Delete the original file at root level
                            cloud_storage.delete_file(blob_name, bucket_name)
                            logger.info(f"Deleted original file at {blob_name}")

                        finally:
                            # Clean up the temporary file
                            if os.path.exists(temp_file.name):
                                os.unlink(temp_file.name)
                else:
                    logger.warning(f"File does not exist at root level: {blob_name}")

                    # Check if it already exists in the organized structure
                    if cloud_storage.file_exists(new_blob_name, bucket_name):
                        logger.info(f"File already exists at organized location: {new_blob_name}")

                        # Just update the database
                        videos_collection.update_one(
                            {'_id': ObjectId(video_id)},
                            {'$set': {'path': new_path}}
                        )

                        logger.info(f"Updated database record for video {video_id}")

        except Exception as e:
            logger.error(f"Error processing video {str(video.get('_id', 'unknown'))}: {e}")

if __name__ == "__main__":
    logger.info("Starting storage cleanup...")
    cleanup_storage()
    logger.info("Storage cleanup completed")
