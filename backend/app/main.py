import os
import logging
from datetime import datetime
import re
import tempfile
import threading
import atexit
import signal
import sys
import base64
import json
import googleapiclient.http

from flask import Flask, request, jsonify, send_file, redirect, make_response
from werkzeug.utils import secure_filename
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from functools import wraps
import requests
from flask_socketio import SocketIO, emit

from automation.shorts_main import generate_youtube_short
from automation.youtube_upload import upload_video
import youtube_auth
from youtube_auth import get_authenticated_service, check_auth_status, get_auth_url, get_credentials_from_code
from storage import cloud_storage
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(name)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# Configure CORS with explicit settings
CORS(app,
     resources={r"/api/*": {"origins": "*"}},
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization", "x-access-token", "X-Requested-With"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"])

# Update to include specific origins
CORS(app,
     resources={r"/api/*": {"origins": ["http://localhost:3500", "https://lazy-creator.web.app"]}},
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization", "x-access-token", "X-Requested-With"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
     expose_headers=["Content-Type", "Authorization"],
     max_age=600)

# Initialize Flask-SocketIO with gevent
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='gevent')

# Secret key configuration
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key')
app.config['TOKEN_EXPIRATION'] = 60 * 60 * 24 * 7  # 7 days

# MongoDB Configuration
mongo_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/youtube_shorts_db')
client = MongoClient(mongo_uri)
db = client.get_database()
users_collection = db.users
videos_collection = db.videos

# Track all video generation threads to allow graceful shutdown
active_threads = []
shutdown_flag = threading.Event()

# Signal handler for graceful shutdown
def handle_shutdown_signal(signum, frame):
    print(f"Received shutdown signal {signum}, shutting down gracefully...")
    shutdown_flag.set()
    # Give threads time to clean up
    for thread in active_threads:
        if thread.is_alive():
            thread.join(timeout=5.0)
    sys.exit(0)

# Register signal handlers
signal.signal(signal.SIGINT, handle_shutdown_signal)
signal.signal(signal.SIGTERM, handle_shutdown_signal)

# Register cleanup on normal exit
def cleanup_on_exit():
    shutdown_flag.set()
    print("Performing cleanup on exit...")

atexit.register(cleanup_on_exit)

# Health check endpoint for socket.io availability check
@app.route('/api/health', methods=['GET', 'HEAD', 'OPTIONS'])
def health_check():
    # Log that the health check was accessed for debugging
    logger.info("Health check endpoint accessed")

    # Handle OPTIONS request for CORS preflight
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-access-token')
        response.headers.add('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS')
        return response

    # For GET/HEAD requests
    response = jsonify({"status": "ok"})
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response, 200

# Helper to encode state parameter for OAuth (simple base64 encoding for user_id)
def encode_state_param(user_id):
    if not isinstance(user_id, str):
        user_id = str(user_id)
    return base64.urlsafe_b64encode(user_id.encode()).decode()

# Helper to decode state parameter from OAuth
def decode_state_param(state):
    try:
        # First check if it has our prefix
        if state.startswith("user-"):
            return state[5:]

        # Otherwise try base64 decoding
        decoded = base64.urlsafe_b64decode(state).decode()
        return decoded
    except Exception as e:
        logger.error(f"Error decoding state parameter: {e}")
        raise

# Socket.IO events
@socketio.on('connect')
def handle_connect():
    print('Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

@socketio.on('subscribe_progress')
def handle_subscribe_progress(data):
    video_id = data.get('videoId')
    if video_id:
        print(f'Client subscribed to progress updates for video {video_id}')

@socketio.on('unsubscribe_progress')
def handle_unsubscribe_progress(data):
    video_id = data.get('videoId')
    if video_id:
        print(f'Client unsubscribed from progress updates for video {video_id}')

# Function to emit progress update to clients
def emit_progress_update(video_id, progress):
    socketio.emit(f'progress_{video_id}', {'progress': progress})

# Authentication Decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'x-access-token' in request.headers:
            token = request.headers['x-access-token']
        elif 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header[7:]

        if not token:
            logger.warning("Token is missing in request")
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            # Decode the token
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])

            # Find the user in the database
            current_user = users_collection.find_one({'email': data['email']})
            if not current_user:
                logger.warning(f"User not found for email: {data['email']}")
                return jsonify({'message': 'User not found!'}), 401

        except jwt.ExpiredSignatureError:
            logger.warning("Token has expired")
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            logger.warning("Invalid token")
            return jsonify({'message': 'Token is invalid!'}), 401
        except Exception as e:
            logger.error(f"Unexpected error during token validation: {str(e)}")
            return jsonify({'message': 'Token validation error!'}), 401

        return f(current_user, *args, **kwargs)
    return decorated

# User Registration
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()

    # Validate input
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Email and password are required!'}), 400

    # Check if user already exists
    if users_collection.find_one({'email': data['email']}):
        return jsonify({'message': 'User already exists!'}), 409

    # Create new user
    hashed_password = generate_password_hash(data['password'], method='sha256')
    user = {
        'email': data['email'],
        'password': hashed_password,
        'created_at': datetime.utcnow()
    }
    users_collection.insert_one(user)

    return jsonify({'message': 'User registered successfully!'}), 201

