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

    if credentials_json:
        try:
            logger.info("Using GOOGLE_APPLICATION_CREDENTIALS from environment variable")
            credentials = service_account.Credentials.from_service_account_info(json.loads(credentials_json))
            client = storage.Client(credentials=credentials, project=project_id)
            logger.info(f"Successfully created storage client with environment credentials")
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in GOOGLE_APPLICATION_CREDENTIALS: {e}")
            client = storage.Client(project=project_id)
    elif os.getenv('K_SERVICE'):
        logger.info("Running in Cloud Run, using default authentication")
        client = storage.Client(project=project_id)
    else:
        credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
        if credentials_path and os.path.exists(credentials_path):
            credentials = service_account.Credentials.from_service_account_file(credentials_path)
            client = storage.Client(credentials=credentials, project=project_id)
        else:
            logger.info(f"No credentials file found, using default authentication with project: {project_id}")
            client = storage.Client(project=project_id)

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
