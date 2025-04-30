"""
Simplified YouTube Authentication module.
This module handles all YouTube API-related functionality without any demo user checks.
"""

import os
import logging
import json
from datetime import datetime, timezone # Ensure timezone is imported
from flask import jsonify, request, redirect, make_response
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.auth.transport.requests import Request
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Scopes needed for YouTube uploads
YOUTUBE_SCOPES = [
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.force-ssl'
]

# Load OAuth credentials with flexible path resolution
def get_client_secrets_path():
    """Get YouTube client secrets, prioritizing environment variable as JSON."""
    client_secrets_env = os.getenv('YOUTUBE_CLIENT_SECRETS')
    if client_secrets_env:
        logger.info("Using YOUTUBE_CLIENT_SECRETS from environment variable")
        try:
            secrets_dict = json.loads(client_secrets_env)
            # Validate the structure minimally (check for 'web' or 'installed' key)
            if 'web' in secrets_dict or 'installed' in secrets_dict:
                 return secrets_dict  # Return the dictionary directly
            else:
                logger.error("Invalid structure in YOUTUBE_CLIENT_SECRETS JSON")
                return None
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in YOUTUBE_CLIENT_SECRETS: {e}")
            return None

    # Fallback to file-based search only if env var is not set or invalid
    logger.info("YOUTUBE_CLIENT_SECRETS not found or invalid, searching for client_secret.json file.")
    potential_paths = [
        os.path.join(os.path.dirname(__file__), 'client_secret.json'),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), 'client_secret.json'),
        os.path.join(os.path.dirname(__file__), 'credentials', 'client_secret.json'),
    ]
    for path in potential_paths:
        if os.path.exists(path):
            logger.warning(f"Using fallback client secrets file at {path}. Consider setting YOUTUBE_CLIENT_SECRETS environment variable.")
            return path
    logger.error("No client secrets found in environment or file system")
    return None

# Update client_secrets_file initialization
client_secrets_data = get_client_secrets_path()

# Initialize flow_kwargs for Flow constructor
flow_kwargs = {
    'scopes': YOUTUBE_SCOPES,
    'redirect_uri': None # Will be set per request
}

if isinstance(client_secrets_data, dict):
    logger.info("Initializing OAuth flow using client secrets from environment variable")
    flow_kwargs['client_config'] = client_secrets_data
else:
    # If it's a path (string) or None
    client_secrets_file = client_secrets_data
    if client_secrets_file and os.path.exists(client_secrets_file):
        logger.info(f"Initializing OAuth flow using client secrets file: {client_secrets_file}")
        flow_kwargs['client_secrets_file'] = client_secrets_file
    else:
        logger.error("No valid YouTube client secrets found in environment variable or file. YouTube functionality will be disabled.")
        # Set client_secrets_data to None to indicate failure
        client_secrets_data = None

# Scopes needed for YouTube uploads << DELETE THIS BLOCK
# YOUTUBE_SCOPES = [ << DELETE THIS BLOCK
#     'https://www.googleapis.com/auth/youtube', << DELETE THIS BLOCK
#     'https://www.googleapis.com/auth/youtube.readonly', << DELETE THIS BLOCK
#     'https://www.googleapis.com/auth/youtube.upload', << DELETE THIS BLOCK
#     'https://www.googleapis.com/auth/youtube.force-ssl' << DELETE THIS BLOCK
# ] << DELETE THIS BLOCK

