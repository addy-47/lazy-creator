import os
import logging
from google.cloud import storage
from google.oauth2 import service_account
import threading

logger = logging.getLogger(__name__)

# Thread-local storage to hold the storage client for each thread
_thread_local = threading.local()

def get_storage_client():
    """
    Creates a Google Cloud Storage client using the correct service account.
    This should be used across the application for any direct GCS operations.

    Returns:
        A Google Cloud Storage client configured with the correct service account
    """
    # Check if we're running in Cloud Run
    is_cloud_run = os.getenv('K_SERVICE') is not None
    
    # Check if we already have a client for this thread
    if hasattr(_thread_local, 'client'):
        return _thread_local.client

    # Get service account information from environment variables
    service_account_email = os.getenv('GCS_SERVICE_ACCOUNT', 'lazycreator-1@yt-shorts-automation-452420.iam.gserviceaccount.com')
    credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    project_id = os.getenv('GCP_PROJECT', "yt-shorts-automation-452420")

    logger.info(f"Creating storage client with service account: {service_account_email}")

    if is_cloud_run:
        # In Cloud Run, we'll use the default service account
        logger.info("Running in Cloud Run, using default authentication")
        client = storage.Client(project=project_id)
        _thread_local.client = client
        return client
    elif credentials_path and os.path.exists(credentials_path):
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
    """
    Initialize the module by overriding the storage import in other modules.
    This is used to patch imports in parallel processing environments.
    """
    # This is used to initialize module-level settings
    logger.info("Initializing storage_helper module")

    # Force the environment variable to the correct value if it's not set
    if not os.getenv('GOOGLE_APPLICATION_CREDENTIALS'):
        # Look for GCS_CREDENTIALS_FILE first
        gcs_creds = os.getenv('GCS_CREDENTIALS_FILE')
        if gcs_creds:
            logger.info(f"Setting GOOGLE_APPLICATION_CREDENTIALS to value from GCS_CREDENTIALS_FILE: {gcs_creds}")
            os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = gcs_creds

def reset_client():
    """
    Reset the thread-local client.
    This is useful in multiprocessing environments where threads might be reused.
    """
    if hasattr(_thread_local, 'client'):
        delattr(_thread_local, 'client')
        logger.debug("Thread-local storage client reset")

# Initialize the module
init_module()