# User Login
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()

    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Email and password are required!'}), 400

    # Check if this is a social login
    is_social_login = data.get('password').startswith('FIREBASE_AUTH_') if data.get('password') else False

    user = users_collection.find_one({'email': data['email']})

    # Handle social login (Firebase)
    if is_social_login:
        if not user:
            # Create new user for social login
            try:
                user = {
                    'email': data['email'],
                    'password': generate_password_hash(data['password'], method='sha256'),
                    'name': data.get('name', 'User'),
                    'provider': data.get('provider', 'google'),
                    'provider_id': data.get('providerId', ''),
                    'created_at': datetime.utcnow()
                }
                result = users_collection.insert_one(user)
                user['_id'] = result.inserted_id
                logger.info(f"Created new user with social login: {data['email']}")
            except Exception as e:
                logger.error(f"Error creating user for social login: {e}")
                return jsonify({'message': 'Failed to create user account!'}), 500
        else:
            # Update existing user for social login
            try:
                users_collection.update_one(
                    {'_id': user['_id']},
                    {'$set': {
                        'provider': data.get('provider', 'google'),
                        'provider_id': data.get('providerId', ''),
                        'last_login': datetime.utcnow()
                    }}
                )
                logger.info(f"Updated existing user with social login: {data['email']}")
            except Exception as e:
                logger.error(f"Error updating user for social login: {e}")
                # Continue anyway since we have the user

        # Generate token for social login
        token = jwt.encode({
            'email': user['email'],
            'exp': datetime.utcnow().timestamp() + app.config['TOKEN_EXPIRATION']
        }, app.config['SECRET_KEY'])

        return jsonify({
            'token': token,
            'email': user['email'],
            'user': {
                'name': user.get('name', 'User')
            }
        }), 200

    # Regular password login
    if not user:
        return jsonify({'message': 'User not found!'}), 404

    if check_password_hash(user['password'], data['password']):
        token = jwt.encode({
            'email': user['email'],
            'exp': datetime.utcnow().timestamp() + app.config['TOKEN_EXPIRATION']
        }, app.config['SECRET_KEY'])

        return jsonify({
            'token': token,
            'email': user['email'],
            'user': {
                'name': user.get('name', 'User')
            }
        }), 200

    return jsonify({'message': 'Invalid credentials!'}), 401

# Progress tracking helper - ensure progress never decreases
def safe_update_progress(video_id, new_progress, status=None):
    """
    Update the progress of a video generation, ensuring it never decreases.

    Args:
        video_id: The ID of the video to update
        new_progress: The new progress value (0-100)
        status: Optional status update
    """
    try:
        # Get current progress
        video = videos_collection.find_one({'_id': ObjectId(video_id)})

        if not video:
            logger.warning(f"Cannot update progress for video {video_id}: not found")
            return False

        current_progress = video.get('progress', 0)

        # Ensure progress never decreases
        if new_progress < current_progress:
            logger.warning(f"Attempted to decrease progress from {current_progress} to {new_progress} for video {video_id}, keeping higher value")
            new_progress = current_progress

        # Update fields
        update_fields = {'progress': new_progress}
        if status:
            update_fields['status'] = status

        # Update database
        videos_collection.update_one(
            {'_id': ObjectId(video_id)},
            {'$set': update_fields}
        )

        # Emit progress update via Socket.IO
        emit_progress_update(video_id, new_progress)

        return True
    except Exception as e:
        logger.error(f"Error in safe_update_progress: {e}")
        return False

