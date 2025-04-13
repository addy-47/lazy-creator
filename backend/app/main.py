import os
import logging
from datetime import datetime
from flask import Flask, request, jsonify, send_file, send_from_directory, redirect, url_for
from werkzeug.utils import secure_filename
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import shutil
from functools import wraps
import requests
import re
import tempfile
import threading
import uuid
import atexit
import signal
import sys

from automation.shorts_main import generate_youtube_short
from automation.youtube_upload import upload_video, get_authenticated_service, check_auth_status
from automation.youtube_auth import get_auth_url, get_credentials_from_code
from storage import cloud_storage

# Initialize Flask app
app = Flask(__name__)
CORS(app)
logger = logging.getLogger(__name__)

# Configuration
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-here')
app.config['TOKEN_EXPIRATION'] = 86400  # 24 hours in seconds

# MongoDB Configuration
mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
client = MongoClient(mongo_uri)
db = client['youtube_shorts_db']
users_collection = db['users']
videos_collection = db['videos']

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

# Authentication Decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'x-access-token' in request.headers:
            token = request.headers['x-access-token']

        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        # Special case for demo token
        if token == 'demo-token-for-testing':
            # Create a mock user for demo purposes
            demo_user = {
                '_id': ObjectId('000000000000000000000000'),
                'email': 'demo@example.com',
                'name': 'Demo User'
            }
            return f(demo_user, *args, **kwargs)

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = users_collection.find_one({'email': data['email']})
            if not current_user:
                return jsonify({'message': 'User not found!'}), 401
        except:
            return jsonify({'message': 'Token is invalid!'}), 401

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

    user = users_collection.find_one({'email': data['email']})
    if not user:
        return jsonify({'message': 'User not found!'}), 404

    if check_password_hash(user['password'], data['password']):
        token = jwt.encode({
            'email': user['email'],
            'exp': datetime.utcnow().timestamp() + app.config['TOKEN_EXPIRATION']
        }, app.config['SECRET_KEY'])

        return jsonify({
            'token': token,
            'email': user['email']
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

        # Convert ObjectId to string for JSON serialization
        for video in videos:
            video['id'] = str(video['_id'])
            video.pop('_id', None)

            # Include generated title in the frontend for display in gallery
            if 'comprehensive_content' in video and 'title' in video['comprehensive_content']:
                video['display_title'] = video['comprehensive_content']['title']
            else:
                video['display_title'] = video.get('original_prompt', 'Untitled Video')

            # Ensure path includes user ID for proper access
            if 'path' in video and isinstance(video['path'], str) and 'filename' in video:
                user_id = str(current_user['_id'])

                # Construct the expected path with user ID
                expected_user_path = f"gs://{cloud_storage.media_bucket}/users/{user_id}/{video['filename']}"

                # Check if the file exists in the expected user path
                if cloud_storage.file_exists(f"users/{user_id}/{video['filename']}", cloud_storage.media_bucket):
                    # Update to use user-specific path
                    if video['path'] != expected_user_path:
                        video['path'] = expected_user_path

                        # Also update the database
                        videos_collection.update_one(
                            {'_id': ObjectId(video['id'])},
                            {'$set': {'path': expected_user_path}}
                        )
                        logger.info(f"Updated video path for {video['id']} to user-specific path: {expected_user_path}")
                # Check if file exists in demo user directory (for demo account)
                elif user_id == "000000000000000000000000" or cloud_storage.file_exists(f"users/000000000000000000000000/{video['filename']}", cloud_storage.media_bucket):
                    demo_path = f"gs://{cloud_storage.media_bucket}/users/000000000000000000000000/{video['filename']}"
                    if video['path'] != demo_path:
                        video['path'] = demo_path

                        # Update the database
                        videos_collection.update_one(
                            {'_id': ObjectId(video['id'])},
                            {'$set': {'path': demo_path}}
                        )
                        logger.info(f"Updated video path for {video['id']} to demo path: {demo_path}")
                # Check videos/user_id directory (old format)
                elif cloud_storage.file_exists(f"videos/{user_id}/{video['filename']}", cloud_storage.media_bucket):
                    old_user_path = f"gs://{cloud_storage.media_bucket}/videos/{user_id}/{video['filename']}"
                    if video['path'] != old_user_path:
                        video['path'] = old_user_path

                        # Update the database
                        videos_collection.update_one(
                            {'_id': ObjectId(video['id'])},
                            {'$set': {'path': old_user_path}}
                        )
                        logger.info(f"Updated video path for {video['id']} to old user path: {old_user_path}")
                # Check legacy videos directory
                elif cloud_storage.file_exists(f"videos/{video['filename']}", cloud_storage.media_bucket):
                    legacy_path = f"gs://{cloud_storage.media_bucket}/videos/{video['filename']}"
                    if video['path'] != legacy_path:
                        video['path'] = legacy_path

                        # Update the database
                        videos_collection.update_one(
                            {'_id': ObjectId(video['id'])},
                            {'$set': {'path': legacy_path}}
                        )
                        logger.info(f"Updated video path for {video['id']} to legacy path: {legacy_path}")
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

# Check YouTube Auth Status
@app.route('/api/youtube-auth-status', methods=['GET'])
@token_required
def check_youtube_auth_status(current_user):
    try:
        # Special case for demo token - return authenticated=True for demo users
        if current_user.get('email') == 'demo@example.com':
            return jsonify({
                "status": "success",
                "authenticated": True,
                "is_connected": True
            })

        user_id = str(current_user['_id'])
        is_authenticated = check_auth_status(user_id)

        return jsonify({
            "status": "success",
            "authenticated": is_authenticated,
            "is_connected": is_authenticated
        })
    except Exception as e:
        logger.error(f"Error checking YouTube auth status: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# Start YouTube Auth Flow
@app.route('/api/youtube-auth-start', methods=['GET'])
@token_required
def start_youtube_auth(current_user):
    try:
        # Special case for demo token - return a mock auth URL for demo users
        if current_user.get('email') == 'demo@example.com':
            return jsonify({
                "status": "success",
                "auth_url": "https://example.com/mock-youtube-auth"
            })

        user_id = str(current_user['_id'])
        redirect_uri = request.args.get('redirect_uri', f"{request.host_url}api/youtube-auth-callback")

        auth_url, state = get_auth_url(redirect_uri, user_id)

        return jsonify({
            "status": "success",
            "auth_url": auth_url
        })
    except Exception as e:
        logger.error(f"Error starting YouTube auth: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# YouTube Auth Callback
@app.route('/api/youtube-auth-callback', methods=['GET'])
def youtube_auth_callback():
    try:
        code = request.args.get('code')
        state = request.args.get('state')

        if not code or not state:
            return jsonify({"status": "error", "message": "Missing code or state parameter"}), 400

        redirect_uri = f"{request.host_url}api/youtube-auth-callback"

        # Exchange code for credentials
        get_credentials_from_code(code, state, redirect_uri)

        # Redirect to frontend
        frontend_callback_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
        return redirect(f"{frontend_callback_url}/youtube-auth-success?state={state}")
    except Exception as e:
        logger.error(f"Error in YouTube auth callback: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# Upload to YouTube
@app.route('/api/upload-to-youtube/<video_id>', methods=['POST'])
@token_required
def upload_to_youtube(current_user, video_id):
    try:
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "message": "No data provided"}), 400

        # Find the video
        video = videos_collection.find_one({
            '_id': ObjectId(video_id)
        })

        if not video:
            return jsonify({"status": "error", "message": "Video not found"}), 404

        # Get the video path from GCS
        gcs_path = video.get('path')
        if not gcs_path or not isinstance(gcs_path, str):
            return jsonify({"status": "error", "message": "Invalid video path"}), 400

        # Special case for demo token - return mock success response
        if current_user.get('email') == 'demo@example.com':
            # Update video metadata with mock data
            videos_collection.update_one(
                {'_id': ObjectId(video_id)},
                {'$set': {
                    'uploaded_to_yt': True,
                    'youtube_id': 'demo-youtube-id',
                    'youtube_title': data.get('title', 'Demo Title'),
                    'youtube_description': data.get('description', 'Demo Description'),
                    'youtube_tags': data.get('tags', ["demo", "test"]),
                    'uploaded_at': datetime.utcnow(),
                    'uploaded_by': current_user['email']
                }}
            )

            return jsonify({
                "status": "success",
                "message": "Video uploaded to YouTube successfully (Demo Mode)",
                "youtube_id": "demo-youtube-id"
            })

        # Use user's YouTube credentials
        user_id = str(current_user['_id'])
        youtube = get_authenticated_service(user_id)

        if not youtube:
            return jsonify({
                "status": "error",
                "message": "YouTube authentication required",
                "require_auth": True
            }), 401

        # Get metadata from request
        title = data.get('title', f"Short Video - {video.get('filename', 'Video')}")
        description = data.get('description', f"Created with LazyCreator\nOriginal prompt: {video.get('original_prompt', '')}")
        tags = data.get('tags', ["shorts", "ai", "automation"])
        use_thumbnail = data.get('useThumbnail', False)

        # Create a temporary file to download the video if needed
        local_video_path = None
        thumbnail_path = None

        try:
            # Download the video from cloud storage
            if gcs_path.startswith('gs://'):
                # GCS path format: gs://bucket-name/path/to/file.mp4
                try:
                    # Parse the GCS path
                    _, bucket_name, blob_name = gcs_path.split('/', 2)

                    # Check for the file in our local storage first (for efficiency)
                    local_storage_path = cloud_storage.find_file_in_local_storage(blob_name, bucket_name)
                    if local_storage_path and os.path.exists(local_storage_path) and os.path.getsize(local_storage_path) > 0:
                        logger.info(f"Found video in local storage: {local_storage_path}")
                        local_video_path = local_storage_path
                    else:
                        # Not found locally, download from GCS
                        logger.info(f"Downloading video from GCS: {blob_name}")
                        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_file:
                            local_video_path = temp_file.name

                        # Download the file
                        cloud_storage.download_file(blob_name, local_video_path, bucket_name)
                        logger.info(f"Video downloaded successfully to {local_video_path} ({os.path.getsize(local_video_path)} bytes)")
                except Exception as download_error:
                    logger.error(f"Failed to download video from GCS: {download_error}")
                    return jsonify({"status": "error", "message": f"Could not access video file: {str(download_error)}"}), 500
            else:
                # Try using the new helper function to find the file
                local_video_path = cloud_storage.find_file_in_local_storage(gcs_path)

                if not local_video_path:
                    # If helper couldn't find it, try direct path
                    if os.path.exists(gcs_path) and os.path.isfile(gcs_path):
                        logger.info(f"Using direct file path: {gcs_path}")
                        local_video_path = gcs_path
                    else:
                        # Log the error and return a helpful message
                        logger.error(f"Video file not found at any expected location. Path in DB: {gcs_path}")
                        return jsonify({
                            "status": "error",
                            "message": f"Video file not found. Path: {gcs_path}"
                        }), 404

            # Ensure file exists and is not empty
            if not os.path.exists(local_video_path) or os.path.getsize(local_video_path) == 0:
                return jsonify({"status": "error", "message": f"Video file exists but is empty or inaccessible: {local_video_path}"}), 404

            # Generate thumbnail if requested
            if use_thumbnail:
                try:
                    from automation.thumbnail import ThumbnailGenerator

                    # Create temporary directories for processing
                    temp_dir = tempfile.mkdtemp()

                    # Initialize thumbnail generator
                    thumbnail_generator = ThumbnailGenerator(output_dir=temp_dir)

                    # Get script sections from video if available
                    script_sections = video.get('script_sections', [])
                    if not script_sections and 'original_prompt' in video:
                        # Create a simple script section if none exists
                        script_sections = [{'text': video['original_prompt']}]

                    # Get the thumbnail prompt if it exists in the metadata
                    thumbnail_prompt = None
                    if 'comprehensive_content' in video and 'thumbnail_hf_prompt' in video['comprehensive_content']:
                        thumbnail_prompt = video['comprehensive_content']['thumbnail_hf_prompt']

                    # Generate the thumbnail
                    logger.info(f"Generating thumbnail for video {video_id} with title: {title}")
                    thumbnail_path = thumbnail_generator.generate_thumbnail(
                        title=title,
                        script_sections=script_sections,
                        prompt=thumbnail_prompt,
                        style="photorealistic"
                    )

                    if not thumbnail_path or not os.path.exists(thumbnail_path):
                        logger.warning(f"Failed to generate thumbnail for video {video_id}")
                        thumbnail_path = None
                    else:
                        logger.info(f"Generated thumbnail at {thumbnail_path}")
                except Exception as thumbnail_error:
                    logger.error(f"Error generating thumbnail: {thumbnail_error}")
                    thumbnail_path = None

            # Upload the video to YouTube
            try:
                logger.info(f"Starting YouTube upload from {local_video_path} ({os.path.getsize(local_video_path)} bytes)")
                youtube_id = upload_video(
                    youtube,
                    local_video_path,
                    title,
                    description,
                    tags if isinstance(tags, list) else tags.split(',') if isinstance(tags, str) else ["shorts", "ai"],
                    thumbnail_path=thumbnail_path
                )
                logger.info(f"Video successfully uploaded to YouTube with ID: {youtube_id}")
            except Exception as upload_error:
                logger.error(f"Error during YouTube upload: {upload_error}")
                # Check if it's an authentication issue
                if "unauthorized" in str(upload_error).lower() or "authentication" in str(upload_error).lower():
                    return jsonify({
                        "status": "error",
                        "message": "YouTube authentication expired. Please reconnect your YouTube account.",
                        "require_auth": True
                    }), 401
                raise  # Re-raise the exception to be caught by the outer try/except

            # Update video metadata
            videos_collection.update_one(
                {'_id': ObjectId(video_id)},
                {'$set': {
                    'uploaded_to_yt': True,
                    'youtube_id': youtube_id,
                    'youtube_title': title,
                    'youtube_description': description,
                    'youtube_tags': tags,
                    'uploaded_at': datetime.utcnow(),
                    'uploaded_by': current_user['email'],
                    'used_custom_thumbnail': thumbnail_path is not None
                }}
            )

            # Clean up temporary files
            if thumbnail_path and os.path.exists(thumbnail_path):
                try:
                    os.remove(thumbnail_path)
                    logger.info(f"Removed temporary thumbnail file: {thumbnail_path}")
                except Exception as e:
                    logger.warning(f"Failed to remove temporary thumbnail file: {e}")

            # Clean up the local video file if it was a temporary one
            if local_video_path and os.path.exists(local_video_path) and local_video_path != gcs_path and 'temp' in local_video_path:
                try:
                    os.remove(local_video_path)
                    logger.info(f"Removed temporary video file: {local_video_path}")
                except Exception as e:
                    logger.warning(f"Failed to remove temporary video file: {e}")

            return jsonify({
                "status": "success",
                "message": "Video uploaded to YouTube successfully",
                "youtube_id": youtube_id
            })

        except Exception as e:
            logger.error(f"Error processing video for upload: {e}")
            return jsonify({"status": "error", "message": str(e)}), 500

    except Exception as e:
        logger.error(f"Error uploading to YouTube: {e}")
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

# Compatibility route for older frontend versions
@app.route('/api/delete/<video_id>', methods=['DELETE'])
@token_required
def delete_video_compatibility(current_user, video_id):
    return delete_video(current_user, video_id)

# Helper function to try moving file to new path if found in old path
def try_move_file_to_new_path(user_id, filename):
    """
    Check if a file exists in an old path format and move it to the new path.

    Args:
        user_id: User ID
        filename: Filename to check and move

    Returns:
        Tuple: (bool, str) - Whether the move succeeded and the new path
    """
    try:
        # Check all possible old paths
        old_paths = [
            f"videos/{user_id}/{filename}",
            f"videos/{filename}"
        ]

        new_path = f"users/{user_id}/{filename}"

        # Check if file already exists in new path
        if cloud_storage.file_exists(new_path, cloud_storage.media_bucket):
            logger.info(f"File already exists in new path: {new_path}")
            return True, new_path

        # Check old paths and move if found
        for old_path in old_paths:
            if cloud_storage.file_exists(old_path, cloud_storage.media_bucket):
                logger.info(f"Found file in old path: {old_path}, moving to: {new_path}")

                # Download to temporary file
                with tempfile.NamedTemporaryFile(delete=False) as temp_file:
                    temp_path = temp_file.name

                # Download from old location
                cloud_storage.download_file(old_path, temp_path, cloud_storage.media_bucket)

                # Upload to new location
                cloud_storage.upload_file(
                    temp_path,
                    new_path,
                    bucket_name=cloud_storage.media_bucket,
                    user_id=user_id,
                    metadata={"moved_from": old_path}
                )

                # Delete temporary file
                os.unlink(temp_path)

                # Update database references
                try:
                    videos_collection.update_many(
                        {"filename": filename, "user_id": user_id},
                        {"$set": {"path": f"gs://{cloud_storage.media_bucket}/{new_path}"}}
                    )
                    logger.info(f"Updated database references for {filename}")
                except Exception as db_err:
                    logger.error(f"Failed to update database for moved file: {db_err}")

                return True, new_path

        # File not found in any old path
        return False, None
    except Exception as e:
        logger.error(f"Error in try_move_file_to_new_path: {e}")
        return False, None

# Public endpoint that accepts token via query param
@app.route('/api/gallery/<filename>', methods=['GET'])
def serve_gallery_file_with_token(filename):
    try:
        # Get authentication token from query params or headers
        token = request.args.get('token') or request.headers.get('x-access-token')

        if not token:
            logger.warning(f"No token provided for file: {filename}")
            return jsonify({'message': 'A valid token is required!'}), 401

        # Handle demo token specially
        if token == 'demo-token-for-testing':
            user_id = '000000000000000000000000'
            logger.info(f"Using demo user ID for token")
        else:
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

        # Try to move file from old path to new path
        moved, new_path = try_move_file_to_new_path(user_id, filename)
        if moved:
            logger.info(f"File successfully moved or confirmed in new path: {new_path}")

        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as temp_file:
            temp_path = temp_file.name

        # List of paths to check, in order of preference
        possible_paths = [
            f"users/{user_id}/{filename}",                      # Main user path (new structure)
            f"users/000000000000000000000000/{filename}",       # Demo user path
            f"videos/{user_id}/{filename}",                     # Old user path
            f"videos/{filename}"                                # Legacy video path
        ]

        # If the filename contains path separators, also check the exact path
        if '/' in filename:
            possible_paths.append(filename)  # Try exact path as specified

        # Try each path in order
        file_found = False
        download_error = None
        for path in possible_paths:
            try:
                logger.info(f"Attempting to download from: {path}")
                # Add more verbose logging
                if cloud_storage.file_exists(path, cloud_storage.media_bucket):
                    logger.info(f"Confirmed file exists at: {path}")
                    try:
                        cloud_storage.download_file(path, temp_path, cloud_storage.media_bucket)
                        file_found = True
                        logger.info(f"Successfully downloaded file from: {path}")
                        break
                    except Exception as download_err:
                        logger.error(f"Download error for existing file at {path}: {download_err}")
                        download_error = download_err
                else:
                    logger.info(f"File does not exist at: {path}")
            except Exception as e:
                logger.info(f"Error checking path {path}: {str(e)}")
                continue

        if not file_found:
            logger.error(f"File {filename} not found in any of the expected locations")
            error_message = f"File not found in any of the expected locations: {possible_paths}"
            if download_error:
                error_message += f". Download error: {download_error}"
            return jsonify({
                'status': 'error',
                'message': error_message
            }), 404

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
        youtube = get_authenticated_service(current_user['email'])

        if not youtube:
            # If not authenticated, return demo data instead of error
            logger.info("User not authenticated for YouTube API, returning demo trending shorts")
            return jsonify({
                "status": "success",
                "shorts": [
                    {
                        'id': 'demo1',
                        'title': 'Trending Short #1',
                        'thumbnail': f"{request.host_url}demo/demo1.mp4",
                        'channel': 'Demo Channel',
                        'views': '250000',
                        'likes': '15000',
                    },
                    {
                        'id': 'demo2',
                        'title': 'Trending Short #2',
                        'thumbnail': f"{request.host_url}demo/demo2.mp4",
                        'channel': 'Demo Channel 2',
                        'views': '550000',
                        'likes': '45000',
                    },
                    {
                        'id': 'demo3',
                        'title': 'Trending Short #3',
                        'thumbnail': f"{request.host_url}demo/demo3.mp4",
                        'channel': 'Demo Channel 3',
                        'views': '1250000',
                        'likes': '85000',
                    },
                    {
                        'id': 'demo4',
                        'title': 'Trending Short #4',
                        'thumbnail': f"{request.host_url}demo/demo4.mp4",
                        'channel': 'Demo Channel 4',
                        'views': '750000',
                        'likes': '65000',
                    },
                    {
                        'id': 'demo5',
                        'title': 'Trending Short #5',
                        'thumbnail': f"{request.host_url}demo/demo5.mp4",
                        'channel': 'Demo Channel 5',
                        'views': '1450000',
                        'likes': '95000',
                    },
                    {
                        'id': 'demo6',
                        'title': 'Trending Short #6',
                        'thumbnail': f"{request.host_url}demo/demo6.mp4",
                        'channel': 'Demo Channel 6',
                        'views': '350000',
                        'likes': '25000',
                    }
                ],
                "requires_auth": True
            })

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

# Add this route to serve demo videos
@app.route('/demo/<filename>')
def serve_demo(filename):
    try:
        # Create a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_file:
            # Download from Cloud Storage - Update path to match the specified bucket path
            blob_name = f"demo/{filename}"

            # Try to fetch from the local demo directory first if it exists
            local_demo_path = os.path.join(os.path.dirname(__file__), 'demo', filename)
            if os.path.exists(local_demo_path):
                logger.info(f"Serving demo video from local path: {local_demo_path}")
                return send_file(local_demo_path)

            # Otherwise try to download from GCS
            logger.info(f"Downloading demo video from GCS path: {blob_name}")
            cloud_storage.download_file(blob_name, temp_file.name)
            logger.info(f"Successfully downloaded demo video: {filename}")
            return send_file(temp_file.name)

    except Exception as e:
        logger.error(f"Error serving demo video: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# Protected endpoint that requires token in header
@app.route('/api/gallery/secure/<filename>', methods=['GET'])
@token_required
def serve_gallery_file_secure(current_user, filename):
    try:
        user_id = str(current_user['_id'])
        logger.info(f"Serving gallery file {filename} for user {user_id} (via secure endpoint)")

        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as temp_file:
            temp_path = temp_file.name

        # List of paths to check, in order of preference
        possible_paths = [
            f"users/{user_id}/{filename}",                      # Main user path (new structure)
            f"users/000000000000000000000000/{filename}",       # Demo user path
            f"videos/{user_id}/{filename}",                     # Old user path
            f"videos/{filename}"                                # Legacy video path
        ]

        # If the filename contains path separators, also check the exact path
        if '/' in filename:
            possible_paths.append(filename)  # Try exact path as specified

        # Try each path in order
        file_found = False
        for path in possible_paths:
            try:
                logger.info(f"Attempting to download from: {path}")
                cloud_storage.download_file(path, temp_path, cloud_storage.media_bucket)
                file_found = True
                logger.info(f"Found and downloaded file from: {path}")
                break
            except Exception as e:
                logger.info(f"File not found at {path}: {str(e)}")
                continue

        if not file_found:
            logger.error(f"File {filename} not found in any of the expected locations")
            return jsonify({
                'status': 'error',
                'message': 'File not found'
            }), 404

        return send_file(
            temp_path,
            as_attachment=False,  # Stream instead of downloading
            download_name=os.path.basename(filename),
            mimetype='video/mp4'
        )
    except Exception as e:
        logger.error(f"Error serving gallery file: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    try:
        app.run(host='0.0.0.0', port=4000, debug=True)
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