def setup_routes(app, db, users_collection, token_required, skip_routes=None):
    """Set up all YouTube auth related routes"""

    # Initialize skip_routes if not provided
    if skip_routes is None:
        skip_routes = []

    if 'youtube_auth_status' not in skip_routes:
        @app.route('/api/youtube-auth-status', methods=['GET', 'OPTIONS'])
        def youtube_auth_status():
            # Handle OPTIONS request for CORS preflight
            if request.method == 'OPTIONS':
                response = make_response()
                response.headers.add('Access-Control-Allow-Origin', '*')
                response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-access-token')
                response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
                return response

            # Regular GET request
            # Get token manually
            token = None
            if 'x-access-token' in request.headers:
                token = request.headers['x-access-token']
            elif 'Authorization' in request.headers:
                auth_header = request.headers['Authorization']
                if auth_header.startswith('Bearer '):
                    token = auth_header[7:]
            elif 'token' in request.args:
                token = request.args.get('token')

            if not token:
                return jsonify({'message': 'Token is missing!', 'status': 'error'}), 401

            # Find the user - simplified version without full token_required
            try:
                # Simplified - just decode token
                # You'll need to implement this based on your app's jwt approach
                from jwt import decode
                try:
                    data = decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
                except Exception as e:
                    logger.error(f"Token decode error: {e}")
                    return jsonify({'message': 'Invalid token!', 'status': 'error'}), 401

                # Get user from DB
                user = users_collection.find_one({'email': data['email']})
                if not user:
                    return jsonify({'message': 'User not found!', 'status': 'error'}), 401

                user_id = str(user['_id'])

                # Check if credentials exist
                is_authenticated = check_auth_status(user_id)

                return jsonify({
                    "status": "success",
                    "authenticated": is_authenticated,
                    "is_connected": is_authenticated
                })

            except Exception as e:
                logger.error(f"Error checking YouTube auth status: {e}")
                return jsonify({"status": "error", "message": str(e)}), 500

    if 'youtube_auth_start' not in skip_routes:
        @app.route('/api/youtube-auth-start', methods=['GET', 'OPTIONS'])
        def youtube_auth_start():
            # Handle OPTIONS request for CORS preflight
            if request.method == 'OPTIONS':
                response = make_response()
                response.headers.add('Access-Control-Allow-Origin', '*')
                response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-access-token')
                response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
                return response

            # Regular GET request
            # Get token manually
            token = None
            if 'x-access-token' in request.headers:
                token = request.headers['x-access-token']
            elif 'Authorization' in request.headers:
                auth_header = request.headers['Authorization']
                if auth_header.startswith('Bearer '):
                    token = auth_header[7:]
            elif 'token' in request.args:
                token = request.args.get('token')

            if not token:
                return jsonify({'message': 'Token is missing!', 'status': 'error'}), 401

            # Find the user - simplified version without full token_required
            try:
                # Simplified - just decode token
                # You'll need to implement this based on your app's jwt approach
                from jwt import decode
                try:
                    data = decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
                except Exception as e:
                    logger.error(f"Token decode error: {e}")
                    return jsonify({'message': 'Invalid token!', 'status': 'error'}), 401

                # Get user from DB
                user = users_collection.find_one({'email': data['email']})
                if not user:
                    return jsonify({'message': 'User not found!', 'status': 'error'}), 401

                user_id = str(user['_id'])
                user_email = user.get('email', 'Unknown')

                logger.info(f"YouTube Auth Start - User info - Email: {user_email}, ID: {user_id}")

                # Get frontend URL for redirect
                frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3500')

                # Check if redirect_uri is provided in request
                redirect_uri = request.args.get('redirect_uri')
                if not redirect_uri:
                    redirect_uri = f"{frontend_url}/youtube-auth-success"

                logger.info(f"Using redirect URI: {redirect_uri}")

                # Generate the authorization URL
                auth_url = get_auth_url(user_id, redirect_uri)

                logger.info(f"Generated YouTube auth URL for user {user_id}")

                # Return the auth URL with state
                state = encode_state_param(user_id)
                return jsonify({
                    "status": "success",
                    "auth_url": auth_url,
                    "state": state,
                    "redirect_uri": redirect_uri
                })

            except Exception as e:
                logger.error(f"Error starting YouTube auth: {e}")
                return jsonify({"status": "error", "message": str(e)}), 500

    if 'youtube_auth_callback' not in skip_routes:
        @app.route('/api/youtube-auth-callback', methods=['GET'])
        def youtube_auth_callback():
            try:
                code = request.args.get('code')
                state = request.args.get('state')

                if not code or not state:
                    error_msg = "Missing code or state parameter"
                    logger.error(f"Auth callback error: {error_msg}")
                    return jsonify({"status": "error", "message": error_msg}), 400

                # Get the frontend URL from environment
                frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3500')

                # Use the same redirect_uri that was used to generate the auth URL
                redirect_uri = f"{frontend_url}/youtube-auth-success"

                logger.info(f"YouTube Auth Callback - state: {state}, redirect URI: {redirect_uri}")

                # Exchange code for credentials
                try:
                    get_credentials_from_code(code, state, redirect_uri)
                    logger.info(f"Successfully exchanged code for credentials for state: {state}")
                except Exception as credential_error:
                    logger.error(f"Error exchanging code for credentials: {credential_error}")
                    return redirect(f"{frontend_url}/gallery?error=auth_failed&message={str(credential_error)}")

                # Redirect to frontend
                return redirect(f"{frontend_url}/youtube-auth-success?state={state}")
            except Exception as e:
                logger.error(f"Error in YouTube auth callback: {e}")
                frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3500')
                return redirect(f"{frontend_url}/gallery?error=auth_failed&message={str(e)}")

    if 'youtube_channels' not in skip_routes:
        @app.route('/api/youtube/channels', methods=['GET', 'OPTIONS'])
        def youtube_channels():
            # Handle OPTIONS request for CORS preflight
            if request.method == 'OPTIONS':
                response = make_response()
                response.headers.add('Access-Control-Allow-Origin', '*')
                response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-access-token')
                response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
                return response

            # Regular GET request
            # Get token manually
            token = None
            if 'x-access-token' in request.headers:
                token = request.headers['x-access-token']
            elif 'Authorization' in request.headers:
                auth_header = request.headers['Authorization']
                if auth_header.startswith('Bearer '):
                    token = auth_header[7:]
            elif 'token' in request.args:
                token = request.args.get('token')

            if not token:
                return jsonify({'message': 'Token is missing!', 'status': 'error'}), 401

            # Find the user - simplified version without full token_required
            try:
                # Simplified - just decode token
                # You'll need to implement this based on your app's jwt approach
                from jwt import decode
                try:
                    data = decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
                except Exception as e:
                    logger.error(f"Token decode error: {e}")
                    return jsonify({'message': 'Invalid token!', 'status': 'error'}), 401

                # Get user from DB
                user = users_collection.find_one({'email': data['email']})
                if not user:
                    return jsonify({'message': 'User not found!', 'status': 'error'}), 401

                user_id = str(user['_id'])

                # Get YouTube service
                youtube = get_authenticated_service(user_id)

                if not youtube:
                    return jsonify({
                        "status": "error",
                        "message": "YouTube authentication required",
                        "require_auth": True
                    }), 401

                # Fetch channels
                channels_response = youtube.channels().list(
                    part="snippet,contentDetails,statistics",
                    mine=True,
                    maxResults=50
                ).execute()

                # Parse channel data
                channels = []
                for channel in channels_response.get('items', []):
                    channel_info = {
                        "id": channel['id'],
                        "title": channel['snippet']['title'],
                        "description": channel['snippet'].get('description', ''),
                        "customUrl": channel['snippet'].get('customUrl')
                    }

                    # Get thumbnail if available
                    thumbnails = channel['snippet'].get('thumbnails', {})
                    if thumbnails:
                        for quality in ['default', 'medium', 'high']:
                            if quality in thumbnails:
                                channel_info['thumbnailUrl'] = thumbnails[quality]['url']
                                break

                    channels.append(channel_info)

                return jsonify({
                    "status": "success",
                    "channels": channels
                })

            except Exception as e:
                logger.error(f"Error fetching YouTube channels: {e}")
                return jsonify({"status": "error", "message": str(e)}), 500

