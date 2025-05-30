import os
import logging
import tempfile
import uuid
import time
import shutil
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Union, Generator, Tuple

# Import Google Cloud Storage libraries
try:
    from google.cloud import storage
    from google.oauth2 import service_account
    HAS_GCS = True
except ImportError:
    HAS_GCS = False
    
logger = logging.getLogger(__name__)

# Default GCS bucket for temporary files
DEFAULT_TEMP_BUCKET = "lazycreator-temp"
# Default expiration in hours for temporary files
DEFAULT_EXPIRATION_HOURS = 24
# Default local temp directory
DEFAULT_LOCAL_TEMP_DIR = tempfile.gettempdir()

class GCSTempManager:
    """
    Manager for handling temporary files in Google Cloud Storage.
    Provides utilities for uploading, downloading, and cleaning up temp files.
    
    Automatically cleans up files after a specified expiration period.
    """
    
    def __init__(self, bucket_name=DEFAULT_TEMP_BUCKET, 
                local_temp_dir=None, 
                expiration_hours=DEFAULT_EXPIRATION_HOURS):
        """
        Initialize the GCS Temp Manager
        
        Args:
            bucket_name: Name of the GCS bucket to use
            local_temp_dir: Local directory to use for temp files
            expiration_hours: Hours until temporary files are expired
        """
        self.bucket_name = bucket_name
        self.local_temp_dir = local_temp_dir or DEFAULT_LOCAL_TEMP_DIR
        self.expiration_hours = expiration_hours
        self._client = None
        self._bucket = None
        
        # Create local temp dir if it doesn't exist
        os.makedirs(self.local_temp_dir, exist_ok=True)
        
        # Try to initialize GCS client
        self._init_client()
        
    def _init_client(self) -> bool:
        """
        Initialize the GCS client
        
        Returns:
            True if successful, False otherwise
        """
        if not HAS_GCS:
            logger.warning("Google Cloud Storage libraries not available. "
                          "GCS operations will be disabled.")
            return False
            
        try:
            # First try with default credentials
            self._client = storage.Client()
            
            # Test if the client works by accessing the bucket
            self._bucket = self._client.bucket(self.bucket_name)
            # Test if the bucket exists with a metadata call
            self._bucket.reload()
            
            logger.info(f"Successfully initialized GCS client with bucket: {self.bucket_name}")
            return True
            
        except Exception as e:
            logger.warning(f"Failed to initialize GCS client with default credentials: {e}")
            
            # Try with environment variable as fallback
            creds_json = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
            if creds_json:
                try:
                    credentials = service_account.Credentials.from_service_account_file(creds_json)
                    self._client = storage.Client(credentials=credentials)
                    self._bucket = self._client.bucket(self.bucket_name)
                    self._bucket.reload()
                    logger.info(f"Successfully initialized GCS client with credentials from file.")
                    return True
                except Exception as e2:
                    logger.error(f"Failed to initialize GCS client with credentials file: {e2}")
            
            # If all attempts fail, disable GCS functionality
            logger.warning("GCS operations will be disabled due to initialization failure.")
            return False
    
    @property
    def is_enabled(self) -> bool:
        """Check if GCS operations are enabled"""
        return HAS_GCS and self._client is not None and self._bucket is not None
    
    def generate_temp_path(self, prefix="temp", extension=None) -> str:
        """
        Generate a temporary file path in the GCS bucket
        
        Args:
            prefix: Prefix for the filename
            extension: File extension (with or without dot)
            
        Returns:
            GCS path in gs://{bucket}/{path} format
        """
        # Generate a timestamp-based unique identifier
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        
        # Create the filename with extension if provided
        if extension:
            if not extension.startswith('.'):
                extension = f".{extension}"
            filename = f"{prefix}_{timestamp}_{unique_id}{extension}"
        else:
            filename = f"{prefix}_{timestamp}_{unique_id}"
            
        # Return the full GCS path
        return f"gs://{self.bucket_name}/{filename}"
    
    def upload_to_gcs(self, local_path: str, gcs_path: Optional[str] = None) -> Optional[str]:
        """
        Upload a local file to GCS temp bucket
        
        Args:
            local_path: Path to the local file
            gcs_path: Optional GCS path (if None, one will be generated)
            
        Returns:
            Full GCS path (gs://{bucket}/{blob}) or None if failed
        """
        if not self.is_enabled:
            logger.warning("GCS operations are disabled. Cannot upload file.")
            return None
            
        try:
            # Check if the local file exists
            if not os.path.exists(local_path):
                logger.error(f"Local file does not exist: {local_path}")
                return None
                
            # Create a GCS path if not provided
            if not gcs_path:
                # Get the extension from the local path
                _, ext = os.path.splitext(local_path)
                gcs_path = self.generate_temp_path(extension=ext)
            
            # Extract the blob name from gs:// URL if needed
            if gcs_path.startswith("gs://"):
                # Remove gs://{bucket}/ prefix
                parts = gcs_path.split("/", 3)
                if len(parts) >= 4:
                    blob_name = parts[3]
                else:
                    # If format is unexpected, generate a new path
                    _, ext = os.path.splitext(local_path)
                    gcs_path = self.generate_temp_path(extension=ext)
                    blob_name = gcs_path.split("/", 3)[3]
            else:
                # If not a gs:// URL, use as blob name directly
                blob_name = gcs_path
            
            # Upload the file
            start_time = time.time()
            blob = self._bucket.blob(blob_name)
            blob.upload_from_filename(local_path)
            
            # Set metadata for cleanup
            expiration = datetime.now() + timedelta(hours=self.expiration_hours)
            blob.metadata = {
                "expiration": expiration.isoformat(),
                "temp": "true"
            }
            blob.patch()
            
            elapsed = time.time() - start_time
            file_size = os.path.getsize(local_path) / (1024 * 1024)  # Size in MB
            
            logger.info(f"Uploaded {file_size:.2f}MB to GCS in {elapsed:.2f}s: gs://{self.bucket_name}/{blob_name}")
            
            return f"gs://{self.bucket_name}/{blob_name}"
            
        except Exception as e:
            logger.error(f"Error uploading file to GCS: {e}")
            return None
    
    def download_from_gcs(self, gcs_path: str, local_path: Optional[str] = None) -> Optional[str]:
        """
        Download a file from GCS to local storage
        
        Args:
            gcs_path: GCS path (gs://{bucket}/{blob})
            local_path: Optional local path (if None, temp file will be created)
            
        Returns:
            Path to the downloaded local file or None if failed
        """
        if not self.is_enabled:
            logger.warning("GCS operations are disabled. Cannot download file.")
            return None
            
        try:
            # Extract blob name from gs:// URL
            if gcs_path.startswith("gs://"):
                parts = gcs_path.split("/", 3)
                if len(parts) < 4:
                    logger.error(f"Invalid GCS path: {gcs_path}")
                    return None
                    
                bucket_name = parts[2]
                blob_name = parts[3]
                
                # If bucket differs from our configured bucket, get it explicitly
                if bucket_name != self.bucket_name:
                    bucket = self._client.bucket(bucket_name)
                else:
                    bucket = self._bucket
            else:
                # Assume it's a blob name in the configured bucket
                blob_name = gcs_path
                bucket = self._bucket
            
            # Create a local path if not provided
            if not local_path:
                # Get the extension from the blob name if possible
                _, ext = os.path.splitext(blob_name)
                fd, local_path = tempfile.mkstemp(prefix="gcs_", suffix=ext, dir=self.local_temp_dir)
                os.close(fd)
            
            # Download the file
            start_time = time.time()
            blob = bucket.blob(blob_name)
            blob.download_to_filename(local_path)
            
            elapsed = time.time() - start_time
            file_size = os.path.getsize(local_path) / (1024 * 1024)  # Size in MB
            
            logger.info(f"Downloaded {file_size:.2f}MB from GCS in {elapsed:.2f}s to {local_path}")
            
            return local_path
            
        except Exception as e:
            logger.error(f"Error downloading file from GCS: {e}")
            return None
    
    def cleanup_expired_files(self) -> int:
        """
        Delete expired temporary files from the GCS bucket
        
        Returns:
            Number of files deleted
        """
        if not self.is_enabled:
            logger.warning("GCS operations are disabled. Cannot cleanup files.")
            return 0
            
        try:
            # Get all blobs with temp metadata
            blobs = self._bucket.list_blobs()
            now = datetime.now()
            deleted_count = 0
            
            for blob in blobs:
                # Check if this is a temp file by metadata
                if blob.metadata and blob.metadata.get("temp") == "true":
                    # Check if expired
                    expiration_str = blob.metadata.get("expiration")
                    if expiration_str:
                        try:
                            expiration = datetime.fromisoformat(expiration_str)
                            if now > expiration:
                                blob.delete()
                                deleted_count += 1
                                logger.info(f"Deleted expired temp file: {blob.name}")
                        except (ValueError, TypeError):
                            logger.warning(f"Invalid expiration format for blob: {blob.name}")
            
            logger.info(f"Cleaned up {deleted_count} expired files from GCS bucket")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error cleaning up expired files: {e}")
            return 0
    
    @contextmanager
    def temp_gcs_file(self, local_path: str, extension: Optional[str] = None) -> Generator[str, None, None]:
        """
        Context manager to upload a file to GCS and automatically clean it up after use
        
        Args:
            local_path: Path to local file to upload
            extension: Optional file extension
            
        Yields:
            GCS path to the uploaded file
        """
        gcs_path = None
        try:
            # Generate a temporary path and upload
            gcs_path = self.upload_to_gcs(local_path)
            logger.info(f"Created temporary GCS file: {gcs_path}")
            yield gcs_path
            
        finally:
            # Clean up the file when done
            if gcs_path and self.is_enabled:
                try:
                    # Extract blob name
                    parts = gcs_path.split("/", 3)
                    if len(parts) >= 4:
                        blob_name = parts[3]
                        blob = self._bucket.blob(blob_name)
                        blob.delete()
                        logger.info(f"Deleted temporary GCS file: {gcs_path}")
                except Exception as e:
                    logger.warning(f"Failed to delete temporary GCS file: {e}")

