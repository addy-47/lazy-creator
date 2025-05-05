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
from bson.objectid import ObjectId  # Add this import for MongoDB ObjectId

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
    if client_secrets_env and client_secrets_env.strip().startswith('{'):
        logger.info("Using YOUTUBE_CLIENT_SECRETS from environment variable")
        try:
            secrets_dict = json.loads(client_secrets_env)
            # Validate the structure minimally (check for 'web' or 'installed' key)
            if 'web' in secrets_dict or 'installed' in secrets_dict:
                 return secrets_dict  # Return the dictionary directly
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


def setup_routes(app, db, users_collection, token_required, skip_routes=None):
    """Set up all YouTube auth related routes"""

    # Make users_collection accessible to helper functions within this scope
    # This is a simplification; a better approach might involve Flask blueprints or app context
    global _users_collection
    _users_collection = users_collection
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

                # Check if credentials exist using the database
                is_authenticated = check_auth_status(user_id, _users_collection)

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
                # get_auth_url uses global client_secrets_data, no need to pass db/collection
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

                # Exchange code for credentials and save to DB
                try:
                    get_credentials_from_code(code, state, redirect_uri, _users_collection)
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

                # Get YouTube service using DB credentials
                youtube = get_authenticated_service(user_id, _users_collection)

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

# Helper functions for YouTube authentication using Database

def save_credentials(user_id, credentials, users_collection):
    """Save credentials for a given user ID to the database."""
    try:
        creds_json = credentials.to_json()
        users_collection.update_one(
            {'_id': ObjectId(user_id)}, # Assuming user_id is the string representation of ObjectId
            {'$set': {
                'youtube_credentials': creds_json,
                'youtube_credentials_updated_at': datetime.now(timezone.utc)
            }}
            # Consider upsert=False if you only want to update existing users
        )
        logger.info(f"Saved/Updated YouTube credentials in DB for user {user_id}")
    except Exception as e:
        logger.error(f"Error saving YouTube credentials to DB for user {user_id}: {e}")

def load_credentials(user_id, users_collection):
    """Load credentials for a given user ID from the database."""
    try:
        user_data = users_collection.find_one({'_id': ObjectId(user_id)})
        if user_data and 'youtube_credentials' in user_data:
            creds_dict = json.loads(user_data['youtube_credentials'])

            # Add client_id and client_secret if missing and available
            # This is crucial for the refresh mechanism
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
                else:
                    logger.error(f"Cannot supplement credentials with client_id/secret for user {user_id} - missing client_secrets_data.")
                    # Cannot refresh without client_id/secret

            credentials = Credentials.from_authorized_user_info(creds_dict, YOUTUBE_SCOPES)

            # Check if credentials need refreshing
            if credentials and credentials.expired and credentials.refresh_token:
                logger.info(f"Refreshing YouTube token for user {user_id}")
                try:
                    credentials.refresh(Request())
                    save_credentials(user_id, credentials, users_collection) # Save the refreshed credentials
                    logger.info(f"Successfully refreshed YouTube token for user {user_id}")
                except Exception as e:
                    logger.error(f"Error refreshing YouTube token for user {user_id}: {e}")
                    # Optionally delete invalid credentials here
                    # delete_credentials(user_id, users_collection)
                    return None # Indicate refresh failure
            elif not credentials or not credentials.valid:
                 logger.warning(f"Loaded credentials for user {user_id} are invalid or expired and cannot be refreshed.")
                 # Optionally delete invalid credentials
                 # delete_credentials(user_id, users_collection)
                 return None

            # Check scopes after loading/refreshing
            if set(credentials.scopes) != set(YOUTUBE_SCOPES):
                logger.warning(f"Scope mismatch for user {user_id}. Required: {YOUTUBE_SCOPES}, Found: {credentials.scopes}. Clearing credentials.")
                delete_credentials(user_id, users_collection)
                return None

            return credentials
        else:
            logger.info(f"No YouTube credentials found in DB for user {user_id}")
            return None
    except Exception as e:
        logger.error(f"Error loading YouTube credentials from DB for user {user_id}: {e}")
        return None

def delete_credentials(user_id, users_collection):
    """Delete stored credentials for a user from the database."""
    try:
        users_collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$unset': {
                'youtube_credentials': "",
                'youtube_credentials_updated_at': ""
            }}
        )
        logger.info(f"Cleared YouTube credentials from DB for user {user_id}")
        return True
    except Exception as e:
        logger.error(f"Error clearing YouTube credentials from DB for user {user_id}: {e}")
        return False

def check_auth_status(user_id, users_collection):
    """Check if the user has valid YouTube credentials in the database."""
    credentials = load_credentials(user_id, users_collection)
    return credentials is not None and credentials.valid

def get_auth_url(user_id, redirect_uri):
    try:
        # Use the globally loaded client_secrets_data
        if isinstance(client_secrets_data, dict):
            flow = Flow.from_client_config(client_secrets_data, scopes=YOUTUBE_SCOPES, redirect_uri=redirect_uri)
        elif isinstance(client_secrets_data, str) and os.path.exists(client_secrets_data):
            flow = Flow.from_client_secrets_file(client_secrets_data, scopes=YOUTUBE_SCOPES, redirect_uri=redirect_uri)
        else:
            logger.error("Cannot generate auth URL: YouTube client secrets are not configured correctly.")
            raise ValueError("YouTube client secrets configuration error.")
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

def get_credentials_from_code(code, state, redirect_uri, users_collection):
    """Exchange authorization code for credentials and save them to the database."""
    try:
        user_id = decode_state_param(state)
        if not user_id:
            raise ValueError("Invalid state parameter")

        # Use the globally initialized flow_kwargs
        current_flow_kwargs = flow_kwargs.copy()
        current_flow_kwargs['redirect_uri'] = redirect_uri

        if 'client_config' in current_flow_kwargs:
            flow = Flow.from_client_config(**current_flow_kwargs)
        elif 'client_secrets_file' in current_flow_kwargs:
            flow = Flow.from_client_secrets_file(**current_flow_kwargs)
        else:
             logger.error("Cannot exchange code: YouTube client secrets are not configured correctly.")
             raise ValueError("YouTube client secrets configuration error.")

        flow.fetch_token(code=code)
        credentials = flow.credentials

        # Save credentials to database
        save_credentials(user_id, credentials, users_collection)

        return credentials
    except Exception as e:
        logger.error(f"Error exchanging code for credentials: {e}")
        raise

def get_authenticated_service(user_id, users_collection):
    """Get authenticated YouTube API service using credentials from the database."""
    try:
        credentials = load_credentials(user_id, users_collection)

        if not credentials:
            logger.warning(f"Could not get authenticated service for user {user_id}: No valid credentials found.")
            return None

        # Create YouTube API service
        return build('youtube', 'v3', credentials=credentials)
    except Exception as e:
        logger.error(f"Error creating YouTube service: {e}")
        return None

# --- Removed old load_credentials and save_credentials that used 'db' directly ---