# Helper functions for YouTube authentication
def get_credentials_path(user_id):
    """Get path to store user's YouTube credentials"""
    # Get credentials directory from env var or use default
    credentials_dir = os.getenv('YOUTUBE_CREDENTIALS_DIR', os.path.join(os.path.dirname(__file__), 'credentials'))
    os.makedirs(credentials_dir, exist_ok=True)
    return os.path.join(credentials_dir, f"youtube_{user_id}.json")

def get_credentials(user_id):
    """Get OAuth credentials for a specific user"""
    try:
        credentials_path = get_credentials_path(user_id)
        if not os.path.exists(credentials_path):
            logger.warning(f"No credentials file found for user {user_id}")
            return None

        # Load credentials from file
        with open(credentials_path, 'r') as f:
            credentials_data = json.load(f)

        credentials = Credentials.from_authorized_user_info(credentials_data)

        # Check if credentials are expired
        if credentials.expired and credentials.refresh_token:
            try:
                credentials.refresh(Request())
                # Save refreshed credentials
                with open(credentials_path, 'w') as f:
                    f.write(credentials.to_json())
                logger.info(f"Refreshed credentials for user {user_id}")
            except Exception as e:
                logger.error(f"Error refreshing credentials: {e}")
                return None

        return credentials
    except Exception as e:
        logger.error(f"Error getting credentials for user {user_id}: {e}")
        return None