# Create a singleton instance for easy access
_instance = None

def get_gcs_temp_manager(bucket_name=None):
    """Get the singleton instance of GCSTempManager"""
    global _instance
    if _instance is None:
        _instance = GCSTempManager(bucket_name=bucket_name or DEFAULT_TEMP_BUCKET)
    return _instance

def upload_to_gcs_temp(local_path: str) -> Optional[str]:
    """
    Upload a file to GCS temp bucket (convenience function)
    
    Args:
        local_path: Path to local file
        
    Returns:
        GCS URL or None if failed
    """
    manager = get_gcs_temp_manager()
    return manager.upload_to_gcs(local_path)

def download_from_gcs_temp(gcs_path: str) -> Optional[str]:
    """
    Download a file from GCS temp bucket (convenience function)
    
    Args:
        gcs_path: GCS path to download
        
    Returns:
        Local path or None if failed
    """
    manager = get_gcs_temp_manager()
    return manager.download_from_gcs(gcs_path)

def use_in_memory_or_gcs(file_path: str, size_threshold_mb: int = 50) -> str:
    """
    Optimize file handling by either using in-memory or GCS based on size
    
    Args:
        file_path: Path to the file
        size_threshold_mb: Size threshold in MB to decide between memory and GCS
        
    Returns:
        Path to the optimized file location (could be in-memory, GCS, or original)
    """
    try:
        if not os.path.exists(file_path):
            logger.warning(f"File does not exist: {file_path}")
            return file_path
            
        # Check file size
        file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
        
        # If file is small, use in-memory
        if file_size_mb <= size_threshold_mb:
            # Use tempfile to create an in-memory copy
            _, ext = os.path.splitext(file_path)
            temp_file = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
            temp_path = temp_file.name
            
            with open(file_path, 'rb') as src:
                shutil.copyfileobj(src, temp_file)
                
            temp_file.close()
            logger.info(f"Created in-memory copy of {file_size_mb:.2f}MB file: {temp_path}")
            return temp_path
            
        # If file is large, use GCS
        else:
            manager = get_gcs_temp_manager()
            if manager.is_enabled:
                gcs_path = manager.upload_to_gcs(file_path)
                if gcs_path:
                    logger.info(f"Uploaded {file_size_mb:.2f}MB file to GCS: {gcs_path}")
                    return gcs_path
                    
            # If GCS upload failed, return original path
            logger.warning(f"Failed to optimize file handling for {file_path}, using original path")
            return file_path
            
    except Exception as e:
        logger.error(f"Error in use_in_memory_or_gcs: {e}")
        return file_path  # Return original path on error 