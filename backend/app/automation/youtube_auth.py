import os  # for interacting with the file system and operating system
import pickle  # for saving objects to a file and loading them
import json
import logging
from dotenv import load_dotenv
from google.oauth2.credentials import Credentials # for storing and using an access token to authenticate with Google APIs
from google_auth_oauthlib.flow import InstalledAppFlow, Flow # for handling the OAuth 2.0 flow with Google APIs
from google.auth.transport.requests import Request # for making HTTP requests
import uuid

# Configure logging
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()
CLIENT_SECRETS_FILE = os.getenv("YOUTUBE_CLIENT_SECRETS", "client_secret.json")
SCOPES = ("https://www.googleapis.com/auth/youtube.upload",
          "https://www.googleapis.com/auth/youtube",
          "https://www.googleapis.com/auth/youtube.force-ssl",
          "https://www.googleapis.com/auth/youtube.readonly")
TOKEN_DIR = "tokens"
# Ensure token directory exists
os.makedirs(TOKEN_DIR, exist_ok=True)

def get_auth_url(redirect_uri, user_id=None):
    """Generate an authorization URL for YouTube OAuth2 flow."""
    if not os.path.exists(CLIENT_SECRETS_FILE):
        raise FileNotFoundError(f"Client secrets file not found: {CLIENT_SECRETS_FILE}")

    # Create a unique state to identify this auth request
    state = user_id or str(uuid.uuid4())

    # Create flow instance
    try:
        flow = Flow.from_client_secrets_file(
            CLIENT_SECRETS_FILE,
            scopes=SCOPES,
            redirect_uri=redirect_uri
        )

        # Generate authorization URL
        auth_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            state=state,
            prompt='consent'  # Force to show consent screen to get refresh token
        )

        # Save flow for later use
        with open(f"{TOKEN_DIR}/flow_{state}.pickle", "wb") as f:
            pickle.dump(flow, f)

        logger.info(f"Created auth flow for user ID: {state}")
        return auth_url, state
    except Exception as e:
        logger.error(f"Error creating auth flow: {e}")
        raise

def get_credentials_from_code(code, state, redirect_uri):
    """Exchange authorization code for credentials."""
    flow_path = f"{TOKEN_DIR}/flow_{state}.pickle"

    if not os.path.exists(flow_path):
        logger.error(f"Auth flow not found for state: {state}")
        raise FileNotFoundError(f"Auth flow not found. Please start authentication again.")

    try:
        # Load the saved flow
        with open(flow_path, "rb") as f:
            flow = pickle.load(f)

        # Override redirect_uri as it may have changed
        flow.redirect_uri = redirect_uri

        # Exchange code for credentials
        flow.fetch_token(code=code)
        credentials = flow.credentials

        # Save credentials
        with open(f"{TOKEN_DIR}/token_{state}.pickle", "wb") as f:
            pickle.dump(credentials, f)

        # Clean up flow file
        os.remove(flow_path)

        logger.info(f"Successfully obtained credentials for user ID: {state}")
        return credentials
    except Exception as e:
        logger.error(f"Error getting credentials from code: {e}")
        # Clean up flow file if it exists (to avoid stale flows)
        if os.path.exists(flow_path):
            try:
                os.remove(flow_path)
            except:
                pass
        raise

def get_credentials(user_id):
    """Get credentials for a specific user."""
    if not user_id:
        logger.error("No user ID provided to get_credentials")
        return None

    token_path = f"{TOKEN_DIR}/token_{user_id}.pickle"
    credentials = None

    try:
        # Check if token file exists
        if not os.path.exists(token_path):
            logger.warning(f"Token file not found for user ID: {user_id}")
            return None

        # Load the credentials
        try:
            with open(token_path, "rb") as token:
                credentials = pickle.load(token)
        except (pickle.UnpicklingError, EOFError) as pe:
            logger.error(f"Error unpickling credentials for user ID {user_id}: {pe}")
            # Token file might be corrupted, rename it and return None
            try:
                os.rename(token_path, f"{token_path}.corrupted")
                logger.info(f"Renamed corrupted token file to {token_path}.corrupted")
            except Exception as rename_err:
                logger.error(f"Failed to rename corrupted token file: {rename_err}")
            return None

        # Check if credentials are valid
        if credentials and credentials.valid:
            logger.info(f"Found valid credentials for user ID: {user_id}")
            return credentials

        # Try to refresh expired credentials
        if credentials and credentials.expired and credentials.refresh_token:
            try:
                logger.info(f"Refreshing expired token for user ID: {user_id}")
                # Create a new Request instance for each refresh
                credentials.refresh(Request())

                # Verify the refreshed credentials
                if credentials.valid:
                    logger.info(f"Successfully refreshed token for user ID: {user_id}")
                    # Save refreshed credentials
                    with open(token_path, "wb") as f:
                        pickle.dump(credentials, f)
                    return credentials
                else:
                    logger.warning(f"Token refresh completed but credentials are still invalid for user ID: {user_id}")
                    return None
            except Exception as e:
                logger.error(f"Error refreshing token for user ID {user_id}: {e}")
                # Token refresh failed, but don't delete the file as the refresh token might still be valid
                # on a future attempt
                return None

        logger.warning(f"No valid credentials found for user ID: {user_id}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in get_credentials for user ID {user_id}: {e}")
        return None

def authenticate_youtube():
    """
    Authenticate with YouTube and return credentials.
    This is a local server based flow for scripts running on a local machine.
    """
    credentials = None
    token_file = "token.pickle"
    app_dir = os.path.dirname(os.path.abspath(__file__))
    token_path = os.path.join(app_dir, token_file)

    # Load existing credentials if available
    if os.path.exists(token_path):
        with open(token_path, "rb") as token:
            credentials = pickle.load(token)

    # Check if credentials are invalid or expired
    if not credentials or not credentials.valid:
        try:
            if credentials and credentials.expired and credentials.refresh_token:
                # Refresh the token if possible
                credentials.refresh(Request())
                logger.info("Token refreshed successfully!")
            else:
                # Prompt user for re-authentication if no valid refresh token
                logger.info("Token expired or invalid. Re-authenticating...")
                flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRETS_FILE, SCOPES)
                credentials = flow.run_local_server(port=0)
        except Exception as e:
            logger.error(f"Error during token refresh or authentication: {e}")
            logger.info("Re-authenticating...")
            flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRETS_FILE, SCOPES)
            credentials = flow.run_local_server(port=0)

        # Save the new or refreshed credentials
        with open(token_path, "wb") as token:
            pickle.dump(credentials, token)

    logger.info("Authentication successful!")
    return credentials

def check_auth_status(user_id):
    """
    Check if a user is authenticated with YouTube.

    Args:
        user_id (str): The user ID to check

    Returns:
        bool: True if the user is authenticated, False otherwise
    """
    if not user_id:
        logger.warning("No user ID provided to check_auth_status")
        return False

    credentials = get_credentials(user_id)
    return credentials is not None and credentials.valid