def clear_credentials(user_id):
    """Delete stored credentials for a user to force re-authentication"""
    credentials_path = get_credentials_path(user_id)
    if os.path.exists(credentials_path):
        try:
            os.remove(credentials_path)
            logger.info(f"Cleared YouTube credentials for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Error clearing credentials for user {user_id}: {e}")
            return False
    return False

def check_auth_status(user_id):
    """Check if the user has valid YouTube credentials"""
    try:
        credentials_path = get_credentials_path(user_id)

        # If credentials don't exist, user is not authenticated
        if not os.path.exists(credentials_path):
            logger.info(f"No credentials file found for user {user_id}")
            return False

        # Load credentials from file
        with open(credentials_path, 'r') as cred_file:
            cred_json = json.load(cred_file)

        # Check if the stored scopes match our current required scopes
        if 'scopes' in cred_json:
            stored_scopes = set(cred_json.get('scopes', []))
            required_scopes = set(YOUTUBE_SCOPES)

            # If scopes don't match, clear credentials and require re-auth
            if stored_scopes != required_scopes:
                logger.warning(f"Scope mismatch for user {user_id}. Clearing credentials and requiring re-auth.")
                clear_credentials(user_id)
                return False

        # Load credentials
        credentials = Credentials.from_authorized_user_info(cred_json)

        # Check if credentials are valid and not expired
        if credentials and credentials.valid:
            return True

        # Try to refresh if expired
        if credentials and credentials.expired and credentials.refresh_token:
            try:
                credentials.refresh(Request())
                # Save refreshed credentials
                with open(credentials_path, 'w') as cred_file:
                    cred_file.write(credentials.to_json())
                return True
            except Exception as refresh_error:
                logger.error(f"Error refreshing credentials for user {user_id}: {refresh_error}")
                clear_credentials(user_id)
                return False

        # If we get here, credentials are invalid
        logger.info(f"Invalid credentials for user {user_id}")
        return False

    except Exception as e:
        logger.error(f"Error checking auth status for user {user_id}: {e}")
        return False

def get_auth_url(user_id, redirect_uri):
    try:
        if isinstance(client_secrets, dict):
            flow = Flow.from_client_config(client_secrets, scopes=YOUTUBE_SCOPES, redirect_uri=redirect_uri)
        else:
            flow = Flow.from_client_secrets_file(client_secrets_file, scopes=YOUTUBE_SCOPES, redirect_uri=redirect_uri)
        auth_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent',
            state=encode_state_param(user_id)
        )
        return auth_url
    except Exception as e:
        logger.error(f"Error generating auth URL: {e}")
        raise

