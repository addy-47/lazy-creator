import os  # for interacting with the file system and operating system
import pickle  # for  saving objects to a file and loading them
import json
from dotenv import load_dotenv
from google.oauth2.credentials import Credentials # for storing and using an access token to authenticate with Google APIs
# even though the class is imported, it is not used directly in the code as it is used internally by google_auth_oauthlib.flow
from google_auth_oauthlib.flow import InstalledAppFlow, Flow # for handling the OAuth 2.0 flow with Google APIs
from google.auth.transport.requests import Request # for making HTTP requests
import uuid

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

    return auth_url, state

def get_credentials_from_code(code, state, redirect_uri):
    """Exchange authorization code for credentials."""
    flow_path = f"{TOKEN_DIR}/flow_{state}.pickle"

    if not os.path.exists(flow_path):
        raise FileNotFoundError(f"Auth flow not found. Please start authentication again.")

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

    return credentials

def get_credentials(user_id):
    """Get credentials for a specific user."""
    token_path = f"{TOKEN_DIR}/token_{user_id}.pickle"
    credentials = None

    if os.path.exists(token_path):
        with open(token_path, "rb") as token:
            credentials = pickle.load(token)

    if credentials and credentials.valid:
        return credentials

    if credentials and credentials.expired and credentials.refresh_token:
        try:
            credentials.refresh(Request())
            # Save refreshed credentials
            with open(token_path, "wb") as f:
                pickle.dump(credentials, f)
            return credentials
        except Exception as e:
            print(f"Error refreshing token: {e}")
            # Token cannot be refreshed, need to re-authenticate
            return None

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
            credentials.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRETS_FILE, SCOPES)
            credentials = flow.run_local_server(port=0)
        with open("token.pickle", "wb") as token:
            pickle.dump(credentials, token)

    print("✅ Authentication successful!")
    return credentials
