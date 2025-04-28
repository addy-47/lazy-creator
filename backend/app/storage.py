import os
import logging
from pathlib import Path
import tempfile
import shutil
import time
import uuid
from dotenv import load_dotenv
import json

logger = logging.getLogger(__name__)

# Try to import Google Cloud Storage, but don't fail if it's not available
try:
    from google.cloud import storage
    from google.cloud.exceptions import NotFound
    GOOGLE_CLOUD_AVAILABLE = True
except ImportError:
    GOOGLE_CLOUD_AVAILABLE = False
    logger.warning("Google Cloud Storage not available. Using local storage fallback.")

class CloudStorage:

    def __init__(self):
        self.use_local_storage = not GOOGLE_CLOUD_AVAILABLE

        load_dotenv()  # Load environment variables from .env file

        # Load environment variables
        self.media_bucket = os.getenv('MEDIA_BUCKET', 'lazycreator-media')
        self.uploads_bucket = os.getenv('UPLOADS_BUCKET', 'lazycreator-uploads')
        self.local_storage_dir = os.getenv('LOCAL_STORAGE_DIR', os.path.join(os.path.dirname(__file__), 'local_storage'))
        self.project_id = os.getenv('GCP_PROJECT_ID', 'yt-shorts-automation-452420')
        self.service_account_email = os.getenv('GCS_SERVICE_ACCOUNT', 'lazycreator-1@yt-shorts-automation-452420.iam.gserviceaccount.com')

        # Try to use GOOGLE_APPLICATION_CREDENTIALS as a JSON string first
        credentials_json = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
        if credentials_json:
            try:
                logger.info("Using GOOGLE_APPLICATION_CREDENTIALS from environment variable as JSON")
                credentials = service_account.Credentials.from_service_account_info(
                    json.loads(credentials_json),
                    scopes=["https://www.googleapis.com/auth/cloud-platform"]
                )
                self.client = storage.Client(credentials=credentials, project=self.project_id)
                logger.info("Successfully authenticated with environment credentials")
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON in GOOGLE_APPLICATION_CREDENTIALS: {e}")
                self.use_local_storage = True
            except Exception as e:
                logger.error(f"Failed to authenticate with GOOGLE_APPLICATION_CREDENTIALS: {e}")
                self.use_local_storage = True
        else:
            # Check if GOOGLE_APPLICATION_CREDENTIALS points to a file (fallback for local dev)
            credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
            if credentials_path and os.path.exists(credentials_path):
                try:
                    logger.info(f"Using service account key file: {credentials_path}")
                    credentials = service_account.Credentials.from_service_account_file(
                        credentials_path,
                        scopes=["https://www.googleapis.com/auth/cloud-platform"]
                    )
                    self.client = storage.Client(credentials=credentials, project=self.project_id)
                    logger.info("Successfully authenticated with service account file")
                except Exception as e:
                    logger.error(f"Failed to authenticate with service account file: {e}")
                    self.use_local_storage = True
            else:
                # Fallback to default credentials (e.g., Cloud Run service account)
                try:
                    logger.info(f"No credentials provided, using default credentials with service account {self.service_account_email}")
                    self.client = storage.Client(project=self.project_id)
                    logger.info("Successfully authenticated with default credentials")
                except Exception as e:
                    logger.error(f"Failed to authenticate with default credentials: {e}")
                    self.use_local_storage = True

        if self.use_local_storage:
            # Set up local storage directories if we're using the fallback
            os.makedirs(os.path.join(self.local_storage_dir, self.media_bucket), exist_ok=True)
            os.makedirs(os.path.join(self.local_storage_dir, self.uploads_bucket), exist_ok=True)
            logger.info(f"Using local storage at {self.local_storage_dir}")
        else:
            # Ensure buckets exist in GCS
            try:
                self._ensure_bucket_exists(self.media_bucket)
                self._ensure_bucket_exists(self.uploads_bucket)
                logger.info("Using Google Cloud Storage")
            except Exception as e:
                logger.warning(f"Failed to ensure GCS buckets exist: {e}. Falling back to local storage.")
                self.use_local_storage = True
                os.makedirs(os.path.join(self.local_storage_dir, self.media_bucket), exist_ok=True)
                os.makedirs(os.path.join(self.local_storage_dir, self.uploads_bucket), exist_ok=True)
                logger.info(f"Using local storage at {self.local_storage_dir}")
            else:
                # Use Google Cloud Storage
                try:
                    # Try to use explicit service account credentials if available
                    if self.service_account_key_path and os.path.exists(self.service_account_key_path):
                        try:
                            # Check file permissions on non-Windows systems
                            if os.name != 'nt':  # Unix-like system
                                try:
                                    # Check if file has read permissions
                                    if not os.access(self.service_account_key_path, os.R_OK):
                                        logger.warning(f"Service account key file has insufficient permissions: {self.service_account_key_path}")
                                        # Try to fix permissions
                                        os.chmod(self.service_account_key_path, 0o600)  # Read/write for owner only
                                        logger.info(f"Updated permissions for service account key file")
                                except Exception as perm_error:
                                    logger.warning(f"Failed to check/set permissions: {perm_error}")

                            # Explicitly use the service account key file and specify the correct service account email
                            logger.info(f"Authenticating with service account key file for {self.service_account_email}...")
                            try:
                                # First try to create client with explicit credentials file
                                from google.oauth2 import service_account
                                credentials = service_account.Credentials.from_service_account_file(
                                    self.service_account_key_path,
                                    scopes=["https://www.googleapis.com/auth/cloud-platform"]
                                )
                                self.client = storage.Client(credentials=credentials, project=self.project_id)
                                logger.info(f"Successfully authenticated with service account credentials")
                            except Exception as cred_error:
                                logger.warning(f"Error creating credentials from file: {cred_error}")
                                # Fall back to from_service_account_json method
                                self.client = storage.Client.from_service_account_json(self.service_account_key_path)
                                logger.info(f"Successfully authenticated with service account key file")
                        except Exception as auth_error:
                            logger.error(f"Error authenticating with service account key file: {auth_error}")
                            logger.info("Falling back to default authentication")

                            # Use the explicit service account email with application default credentials
                            try:
                                logger.info(f"Attempting to use default credentials with specific service account {self.service_account_email}")
                                self.client = storage.Client(project=self.project_id)
                                logger.info(f"Successfully authenticated with default credentials")
                            except Exception as default_auth_error:
                                logger.error(f"Error with default authentication: {default_auth_error}")
                                raise
                    else:
                        # Try default credentials with the correct service account
                        logger.info(f"No service account key file available, using default Google Cloud credentials with service account {self.service_account_email}")
                        self.client = storage.Client(project=self.project_id)
                        logger.info(f"Successfully authenticated with default Google Cloud credentials")

                    # Check if buckets exist, create them if not - wrap in try/except for each bucket
                    try:
                        self._ensure_bucket_exists(self.media_bucket)
                    except Exception as media_bucket_error:
                        logger.warning(f"Error ensuring media bucket exists: {media_bucket_error}")
                        # Continue and try uploads bucket

                    try:
                        self._ensure_bucket_exists(self.uploads_bucket)
                    except Exception as uploads_bucket_error:
                        logger.warning(f"Error ensuring uploads bucket exists: {uploads_bucket_error}")
                        # Continue as we might only need one bucket

                    logger.info("Using Google Cloud Storage")
                except Exception as e:
                    logger.warning(f"Failed to initialize Google Cloud Storage: {e}. Using local storage fallback.")
                    self.use_local_storage = True

                    # Set up local storage directories
                    os.makedirs(os.path.join(self.local_storage_dir, self.media_bucket), exist_ok=True)
                    os.makedirs(os.path.join(self.local_storage_dir, self.uploads_bucket), exist_ok=True)
                    logger.info(f"Using local storage at {self.local_storage_dir}")

    def _ensure_bucket_exists(self, bucket_name):
        """Ensure the specified bucket exists, create it if it doesn't."""
        try:
            self.client.get_bucket(bucket_name)
            logger.info(f"Bucket {bucket_name} exists")
        except Exception as e:
            if "Permission 'storage.buckets.get' denied" in str(e) or "403" in str(e):
                logger.warning(f"Permission denied checking bucket {bucket_name}. Assuming bucket exists and continuing.")
                # Continue without failure - we'll handle errors when accessing specific blobs
                return

            logger.warning(f"Bucket {bucket_name} not found, attempting to create...")
            try:
                self.client.create_bucket(bucket_name)
                logger.info(f"Created bucket {bucket_name}")
            except Exception as create_error:
                logger.error(f"Error creating bucket {bucket_name}: {create_error}")
                if "Permission 'storage.buckets.create' denied" in str(create_error):
                    logger.warning("Insufficient permissions to create bucket. Continuing with assumption bucket exists.")
                else:
                    raise

    def _get_user_folder(self, user_id=None):
        """Get a user-specific folder path for better organization."""
        if user_id:
            return f"users/{user_id}"
        return "anonymous"

    def upload_file(self, file_path, destination_blob_name, bucket_name=None, user_id=None, metadata=None):
        """Upload a file to the specified bucket with improved user session tracking."""
        try:
            # Generate a timestamp for versioning
            timestamp = int(time.time())

            # Organize by user if provided
            if user_id:
                user_folder = self._get_user_folder(user_id)
                # Keep the original filename but organize by user
                dest_parts = destination_blob_name.split('/')
                filename = dest_parts[-1]
                destination_blob_name = f"{user_folder}/{filename}"

            # Add default metadata
            if metadata is None:
                metadata = {}

            metadata.update({
                'uploaded_at': str(timestamp),
                'original_path': file_path
            })

            if user_id:
                metadata['user_id'] = user_id

            if self.use_local_storage:
                # Local storage implementation
                bucket_dir = os.path.join(self.local_storage_dir, bucket_name or self.media_bucket)

                # Create parent directories if they don't exist
                os.makedirs(bucket_dir, exist_ok=True)

                # Create subdirectories for the blob if needed
                blob_dir = os.path.dirname(destination_blob_name)
                if blob_dir:
                    os.makedirs(os.path.join(bucket_dir, blob_dir), exist_ok=True)

                # Ensure the source file exists
                if not os.path.exists(file_path):
                    raise FileNotFoundError(f"Source file not found: {file_path}")

                # Copy the file
                destination_path = os.path.join(bucket_dir, destination_blob_name)
                shutil.copy2(file_path, destination_path)
                logger.info(f"File uploaded to local storage: {destination_path}")

                # Create a metadata file
                if metadata:
                    import json
                    metadata_path = f"{destination_path}.metadata.json"
                    with open(metadata_path, 'w') as f:
                        json.dump(metadata, f)

                # Return a standard GCS-style path for consistency
                return f"gs://{bucket_name or self.media_bucket}/{destination_blob_name}"
            else:
                # Google Cloud Storage implementation
                bucket = self.client.bucket(bucket_name or self.media_bucket)
                blob = bucket.blob(destination_blob_name)

                # Set metadata
                if blob.metadata is None:
                    blob.metadata = {}
                for key, value in metadata.items():
                    blob.metadata[key] = str(value)

                # Upload with retry logic
                max_retries = 3
                retry_delay = 2  # seconds

                for attempt in range(max_retries):
                    try:
                        blob.upload_from_filename(file_path)
                        logger.info(f"File uploaded to GCS: gs://{bucket_name or self.media_bucket}/{destination_blob_name}")
                        return f"gs://{bucket_name or self.media_bucket}/{destination_blob_name}"
                    except Exception as e:
                        if attempt < max_retries - 1:
                            logger.warning(f"Upload attempt {attempt+1} failed: {e}. Retrying in {retry_delay} seconds...")
                            time.sleep(retry_delay)
                            retry_delay *= 2  # Exponential backoff
                        else:
                            logger.error(f"Upload failed after {max_retries} attempts: {e}")
                            raise
        except Exception as e:
            logger.error(f"Error uploading file: {e}")
            raise

    def download_file(self, blob_name, destination_path, bucket_name=None):
        """Download a file from the specified bucket."""
        try:
            if self.use_local_storage:
                # Local storage implementation
                bucket_dir = os.path.join(self.local_storage_dir, bucket_name or self.media_bucket)
                source_path = os.path.join(bucket_dir, blob_name)

                # Check if the source file exists
                if not os.path.exists(source_path):
                    raise FileNotFoundError(f"File not found in local storage: {source_path}")

                # Create the destination directory if it doesn't exist
                dest_dir = os.path.dirname(destination_path)
                if dest_dir:
                    os.makedirs(dest_dir, exist_ok=True)

                # Copy the file
                shutil.copy2(source_path, destination_path)
                logger.info(f"File downloaded from local storage: {source_path} to {destination_path}")
                return destination_path
            else:
                # Google Cloud Storage implementation
                bucket = self.client.bucket(bucket_name or self.media_bucket)
                blob = bucket.blob(blob_name)

                # Check if blob exists
                if not blob.exists():
                    raise FileNotFoundError(f"File not found in GCS: gs://{bucket_name or self.media_bucket}/{blob_name}")

                # Create the destination directory if it doesn't exist
                dest_dir = os.path.dirname(destination_path)
                if dest_dir:
                    os.makedirs(dest_dir, exist_ok=True)

                # Download with retry logic
                max_retries = 3
                retry_delay = 2  # seconds

                for attempt in range(max_retries):
                    try:
                        blob.download_to_filename(destination_path)
                        logger.info(f"File downloaded from GCS: gs://{bucket_name or self.media_bucket}/{blob_name} to {destination_path}")
                        return destination_path
                    except Exception as e:
                        if attempt < max_retries - 1:
                            logger.warning(f"Download attempt {attempt+1} failed: {e}. Retrying in {retry_delay} seconds...")
                            time.sleep(retry_delay)
                            retry_delay *= 2  # Exponential backoff
                        else:
                            logger.error(f"Download failed after {max_retries} attempts: {e}")
                            raise
        except Exception as e:
            logger.error(f"Error downloading file: {e}")
            raise

    def delete_file(self, blob_name, bucket_name=None):
        """Delete a file from the specified bucket."""
        try:
            if self.use_local_storage:
                # Local storage implementation
                bucket_dir = os.path.join(self.local_storage_dir, bucket_name or self.media_bucket)
                file_path = os.path.join(bucket_dir, blob_name)
                deleted = False

                # Delete the main file
                if os.path.exists(file_path):
                    os.remove(file_path)
                    deleted = True
                    logger.info(f"File deleted from local storage: {file_path}")

                # Also delete metadata file if it exists
                metadata_path = f"{file_path}.metadata.json"
                if os.path.exists(metadata_path):
                    os.remove(metadata_path)
                    logger.info(f"Metadata file deleted: {metadata_path}")

                return deleted
            else:
                # Google Cloud Storage implementation
                bucket = self.client.bucket(bucket_name or self.media_bucket)
                blob = bucket.blob(blob_name)

                # Check if blob exists before attempting to delete
                if not blob.exists():
                    logger.warning(f"File does not exist in GCS: gs://{bucket_name or self.media_bucket}/{blob_name}")
                    return False

                blob.delete()
                logger.info(f"File deleted from GCS: gs://{bucket_name or self.media_bucket}/{blob_name}")
                return True
        except Exception as e:
            logger.error(f"Error deleting file: {e}")
            raise

    def file_exists(self, blob_name, bucket_name=None):
        """Check if a file exists in storage."""
        try:
            if self.use_local_storage:
                # Check local file system
                bucket_dir = os.path.join(self.local_storage_dir, bucket_name or self.media_bucket)
                file_path = os.path.join(bucket_dir, blob_name)
                return os.path.exists(file_path)
            else:
                # Use GCS
                bucket = self.client.bucket(bucket_name or self.media_bucket)
                blob = bucket.blob(blob_name)
                return blob.exists()
        except Exception as e:
            logger.error(f"Error checking if file exists: {e}")
            return False

    def get_public_url(self, blob_name, bucket_name=None, expiration=3600):
        """Get a public URL for a file in the specified bucket."""
        if self.use_local_storage:
            # For local storage, return a file:// URL
            bucket_dir = os.path.join(self.local_storage_dir, bucket_name or self.media_bucket)
            file_path = os.path.join(bucket_dir, blob_name)
            return f"file://{os.path.abspath(file_path)}"
        else:
            # Google Cloud Storage implementation - generate a signed URL that expires
            bucket = self.client.bucket(bucket_name or self.media_bucket)
            blob = bucket.blob(blob_name)

            try:
                url = blob.generate_signed_url(
                    version="v4",
                    expiration=expiration,
                    method="GET"
                )
                logger.info(f"Generated signed URL for gs://{bucket_name or self.media_bucket}/{blob_name}")
                return url
            except Exception as e:
                logger.error(f"Error generating signed URL: {e}")
                # Fallback to public_url if signed URL generation fails
                return blob.public_url

    def save_uploaded_file(self, file, filename, user_id=None):
        """Save an uploaded file to the uploads bucket with user tracking."""
        try:
            # Generate a unique filename if needed to prevent overwrites
            if user_id:
                # Include user_id in the path
                safe_filename = f"{user_id}/{uuid.uuid4()}_{filename}"
            else:
                safe_filename = f"{uuid.uuid4()}_{filename}"

            metadata = {
                'original_filename': filename,
                'uploaded_at': str(int(time.time()))
            }

            if user_id:
                metadata['user_id'] = user_id

            if self.use_local_storage:
                # Local storage implementation
                uploads_dir = os.path.join(self.local_storage_dir, self.uploads_bucket)

                # Create user directory if needed
                if user_id:
                    user_dir = os.path.join(uploads_dir, user_id)
                    os.makedirs(user_dir, exist_ok=True)
                    file_path = os.path.join(user_dir, os.path.basename(safe_filename))
                else:
                    os.makedirs(uploads_dir, exist_ok=True)
                    file_path = os.path.join(uploads_dir, safe_filename)

                file.save(file_path)

                # Save metadata
                import json
                metadata_path = f"{file_path}.metadata.json"
                with open(metadata_path, 'w') as f:
                    json.dump(metadata, f)

                logger.info(f"Uploaded file saved to local storage: {file_path}")
                return file_path
            else:
                # Google Cloud Storage implementation - save to a temp file first
                with tempfile.NamedTemporaryFile(delete=False) as temp:
                    file.save(temp.name)
                    temp_path = temp.name

                # Now upload the temp file to GCS
                bucket = self.client.bucket(self.uploads_bucket)
                blob = bucket.blob(safe_filename)

                # Set metadata
                for key, value in metadata.items():
                    blob.metadata[key] = str(value)

                blob.upload_from_filename(temp_path)

                # Delete temp file
                try:
                    os.unlink(temp_path)
                except Exception as e:
                    logger.warning(f"Failed to delete temp file {temp_path}: {e}")

                logger.info(f"Uploaded file saved to GCS: gs://{self.uploads_bucket}/{safe_filename}")
                return f"gs://{self.uploads_bucket}/{safe_filename}"
        except Exception as e:
            logger.error(f"Error saving uploaded file: {e}")
            raise

    def list_user_files(self, user_id, bucket_name=None):
        """List all files for a specific user."""
        try:
            if not user_id:
                logger.warning("No user_id provided for list_user_files")
                return []

            files = []

            if self.use_local_storage:
                # Local storage implementation
                bucket_dir = os.path.join(self.local_storage_dir, bucket_name or self.media_bucket)
                user_dir = os.path.join(bucket_dir, "users", user_id)

                if not os.path.exists(user_dir):
                    logger.info(f"User directory not found: {user_dir}")
                    return []

                # Walk through user directory and collect files
                for root, _, filenames in os.walk(user_dir):
                    for filename in filenames:
                        if not filename.endswith('.metadata.json'):  # Skip metadata files
                            rel_path = os.path.relpath(os.path.join(root, filename), bucket_dir)
                            files.append({
                                'name': filename,
                                'path': rel_path,
                                'full_path': f"gs://{bucket_name or self.media_bucket}/{rel_path}"
                            })
            else:
                # Google Cloud Storage implementation
                bucket = self.client.bucket(bucket_name or self.media_bucket)
                prefix = f"users/{user_id}/"
                blobs = bucket.list_blobs(prefix=prefix)

                for blob in blobs:
                    files.append({
                        'name': os.path.basename(blob.name),
                        'path': blob.name,
                        'full_path': f"gs://{bucket_name or self.media_bucket}/{blob.name}",
                        'size': blob.size,
                        'updated': blob.updated
                    })

            return files
        except Exception as e:
            logger.error(f"Error listing files for user {user_id}: {e}")
            return []

    def find_file_in_local_storage(self, filename, bucket_name=None):
        """
        Find a file in local storage with more robust path checking.

        Args:
            filename: The name of the file to find (can be full path or just filename)
            bucket_name: Optional bucket name

        Returns:
            str: Full path to the file if found, None if not found
        """
        try:
            # Extract just the filename if a path is provided
            base_filename = os.path.basename(filename)

            # First, try the exact path
            if os.path.exists(filename) and os.path.isfile(filename):
                logger.info(f"Found file at exact path: {filename}")
                return filename

            # Check in standard bucket location
            bucket_dir = os.path.join(self.local_storage_dir, bucket_name or self.media_bucket)
            file_path = os.path.join(bucket_dir, filename)
            if os.path.exists(file_path) and os.path.isfile(file_path):
                logger.info(f"Found file in bucket directory: {file_path}")
                return file_path

            # Check with just the filename in the bucket
            file_path = os.path.join(bucket_dir, base_filename)
            if os.path.exists(file_path) and os.path.isfile(file_path):
                logger.info(f"Found file using basename in bucket: {file_path}")
                return file_path

            # Check in media bucket specifically
            media_path = os.path.join(self.local_storage_dir, self.media_bucket, base_filename)
            if os.path.exists(media_path) and os.path.isfile(media_path):
                logger.info(f"Found file in media bucket: {media_path}")
                return media_path

            # Check in uploads bucket
            uploads_path = os.path.join(self.local_storage_dir, self.uploads_bucket, base_filename)
            if os.path.exists(uploads_path) and os.path.isfile(uploads_path):
                logger.info(f"Found file in uploads bucket: {uploads_path}")
                return uploads_path

            # Search recursively as a last resort
            for root, _, files in os.walk(self.local_storage_dir):
                if base_filename in files:
                    found_path = os.path.join(root, base_filename)
                    logger.info(f"Found file in recursive search: {found_path}")
                    return found_path

            # Could not find the file
            logger.warning(f"Could not find file {filename} in local storage")
            return None

        except Exception as e:
            logger.error(f"Error finding file in local storage: {e}")
            return None

# Create a singleton instance
cloud_storage = CloudStorage()
