import os  # for interacting with the file system and operating system
import pickle  # for  saving objects to a file and loading them
import json
import logging
from dotenv import load_dotenv
from google.oauth2.credentials import Credentials # for storing and using an access token to authenticate with Google APIs
# even though the class is imported, it is not used directly in the code as it is used internally by google_auth_oauthlib.flow
from google_auth_oauthlib.flow import InstalledAppFlow, Flow # for handling the OAuth 2.0 flow with Google APIs
from google.auth.transport.requests import Request # for making HTTP requests
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()
CLIENT_SECRETS_FILE = os.getenv("YOUTUBE_CLIENT_SECRETS", "client_secret.json")
SCOPES = ["https://www.googleapis.com/auth/youtube.upload"] # YouTube Data API v3 scope
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
        if os.path.exists(token_path):
            with open(token_path, "rb") as token:
                credentials = pickle.load(token)

        if credentials and credentials.valid:
            logger.debug(f"Found valid credentials for user ID: {user_id}")
            return credentials

        if credentials and credentials.expired and credentials.refresh_token:
            try:
                logger.info(f"Refreshing expired token for user ID: {user_id}")
                credentials.refresh(Request())
                # Save refreshed credentials
                with open(token_path, "wb") as f:
                    pickle.dump(credentials, f)
                return credentials
            except Exception as e:
                logger.error(f"Error refreshing token for user ID {user_id}: {e}")
                # Don't delete the token file, as the refresh token might still be valid
                return None

        logger.warning(f"No valid credentials found for user ID: {user_id}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in get_credentials for user ID {user_id}: {e}")
        return None

# Legacy function for backward compatibility
def authenticate_youtube():
    """Legacy authentication method using local server."""
    credentials = None
    if os.path.exists("token.pickle"):
        with open("token.pickle", "rb") as token: # Open the file in binary mode -rb (read binary)
            credentials = pickle.load(token)
    if not credentials or not credentials.valid:
        if credentials and credentials.expired and credentials.refresh_token:
            try:
                credentials.refresh(Request())
            except Exception as e:
                logger.error(f"Error refreshing legacy token: {e}")
                # If refresh fails, proceed to getting a new token
                credentials = None

        if not credentials:
            flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRETS_FILE, SCOPES)
            credentials = flow.run_local_server(port=0)

        with open("token.pickle", "wb") as token:
            pickle.dump(credentials, token)

    logger.info("Authentication successful!")
    return credentials
