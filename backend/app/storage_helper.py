import os
import logging
from google.cloud import storage
from google.oauth2 import service_account
import threading
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# Thread-local storage to hold the storage client for each thread
_thread_local = threading.local()

def get_storage_client():
    """Get a Google Cloud Storage client, creating one if necessary."""
    if hasattr(_thread_local, 'client'):
        return _thread_local.client

    # Get project ID from environment variable
    project_id = os.getenv('GCP_PROJECT_ID', 'yt-shorts-automation-452420')

    # Check if running in Cloud Run
    if os.getenv('K_SERVICE'):
        logger.info("Running in Cloud Run, using default authentication")
        client = storage.Client(project=project_id)
        _thread_local.client = client
        return client

    # Try to get credentials path from environment
    credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')

    if credentials_path and os.path.exists(credentials_path):
        try:
            # Normalize path for the current OS
            credentials_path = os.path.normpath(credentials_path)
            logger.info(f"Using credentials file at: {credentials_path}")

            # Create credentials from service account file
            credentials = service_account.Credentials.from_service_account_file(
                credentials_path,
                scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )

            # Create client with explicit credentials
            client = storage.Client(credentials=credentials, project=project_id)
            logger.info(f"Successfully created storage client with service account credentials")

            # Store the client in thread-local storage
            _thread_local.client = client
            return client
        except Exception as e:
            logger.error(f"Error creating storage client with credentials file: {e}")
            # Fall back to default authentication
            client = storage.Client(project=project_id)
            logger.info(f"Using default authentication with project: {project_id}")

            # Store the client in thread-local storage
            _thread_local.client = client
            return client
    else:
        # If no credentials file is available, use default authentication
        logger.info(f"No credentials file found, using default authentication with project: {project_id}")
        client = storage.Client(project=project_id)

        # Store the client in thread-local storage
        _thread_local.client = client
        return client

def init_module():
    """Initialize the module by creating a storage client."""
    try:
        get_storage_client()
    except Exception as e:
        logger.error(f"Error initializing storage helper: {e}")

def reset_client():
    """Reset the storage client (useful for testing)."""
    if hasattr(_thread_local, 'client'):
        delattr(_thread_local, 'client')

# Initialize the module
init_module()