def encode_state_param(user_id):
    """Encode user ID in state parameter for OAuth flow"""
    return f"user-{user_id}"

def decode_state_param(state):
    """Decode user ID from state parameter"""
    if state and state.startswith("user-"):
        return state[5:]
    return None

def get_credentials_from_code(code, state, redirect_uri):
    try:
        user_id = decode_state_param(state)
        if not user_id:
            raise ValueError("Invalid state parameter")
        if isinstance(client_secrets, dict):
            flow = Flow.from_client_config(client_secrets, scopes=YOUTUBE_SCOPES, redirect_uri=redirect_uri)
        else:
            flow = Flow.from_client_secrets_file(client_secrets_file, scopes=YOUTUBE_SCOPES, redirect_uri=redirect_uri)
        flow.fetch_token(code=code)
        credentials = flow.credentials
        credentials_path = get_credentials_path(user_id)
        with open(credentials_path, 'w') as f:
            f.write(credentials.to_json())
        return credentials
    except Exception as e:
        logger.error(f"Error exchanging code for credentials: {e}")
        raise

def get_authenticated_service(user_id):
    """Get authenticated YouTube API service"""
    try:
        # Check if user is authenticated
        if not check_auth_status(user_id):
            return None

        # Load credentials from file
        credentials_path = get_credentials_path(user_id)
        with open(credentials_path, 'r') as f:
            credentials_data = json.load(f)

        credentials = Credentials.from_authorized_user_info(credentials_data)

        # Create YouTube API service
        return build('youtube', 'v3', credentials=credentials)
    except Exception as e:
        logger.error(f"Error creating YouTube service: {e}")
        return None

def load_credentials(user_id):
    """Load credentials for a given user ID."""
    user_creds = db.youtube_credentials.find_one({'user_id': user_id})
    if user_creds and 'credentials' in user_creds:
        creds_dict = json.loads(user_creds['credentials'])
        # Add client_id and client_secret if missing and available
        if not creds_dict.get('client_id') or not creds_dict.get('client_secret'):
            if isinstance(client_secrets_data, dict):
                secrets_key = 'web' if 'web' in client_secrets_data else 'installed'
                creds_dict['client_id'] = client_secrets_data[secrets_key]['client_id']
                creds_dict['client_secret'] = client_secrets_data[secrets_key]['client_secret']
            elif flow_kwargs.get('client_secrets_file'):
                 # Reload from file if necessary (less ideal)
                 try:
                     with open(flow_kwargs['client_secrets_file'], 'r') as f:
                         secrets_from_file = json.load(f)
                         secrets_key = 'web' if 'web' in secrets_from_file else 'installed'
                         creds_dict['client_id'] = secrets_from_file[secrets_key]['client_id']
                         creds_dict['client_secret'] = secrets_from_file[secrets_key]['client_secret']
                 except Exception as e:
                     logger.error(f"Could not reload client secrets from file to supplement credentials: {e}")

        credentials = Credentials.from_authorized_user_info(creds_dict, YOUTUBE_SCOPES)

        # Check if credentials need refreshing
        if credentials and credentials.expired and credentials.refresh_token:
            logger.info(f"Refreshing YouTube token for user {user_id}")
            try:
                credentials.refresh(Request())
                save_credentials(user_id, credentials) # Save the refreshed credentials
                logger.info(f"Successfully refreshed YouTube token for user {user_id}")
            except Exception as e:
                logger.error(f"Error refreshing YouTube token for user {user_id}: {e}")
                # Optionally delete invalid credentials here
                # delete_credentials(user_id)
                return None # Indicate refresh failure
        return credentials
    return None

def save_credentials(user_id):
    """Save credentials for a given user ID."""
    creds_json = credentials.to_json()
    db.youtube_credentials.update_one(
        {'user_id': user_id},
        {'$set': {
            'credentials': creds_json,
            'updated_at': datetime.now(timezone.utc) # Use timezone aware datetime
        }},
        upsert=True
    )