# Generate YouTube Short
@app.route('/api/generate-short', methods=['POST'])
@token_required
def generate_short(current_user):
    try:
        # Extract form data
        prompt = request.form.get('prompt', 'latest AI news')
        duration = int(request.form.get('duration', 25))
        background_type = request.form.get('background_type', 'video')
        background_source = request.form.get('background_source', 'provided')
        background_file = request.files.get('background_file')

        # Always initialize background_path to None
        background_path = None

        # Validate inputs
        if background_source == 'custom' and not background_file:
            return jsonify({"status": "error", "message": "Background file is required for custom source"}), 400

        # Get user ID for proper storage attribution
        user_id = str(current_user['_id'])

        # Handle file upload for custom background
        if background_file:
            filename = secure_filename(background_file.filename)
            # Pass user_id to save_uploaded_file for proper association
            background_path = cloud_storage.save_uploaded_file(
                background_file,
                filename,
                user_id=user_id
            )

        # Create a video entry with 'processing' status and link to user account
        video_data = {
            'original_prompt': prompt,
            'duration': duration,
            'background_type': background_type,
            'background_source': background_source,
            'background_path': background_path,  # Store the background path in the database
            'created_at': datetime.utcnow(),
            'status': 'processing',
            'progress': 0,
            'uploaded_to_yt': False,
            'youtube_id': None,
            'user_id': user_id
        }

        # Insert into database and get ID
        video_id = videos_collection.insert_one(video_data).inserted_id

        # Return immediate response with video ID
        response = {
            "status": "processing",
            "message": "Video generation started",
            "video_id": str(video_id)
        }

        # Start background processing
        def process_video():
            try:
                # Make background_path accessible in this function
                nonlocal background_path

                logger.info(f"Started video generation for user {user_id}, video {video_id}")

                # Update database status to processing
                videos_collection.update_one(
                    {'_id': ObjectId(video_id)},
                    {'$set': {
                        'status': 'processing',
                        'progress': 10
                    }}
                )

                # Create a temporary directory for processing
                with tempfile.TemporaryDirectory() as temp_dir:
                    # Process background path if it exists
                    processed_background_path = background_path

                    # If background is a GCS path, use it directly with signed URL
                    if processed_background_path and isinstance(processed_background_path, str) and processed_background_path.startswith('gs://'):
                        try:
                            # Parse the gs:// URL to get bucket and blob names
                            parts = processed_background_path.replace('gs://', '').split('/', 1)
                            if len(parts) == 2:
                                bucket_name, blob_name = parts
                                # Get a signed URL for streaming
                                processed_background_path = cloud_storage.get_signed_url(blob_name, bucket_name, expiration=3600)
                                logger.info(f"Using streaming URL for background video")
                        except Exception as bg_error:
                            logger.error(f"Error getting signed URL for background: {bg_error}")
                            # Continue without the background, the generation code will use a default
                            processed_background_path = None

                    # Ensure background_path is defined before passing it to generate_youtube_short
                    processed_background_source = background_source
                    if processed_background_source == "custom" and not processed_background_path:
                        logger.warning("Custom background source specified but no background path provided")
                        processed_background_source = "provided"  # Fallback to provided background

                    # Call the generation function
                    logger.info(f"Generating YouTube short for prompt: '{prompt}'")
                    logger.info(f"Using background_path: {processed_background_path}, background_source: {processed_background_source}, background_type: {background_type}")

                    try:
                        # Update progress to 30% after script generation
                        safe_update_progress(video_id, 30)

                        # Create a progress callback function
                        def progress_callback(progress):
                            # Map the 0-100 progress from generate_youtube_short to 30-80 range
                            mapped_progress = int(30 + (progress * 0.5))  # 0->30, 100->80
                            safe_update_progress(video_id, mapped_progress)

                        # Generate the video with progress tracking
                        video_result = generate_youtube_short(
                            topic=prompt,
                            max_duration=duration,
                            background_type=background_type,
                            background_source=processed_background_source,
                            background_path=processed_background_path,
                            progress_callback=progress_callback
                        )

                        # Unpack the result (video path and content package)
                        video_path, comprehensive_content = video_result

                        # Update progress to 80% after video generation
                        safe_update_progress(video_id, 80, 'uploading')

                        # Get comprehensive content from the generation function if it's available
                        # This should be added to the shorts_main.py function to return both the video path
                        # and the comprehensive content

                        # Check if video was generated successfully
                        if not video_path or not os.path.exists(video_path):
                            raise FileNotFoundError(f"Generated video file not found at {video_path}")

                        # Create a unique filename
                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                        safe_prompt = re.sub(r'[^\w\s-]', '', prompt.lower()).strip().replace(' ', '_')[:50]
                        filename = f"{safe_prompt}_{timestamp}.mp4"

                        # Set path in GCS to include user ID for better organization
                        blob_name = f"users/{user_id}/{filename}"  # Use 'users/' prefix for better organization

                        # Update progress to 80% before upload
                        safe_update_progress(video_id, 80, 'uploading')

                        # Upload to Cloud Storage with user_id metadata
                        gcs_path = cloud_storage.upload_file(
                            video_path,
                            blob_name,
                            bucket_name=cloud_storage.media_bucket,  # Explicitly use media bucket
                            user_id=user_id,
                            metadata={
                                'prompt': prompt,
                                'duration': str(duration),
                                'video_id': str(video_id)
                            }
                        )

                        # For local storage, format as gs:// path for consistency
                        if cloud_storage.use_local_storage and not gcs_path.startswith('gs://'):
                            gcs_path = f"gs://{cloud_storage.media_bucket}/{blob_name}"

                        # Try to extract and store comprehensive content from the video generation process
                        try:
                            # If we have comprehensive_content from the video generation
                            if comprehensive_content:
                                # Ensure script is included in comprehensive_content
                                if 'script' in comprehensive_content:
                                    # Log script info
                                    script = comprehensive_content['script']
                                    logger.info(f"Using actual script with {len(script.split())} words for video {video_id}")

                                logger.info(f"Storing actual comprehensive content for video {video_id}")

                                # Update the database with the actual comprehensive content used
                                videos_collection.update_one(
                                    {'_id': ObjectId(video_id)},
                                    {'$set': {
                                        'comprehensive_content': comprehensive_content
                                    }}
                                )
                            else:
                                logger.warning(f"No comprehensive content returned for video {video_id}, generating new content")

                                # Import here to avoid circular imports
                                from automation.script_generator import generate_comprehensive_content

                                # Generate fallback comprehensive content
                                fallback_content = generate_comprehensive_content(
                                    topic=prompt,
                                    max_duration=duration
                                )

                                videos_collection.update_one(
                                    {'_id': ObjectId(video_id)},
                                    {'$set': {
                                        'comprehensive_content': fallback_content
                                    }}
                                )
                        except Exception as content_error:
                            logger.error(f"Error storing comprehensive content for video {video_id}: {content_error}")
                            # Continue without comprehensive content - it's optional

                        # Update the database with completed status and file info using safe progress update
                        safe_update_progress(video_id, 100, 'completed')
                        videos_collection.update_one(
                            {'_id': ObjectId(video_id)},
                            {'$set': {
                                'filename': filename,
                                'path': gcs_path,
                                'user_id': user_id,
                                'completed_at': datetime.utcnow()
                            }}
                        )

                        logger.info(f"Video generation completed for user {user_id}, video {video_id}")

                        # Notify frontend that generation is complete
                        try:
                            # Create a copy of request values for use outside request context
                            req_origin = request.headers.get('Origin', 'http://localhost:3500')

                            # Define function for app context
                            def send_notification():
                                try:
                                    callback_url = f"{req_origin}/api/generation-complete-callback/{video_id}"
                                    requests.post(callback_url, json={
                                        'status': 'success',
                                        'video_id': str(video_id),
                                        'filename': filename,
                                        'path': gcs_path
                                    }, timeout=5)
                                    logger.info(f"Successfully notified frontend of completion: {callback_url}")
                                except Exception as cb_error:
                                    logger.error(f"Failed to notify frontend of completion in app context: {cb_error}")

                            # Run in a separate thread to avoid blocking
                            notification_thread = threading.Thread(target=send_notification)
                            notification_thread.daemon = True
                            notification_thread.start()

                        except Exception as callback_error:
                            logger.error(f"Failed to setup frontend notification: {callback_error}")
                    except Exception as gen_error:
                        logger.error(f"Error in video generation for video {video_id}: {gen_error}")
                        # Update database with error status
                        safe_update_progress(video_id, 0, 'error')
                        videos_collection.update_one(
                            {'_id': ObjectId(video_id)},
                            {'$set': {
                                'status': 'error',
                                'error_message': str(gen_error)
                            }}
                        )

            except Exception as e:
                logger.error(f"Error in background processing for video {video_id}: {e}")
                safe_update_progress(video_id, 0, 'error')
                videos_collection.update_one(
                    {'_id': ObjectId(video_id)},
                    {'$set': {
                        'status': 'error',
                        'error_message': str(e)
                    }}
                )

        # Start the background thread and return immediately
        thread = threading.Thread(target=process_video)
        thread.daemon = True

        # Register thread for tracking
        active_threads.append(thread)

        # Remove completed threads from tracking list
        active_threads[:] = [t for t in active_threads if t.is_alive()]

        thread.start()

        return jsonify(response), 202

    except Exception as e:
        logger.error(f"Error in generate-short endpoint: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# Check video status
@app.route('/api/video-status/<video_id>', methods=['GET'])
@token_required
def check_video_status(current_user, video_id):
    try:
        # Find the video
        video = videos_collection.find_one({
            '_id': ObjectId(video_id),
            'user_id': str(current_user['_id'])  # Ensure video belongs to current user
        })

        if not video:
            return jsonify({"status": "error", "message": "Video not found"}), 404

        # Prepare response based on video status
        status_data = {
            "status": video.get('status', 'unknown'),
            "progress": video.get('progress', 0)
        }

        # If video is completed, include the video details
        if video.get('status') == 'completed':
            status_data["video"] = {
                "id": str(video['_id']),
                "filename": video.get('filename'),
                "path": video.get('path'),
                "created_at": video.get('created_at').strftime('%Y-%m-%d %H:%M:%S')
            }

        return jsonify(status_data)

    except Exception as e:
        logger.error(f"Error checking video status: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# Helper function to get normalized file path for a user's file
def get_normalized_file_path(user_id, filename):
    """
    Get the proper path for a user's file in GCS.
    Checks multiple possible locations and returns the correct path.

    Args:
        user_id: User ID
        filename: Filename to locate

    Returns:
        Tuple: (exists, path) - Whether the file exists and the full GCS path
    """
    try:
        # Construct the standard user path (new structure)
        standard_path = f"users/{user_id}/{filename}"

        # List of paths to check, in order of preference
        possible_paths = [
            standard_path,                   # Main user path (new structure)
            f"videos/{user_id}/{filename}",  # Old user path
            f"videos/{filename}"             # Legacy video path
        ]

        # Check if file exists in any of the paths
        for path in possible_paths:
            if cloud_storage.file_exists(path, cloud_storage.media_bucket):
                gcs_path = f"gs://{cloud_storage.media_bucket}/{path}"
                logger.info(f"Found file at path: {path}")
                return True, gcs_path

        # File not found in any location
        return False, None
    except Exception as e:
        logger.error(f"Error in get_normalized_file_path: {e}")
        return False, None

# Get Gallery (ensure to filter by user ID)
@app.route('/api/gallery', methods=['GET'])
@token_required
def get_gallery(current_user):
    try:
        # Get all completed videos for the current user
        videos = list(videos_collection.find({
            'status': 'completed',
            'user_id': str(current_user['_id'])  # Filter by user ID
        }).sort('created_at', -1))

        user_id = str(current_user['_id'])

        # Convert ObjectId to string for JSON serialization
        for video in videos:
            video['id'] = str(video['_id'])
            video.pop('_id', None)

            # Include generated title in the frontend for display in gallery
            if 'comprehensive_content' in video and 'title' in video['comprehensive_content']:
                video['display_title'] = video['comprehensive_content']['title']
            else:
                video['display_title'] = video.get('original_prompt', 'Untitled Video')

            # Ensure path is correct
            if 'filename' in video:
                exists, normalized_path = get_normalized_file_path(user_id, video['filename'])

                if exists and normalized_path:
                    # Update path if different from what's stored
                    if video.get('path') != normalized_path:
                        video['path'] = normalized_path

                        # Also update the database
                        videos_collection.update_one(
                            {'_id': ObjectId(video['id'])},
                            {'$set': {'path': normalized_path}}
                        )
                        logger.info(f"Updated video path for {video['id']} to: {normalized_path}")
                else:
                    # If we can't find the file in any location
                    logger.warning(f"Video file not found for {video['id']} in any expected location")

        return jsonify({
            'status': 'success',
            'videos': videos
        })
    except Exception as e:
        logger.error(f"Error fetching gallery: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# Download Video
@app.route('/api/download/<video_id>', methods=['GET'])
@token_required
def download_video(current_user, video_id):
    try:
        video = videos_collection.find_one({
            '_id': ObjectId(video_id),
            'user_id': str(current_user['_id'])
        })

        if not video or video.get('status') != 'completed':
            return jsonify({"status": "error", "message": "File not found"}), 404

        # Create a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_file:
            # Download from Cloud Storage
            gcs_path = video.get('path')
            if not gcs_path or not gcs_path.startswith('gs://'):
                return jsonify({"status": "error", "message": "Invalid file path"}), 404

            # Extract bucket and blob name from gs:// path
            _, bucket_name, blob_name = gcs_path.split('/', 2)
            cloud_storage.download_file(blob_name, temp_file.name, bucket_name)

            return send_file(temp_file.name, as_attachment=True)

    except Exception as e:
        logger.error(f"Error downloading video: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# Check YouTube authorization status
@app.route('/api/youtube/auth-status', methods=['GET'])
@token_required
def check_youtube_auth_status(current_user):
    try:
        user_id = str(current_user['_id'])
        logger.info(f"Checking YouTube auth status for user {user_id}")

        # Check if credentials exist
        is_authenticated = check_auth_status(user_id)

        # Get user channels if authenticated
        channels = []
        if is_authenticated:
            youtube = get_authenticated_service(user_id)

            if youtube:
                try:
                    # Fetch the user's channels
                    channels_response = youtube.channels().list(
                        part="snippet,contentDetails,statistics",
                        mine=True,
                        maxResults=50
                    ).execute()

                    for channel in channels_response.get('items', []):
                        channel_info = {
                            "id": channel['id'],
                            "title": channel['snippet']['title'],
                            "description": channel['snippet'].get('description', ''),
                            "customUrl": channel['snippet'].get('customUrl', '')
                        }

                        # Get thumbnail if available
                        thumbnails = channel['snippet'].get('thumbnails', {})
                        if thumbnails and 'default' in thumbnails:
                            channel_info['thumbnailUrl'] = thumbnails['default']['url']

                        channels.append(channel_info)
                except Exception as e:
                    logger.error(f"Error fetching channels: {e}")
                    # Return authenticated but with empty channels

        response = {
            "status": "success",
            "authenticated": is_authenticated,
            "channels": channels
        }

        # If not authenticated, include auth URL
        if not is_authenticated:
            frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3500')
            redirect_uri = f"{frontend_url}/youtube-auth-success"

            # Generate auth URL
            auth_url = get_auth_url(user_id, redirect_uri)
            state = encode_state_param(user_id)

            response.update({
                "auth_url": auth_url,
                "state": state,
                "redirect_uri": redirect_uri
            })

        return jsonify(response)

    except Exception as e:
        logger.error(f"Error checking YouTube auth status: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

# Start YouTube Auth Flow (new route with consistent path)
@app.route('/api/youtube/auth/start', methods=['GET'])
@token_required
def start_youtube_auth_new(current_user):
    try:
        user_id = str(current_user['_id'])
        user_email = current_user.get('email', 'Unknown')
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

# YouTube Auth Callback with consistent path
@app.route('/api/youtube/auth/callback', methods=['GET'])
def youtube_auth_callback_new():
    try:
        code = request.args.get('code')
        state = request.args.get('state')
        redirect_uri = request.args.get('redirect_uri')

        logger.info(f"YouTube Auth Callback received - code present: {bool(code)}, state: {state}, redirect_uri: {redirect_uri}")

        if not code or not state:
            error_msg = "Missing code or state parameter"
            logger.error(f"Auth callback error: {error_msg}")

            # Get the frontend URL from environment
            frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3500')

            # If no redirect_uri is provided, use default
            if not redirect_uri:
                redirect_uri = f"{frontend_url}/youtube-auth-success"

            return redirect(f"{redirect_uri}?error=auth_failed&message={error_msg}")

        # Get the frontend URL from environment
        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3500')

        # Use the provided redirect_uri or default to the environment one
        if not redirect_uri:
            redirect_uri = f"{frontend_url}/youtube-auth-success"

        logger.info(f"YouTube Auth Callback - state: {state}, redirect URI: {redirect_uri}")

        # Extract user ID from state
        user_id = None
        try:
            # Try decoding with our function first
            user_id = decode_state_param(state)
            logger.info(f"Decoded user_id from state: {user_id}")
        except Exception as decode_error:
            logger.error(f"Error decoding state parameter: {decode_error}")

            # Fallback: check if state has our prefix format
            if state.startswith("user-"):
                user_id = state[5:]
                logger.info(f"Extracted user_id from state prefix: {user_id}")
            else:
                logger.error(f"Invalid state format: {state}")
                return redirect(f"{redirect_uri}?error=auth_failed&message=Invalid state parameter")

        if not user_id:
            logger.error("Could not extract user ID from state parameter")
            return redirect(f"{redirect_uri}?error=auth_failed&message=Invalid state parameter")

        # Exchange code for credentials
        try:
            logger.info(f"Exchanging code for credentials - user: {user_id}, redirect: {redirect_uri}")
            credentials = get_credentials_from_code(code, state, redirect_uri)
            logger.info(f"Successfully exchanged code for credentials for user: {user_id}")

            # Find the user and get their JWT token
            user = users_collection.find_one({'_id': ObjectId(user_id)})
            if not user:
                logger.error(f"User not found for ID: {user_id}")
                return redirect(f"{redirect_uri}?error=auth_failed&message=User not found")

            # Generate a JWT token for the user
            token = jwt.encode({
                'email': user['email'],
                'exp': datetime.utcnow().timestamp() + app.config['TOKEN_EXPIRATION']
            }, app.config['SECRET_KEY'])

            logger.info(f"Generated token for user {user_id} after successful YouTube auth")

            # Redirect to frontend with token
            return jsonify({
                "status": "success",
                "message": "Successfully authenticated with YouTube",
                "token": token
            })

        except Exception as credential_error:
            logger.error(f"Error exchanging code for credentials: {credential_error}")
            return redirect(f"{redirect_uri}?error=auth_failed&message={str(credential_error)}")

    except Exception as e:
        logger.error(f"Error in YouTube auth callback: {e}")
        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3500')
        redirect_uri = request.args.get('redirect_uri') or f"{frontend_url}/youtube-auth-success"
        return redirect(f"{redirect_uri}?error=auth_failed&message={str(e)}")

# Get user's YouTube channels
@app.route('/api/youtube/channels', methods=['GET'])
@token_required
def get_youtube_channels(current_user):
    try:
        user_id = str(current_user['_id'])
        youtube = get_authenticated_service(user_id)

        if not youtube:
            return jsonify({
                "status": "error",
                "message": "YouTube authentication required",
                "require_auth": True
            }), 401

        # Fetch the user's channels
        channels_response = youtube.channels().list(
            part="snippet,contentDetails,statistics",
            mine=True,
            maxResults=50
        ).execute()

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

# Upload a specific video to YouTube
@app.route('/api/youtube/upload/<video_id>', methods=['POST'])
@token_required
def upload_video_to_youtube(current_user, video_id):
    try:
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "message": "No metadata provided"}), 400

        # Validate required fields
        required_fields = ['title', 'description', 'privacyStatus']
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            return jsonify({
                "status": "error",
                "message": f"Missing required fields: {', '.join(missing_fields)}"
            }), 400

        # Find the video
        video = videos_collection.find_one({'_id': ObjectId(video_id)})
        if not video:
            return jsonify({"status": "error", "message": "Video not found"}), 404

        # Check if the video belongs to the current user
        if video.get('user_id') != str(current_user['_id']):
            return jsonify({"status": "error", "message": "You do not have permission to upload this video"}), 403

        # Get the video path
        video_path = video.get('path')
        if not video_path:
            return jsonify({"status": "error", "message": "Video has no file path"}), 400

        # Get authenticated YouTube service
        user_id = str(current_user['_id'])
        youtube = get_authenticated_service(user_id)

        if not youtube:
            return jsonify({
                "status": "error",
                "message": "YouTube authentication required",
                "require_auth": True
            }), 401

        # Download the video to a temporary file
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_file:
                local_path = temp_file.name

            # If the path is a GCS path
            if video_path.startswith('gs://'):
                _, bucket, blob_name = video_path.split('/', 2)
                logger.info(f"Downloading video from GCS: gs://{bucket}/{blob_name}")

                # Download from GCS
                cloud_storage.download_file(blob_name, local_path, bucket)

                if not os.path.exists(local_path) or os.path.getsize(local_path) == 0:
                    return jsonify({"status": "error", "message": "Failed to download video from Cloud Storage"}), 500

                logger.info(f"Successfully downloaded video: {os.path.getsize(local_path)} bytes")
            else:
                # Local file
                local_path = video_path
                if not os.path.exists(local_path):
                    return jsonify({"status": "error", "message": "Video file not found"}), 404

            # Get video metadata
            title = data.get('title', f"Video - {video.get('filename', '')}")
            description = data.get('description', "Uploaded via Lazy Creator")
            tags = data.get('tags', [])
            privacy_status = data.get('privacyStatus', 'private')
            channel_id = data.get('channelId')
            category_id = data.get('categoryId', '22')  # Default to "People & Blogs"

            # Prepare the upload
            body = {
                'snippet': {
                    'title': title,
                    'description': description,
                    'tags': tags,
                    'categoryId': category_id
                },
                'status': {
                    'privacyStatus': privacy_status,
                    'selfDeclaredMadeForKids': False
                }
            }

            # Upload the video
            logger.info(f"Starting YouTube upload for video {video_id}")

            # Insert the video
            request_upload = youtube.videos().insert(
                part=','.join(body.keys()),
                body=body,
                media_body=googleapiclient.http.MediaFileUpload(
                    local_path,
                    mimetype='video/mp4',
                    resumable=True
                )
            )

            # Execute the upload
            response = request_upload.execute()

            # Get the YouTube video ID
            youtube_id = response['id']

            # Update the video record in the database
            videos_collection.update_one(
                {'_id': ObjectId(video_id)},
                {'$set': {
                    'uploaded_to_yt': True,
                    'youtube_id': youtube_id,
                    'youtube_title': title,
                    'youtube_description': description,
                    'youtube_tags': tags,
                    'youtube_privacy': privacy_status,
                    'youtube_channel_id': channel_id,
                    'uploaded_at': datetime.utcnow()
                }}
            )

            # Return success
            return jsonify({
                "status": "success",
                "message": "Video uploaded successfully",
                "youtube_id": youtube_id,
                "watch_url": f"https://www.youtube.com/watch?v={youtube_id}"
            })

        finally:
            # Clean up the temporary file if it exists
            if 'local_path' in locals() and os.path.exists(local_path) and local_path.startswith(tempfile.gettempdir()):
                try:
                    os.unlink(local_path)
                    logger.info(f"Cleaned up temporary file: {local_path}")
                except Exception as e:
                    logger.warning(f"Failed to clean up temporary file: {e}")

    except Exception as e:
        logger.error(f"Error uploading to YouTube: {e}")
        # Check if it's an authentication error
        if "unauthorized" in str(e).lower() or "authentication" in str(e).lower():
            return jsonify({
                "status": "error",
                "message": "YouTube authentication expired. Please reconnect your YouTube account.",
                "require_auth": True
            }), 401
        return jsonify({"status": "error", "message": str(e)}), 500

# Delete Video
@app.route('/api/delete-video/<video_id>', methods=['DELETE'])
@token_required
def delete_video(current_user, video_id):
    try:
        video = videos_collection.find_one({
            '_id': ObjectId(video_id)
        })

        if not video:
            return jsonify({"status": "error", "message": "Video not found"}), 404

        # Delete from Cloud Storage if path exists
        gcs_path = video.get('path')
        if gcs_path and gcs_path.startswith('gs://'):
            _, bucket_name, blob_name = gcs_path.split('/', 2)
            try:
                cloud_storage.delete_file(blob_name, bucket_name)
            except Exception as e:
                logger.warning(f"Could not delete file from Cloud Storage: {e}")

        # Delete from database
        videos_collection.delete_one({'_id': ObjectId(video_id)})

        return jsonify({"status": "success", "message": "Video deleted successfully"})

    except Exception as e:
        logger.error(f"Error deleting video: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# Public endpoint that accepts token via query param
@app.route('/api/gallery/<filename>', methods=['GET'])
def serve_gallery_file_with_token(filename):
    try:
        # Get authentication token from query params or headers
        token = request.args.get('token') or request.headers.get('x-access-token')

        if not token:
            logger.warning(f"No token provided for file: {filename}")
            return jsonify({'message': 'A valid token is required!'}), 401

        # Validate token
        try:
            # Decode the token
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = users_collection.find_one({'email': data['email']})

            if not current_user:
                logger.warning(f"Invalid user for token when accessing file: {filename}")
                return jsonify({'message': 'User not found!'}), 401

            user_id = str(current_user['_id'])
        except Exception as token_error:
            logger.error(f"Token validation error for file {filename}: {token_error}")
            return jsonify({'message': 'Invalid token!'}), 401

        logger.info(f"Serving gallery file {filename} for user {user_id} (via token param)")

        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as temp_file:
            temp_path = temp_file.name

        # Use our utility function to find the file
        file_exists, gcs_path = get_normalized_file_path(user_id, filename)

        if not file_exists:
            # If the file contains path separators, try it as a direct path
            if '/' in filename:
                direct_path = filename
                if cloud_storage.file_exists(direct_path, cloud_storage.media_bucket):
                    gcs_path = f"gs://{cloud_storage.media_bucket}/{direct_path}"
                    file_exists = True
                    logger.info(f"Found file at direct path: {direct_path}")

        if not file_exists or not gcs_path:
            logger.error(f"File {filename} not found for user {user_id}")
            return jsonify({
                'status': 'error',
                'message': "File not found"
            }), 404

        # Extract bucket and blob name from gs:// path
        _, bucket_name, blob_name = gcs_path.split('/', 2)

        try:
            cloud_storage.download_file(blob_name, temp_path, bucket_name)
            logger.info(f"Successfully downloaded file from: {gcs_path}")
        except Exception as download_err:
            logger.error(f"Download error for file at {gcs_path}: {download_err}")
            return jsonify({
                'status': 'error',
                'message': f"Error downloading file: {download_err}"
            }), 500

        # Set correct content type based on file extension
        content_type = 'video/mp4'
        if filename.lower().endswith('.jpg') or filename.lower().endswith('.jpeg'):
            content_type = 'image/jpeg'
        elif filename.lower().endswith('.png'):
            content_type = 'image/png'
        elif filename.lower().endswith('.gif'):
            content_type = 'image/gif'

        return send_file(
            temp_path,
            as_attachment=False,  # Stream instead of downloading
            download_name=os.path.basename(filename),
            mimetype=content_type
        )
    except Exception as e:
        logger.error(f"Error serving gallery file: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# Add a new endpoint to notify frontend when video generation is complete
@app.route('/api/notify-generation-complete/<video_id>', methods=['POST'])
def notify_generation_complete(video_id):
    try:
        # Update the video status to mark it as complete
        video = videos_collection.find_one({'_id': ObjectId(video_id)})

        # If video doesn't exist or is already completed, return success
        if not video or video.get('status') == 'completed':
            return jsonify({
                'status': 'success',
                'message': 'Video already marked as complete'
            })

        # Update the status
        videos_collection.update_one(
            {'_id': ObjectId(video_id)},
            {'$set': {
                'status': 'completed',
                'progress': 100
            }}
        )

        # Return success
        return jsonify({
            'status': 'success',
            'message': 'Video marked as complete'
        })
    except Exception as e:
        logger.error(f"Error notifying generation complete: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# Add this new endpoint after an existing YouTube-related endpoint
@app.route('/api/youtube-trending-shorts', methods=['GET'])
@token_required
def get_youtube_trending_shorts(current_user):
    try:
        # Get authenticated YouTube client
        user_id = str(current_user['_id'])
        youtube = get_authenticated_service(user_id)

        if not youtube:
            return jsonify({
                "status": "error",
                "message": "YouTube authentication required",
                "require_auth": True
            }), 401

        # Fetch trending shorts from YouTube
        # Use videoCategoryId=26 for "Howto & Style" which often contains shorts
        trending_request = youtube.videos().list(
            part="snippet,statistics,contentDetails",
            chart="mostPopular",
            regionCode="US",
            maxResults=20,
            videoCategoryId="26"
        )
        trending_response = trending_request.execute()

        # Filter for shorts (vertical videos typically under 60 seconds)
        shorts = []
        for item in trending_response.get('items', []):
            # Parse duration to check if it's a short
            duration = item['contentDetails']['duration']
            # Convert ISO 8601 duration to seconds
            duration_seconds = parse_duration(duration)

            # Check if it's likely a short (vertical, short duration)
            if duration_seconds <= 60:
                video_id = item['id']
                snippet = item['snippet']
                statistics = item['statistics']

                shorts.append({
                    'id': video_id,
                    'title': snippet.get('title', ''),
                    'thumbnail': snippet.get('thumbnails', {}).get('high', {}).get('url', ''),
                    'channel': snippet.get('channelTitle', ''),
                    'views': statistics.get('viewCount', '0'),
                    'likes': statistics.get('likeCount', '0'),
                    'published_at': snippet.get('publishedAt', '')
                })

        # If we don't have enough shorts, try another category
        if len(shorts) < 10:
            # Try "Entertainment" category (id=24)
            entertainment_request = youtube.videos().list(
                part="snippet,statistics,contentDetails",
                chart="mostPopular",
                regionCode="US",
                maxResults=15,
                videoCategoryId="24"
            )
            entertainment_response = entertainment_request.execute()

            for item in entertainment_response.get('items', []):
                # Skip if we already have this video
                if any(short['id'] == item['id'] for short in shorts):
                    continue

                duration = item['contentDetails']['duration']
                duration_seconds = parse_duration(duration)

                if duration_seconds <= 60:
                    video_id = item['id']
                    snippet = item['snippet']
                    statistics = item['statistics']

                    shorts.append({
                        'id': video_id,
                        'title': snippet.get('title', ''),
                        'thumbnail': snippet.get('thumbnails', {}).get('high', {}).get('url', ''),
                        'channel': snippet.get('channelTitle', ''),
                        'views': statistics.get('viewCount', '0'),
                        'likes': statistics.get('likeCount', '0'),
                        'published_at': snippet.get('publishedAt', '')
                    })

                    # Break if we have enough shorts
                    if len(shorts) >= 20:
                        break

        return jsonify({
            "status": "success",
            "shorts": shorts
        })

    except Exception as e:
        logger.error(f"Error fetching trending shorts: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# Helper function to parse ISO 8601 duration to seconds
def parse_duration(duration_str):
    """Convert ISO 8601 duration string to seconds"""
    match = re.search(r'PT(\d+H)?(\d+M)?(\d+S)?', duration_str)
    if not match:
        return 0

    hours = match.group(1)
    minutes = match.group(2)
    seconds = match.group(3)

    hours = int(hours[:-1]) if hours else 0
    minutes = int(minutes[:-1]) if minutes else 0
    seconds = int(seconds[:-1]) if seconds else 0

    return hours * 3600 + minutes * 60 + seconds

# Set up our YouTube auth routes - add this just before the if __name__ == "__main__" line
skip_routes = ['youtube_auth_callback', 'youtube_auth_start', 'youtube_auth_status']
youtube_auth.setup_routes(app, db, users_collection, token_required, skip_routes=skip_routes)

# Add a global OPTIONS route handler
@app.route('/api/<path:path>', methods=['OPTIONS'])
def options_handler(path):
    response = make_response()
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-access-token, X-Requested-With')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

# Old YouTube auth status route - now fixed to avoid double decoration
@app.route('/api/youtube-auth-status', methods=['GET'])
@token_required
def youtube_auth_status_compat(current_user):
    # Direct implementation rather than calling the other function to avoid decorator issues
    try:
        user_id = str(current_user['_id'])
        logger.info(f"Compatibility route: Checking YouTube auth status for user {user_id}")

        # Check if credentials exist
        is_authenticated = check_auth_status(user_id)

        # Get user channels if authenticated
        channels = []
        if is_authenticated:
            youtube = get_authenticated_service(user_id)

            if youtube:
                try:
                    # Fetch the user's channels
                    channels_response = youtube.channels().list(
                        part="snippet,contentDetails,statistics",
                        mine=True,
                        maxResults=50
                    ).execute()

                    for channel in channels_response.get('items', []):
                        channel_info = {
                            "id": channel['id'],
                            "title": channel['snippet']['title'],
                            "description": channel['snippet'].get('description', ''),
                            "customUrl": channel['snippet'].get('customUrl', '')
                        }

                        # Get thumbnail if available
                        thumbnails = channel['snippet'].get('thumbnails', {})
                        if thumbnails and 'default' in thumbnails:
                            channel_info['thumbnailUrl'] = thumbnails['default']['url']

                        channels.append(channel_info)
                except Exception as e:
                    logger.error(f"Error fetching channels: {e}")
                    # Return authenticated but with empty channels

        response = {
            "status": "success",
            "authenticated": is_authenticated,
            "channels": channels
        }

        # If not authenticated, include auth URL
        if not is_authenticated:
            frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3500')
            redirect_uri = f"{frontend_url}/youtube-auth-success"

            # Generate auth URL
            auth_url = get_auth_url(user_id, redirect_uri)
            state = encode_state_param(user_id)

            response.update({
                "auth_url": auth_url,
                "state": state,
                "redirect_uri": redirect_uri
            })

        return jsonify(response)

    except Exception as e:
        logger.error(f"Error checking YouTube auth status: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

# Old YouTube auth start route
@app.route('/api/youtube-auth-start', methods=['GET'])
@token_required
def youtube_auth_start_compat(current_user):
    return start_youtube_auth_new(current_user)

# Old YouTube auth callback route
@app.route('/api/youtube-auth-callback', methods=['GET'])
def youtube_auth_callback_compat():
    return youtube_auth_callback_new()

# Add a global after_request handler to ensure CORS headers are set
@app.after_request
def add_cors_headers(response):
    # Allow requests from any origin (you can restrict this to specific domains)
    response.headers.add('Access-Control-Allow-Origin', '*')

    # Allow the following headers
    response.headers.add('Access-Control-Allow-Headers',
                        'Content-Type,Authorization,x-access-token,X-Requested-With')

    # Allow the following methods
    response.headers.add('Access-Control-Allow-Methods',
                        'GET,PUT,POST,DELETE,OPTIONS')

    # Allow credentials
    response.headers.add('Access-Control-Allow-Credentials', 'true')

    return response

if __name__ == '__main__':
    try:
        # Standard run method without the problematic parameter
        socketio.run(app, host='0.0.0.0', port=4000, debug=True)
    except KeyboardInterrupt:
        print("Server shutting down...")
    finally:
        # Set shutdown flag to signal threads to clean up
        shutdown_flag.set()
        print("Waiting for threads to complete...")
        # Wait for active threads to finish (with timeout)
        for thread in active_threads:
            if thread.is_alive():
                thread.join(timeout=5.0)
        print("Cleanup complete")
