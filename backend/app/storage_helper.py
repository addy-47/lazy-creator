import os
import logging
from google.cloud import storage
from google.oauth2 import service_account
import threading
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# Thread-local storage to hold the storage client for each thread
_thread_local = threading.local()

def get_storage_client():
    if hasattr(_thread_local, 'client'):
        return _thread_local.client

    project_id = os.getenv('GCP_PROJECT_ID', 'yt-shorts-automation-452420')
    credentials_json = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    client = None # Initialize client to None

    if credentials_json:
        try:
            logger.info("Using GOOGLE_APPLICATION_CREDENTIALS from environment variable as JSON")
            credentials = service_account.Credentials.from_service_account_info(json.loads(credentials_json))
            client = storage.Client(credentials=credentials, project=project_id)
            logger.info(f"Successfully created storage client with environment credentials")
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in GOOGLE_APPLICATION_CREDENTIALS: {e}")
            # Fall through to other methods
        except Exception as e:
            logger.error(f"Failed to authenticate with GOOGLE_APPLICATION_CREDENTIALS JSON: {e}")
            # Fall through to other methods

    # Check Cloud Run environment only if client wasn't set by JSON env var
    if client is None and os.getenv('K_SERVICE'):
        try:
            logger.info(f"Running in Cloud Run, using default credentials with project {project_id}")
            client = storage.Client(project=project_id)
            logger.info("Successfully authenticated with Cloud Run default credentials")
        except Exception as e:
            logger.error(f"Failed to authenticate with Cloud Run default credentials: {e}")
            # Fall through to other methods

    # Check for credentials file path only if client still not set
    if client is None:
        credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS') # Re-check env var, this time as a path
        if credentials_path and os.path.exists(credentials_path):
            try:
                logger.info(f"Using credentials file: {credentials_path}")
                credentials = service_account.Credentials.from_service_account_file(credentials_path)
                client = storage.Client(credentials=credentials, project=project_id)
                logger.info("Successfully created storage client from file")
            except Exception as e:
                logger.error(f"Failed to authenticate with credentials file {credentials_path}: {e}")
                # Fall through to default
        else:
            logger.info(f"Credentials file path not found or not set.")

    # Final fallback to default credentials if client is still None
    if client is None:
        try:
            logger.info(f"Using default authentication (e.g., gcloud ADC) with project: {project_id}")
            client = storage.Client(project=project_id)
            logger.info("Successfully created storage client with default credentials")
        except Exception as e:
            logger.error(f"Failed to authenticate with default credentials: {e}")
            # If even default fails, raise the error or handle as appropriate
            # For now, we'll let it raise to indicate a critical configuration issue
            raise

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
