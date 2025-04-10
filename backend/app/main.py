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
        import threading

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
                        video_path = generate_youtube_short(
                            topic=prompt,
                            max_duration=duration,
                            background_type=background_type,
                            background_source=processed_background_source,
                            background_path=processed_background_path
                        )

                        # Check if video was generated successfully
                        if not video_path or not os.path.exists(video_path):
                            raise FileNotFoundError(f"Generated video file not found at {video_path}")

                        # Update progress
                        videos_collection.update_one(
                            {'_id': ObjectId(video_id)},
                            {'$set': {
                                'progress': 60,
                                'status': 'uploading'
                            }}
                        )

                        # Create a unique filename
                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                        safe_prompt = re.sub(r'[^\w\s-]', '', prompt.lower()).strip().replace(' ', '_')[:50]  # Limit length for filesystems
                        filename = f"{safe_prompt}_{timestamp}.mp4"

                        # Set path in GCS to include user ID for better organization
                        blob_name = f"videos/{user_id}/{filename}"

                        # Upload to Cloud Storage with user_id metadata
                        gcs_path = cloud_storage.upload_file(
                            video_path,
                            blob_name,
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

                        # Update the database with completed status and file info
                        videos_collection.update_one(
                            {'_id': ObjectId(video_id)},
                            {'$set': {
                                'status': 'completed',
                                'progress': 100,
                                'filename': filename,
                                'path': gcs_path,
                                'user_id': user_id,
                                'completed_at': datetime.utcnow()
                            }}
                        )

                        logger.info(f"Video generation completed for user {user_id}, video {video_id}")

                        # Notify frontend that generation is complete
                        try:
                            origin = request.headers.get('Origin', 'http://localhost:3500')
                            callback_url = f"{origin}/api/generation-complete-callback/{video_id}"
                            requests.post(callback_url, json={
                                'status': 'success',
                                'video_id': str(video_id),
                                'filename': filename,
                                'path': gcs_path
                            }, timeout=5)
                        except Exception as callback_error:
                            logger.error(f"Failed to notify frontend of completion: {callback_error}")
                    except Exception as gen_error:
                        logger.error(f"Error in video generation for video {video_id}: {gen_error}")
                        # Update database with error status
                        videos_collection.update_one(
                            {'_id': ObjectId(video_id)},
                            {'$set': {
                                'status': 'error',
                                'error_message': str(gen_error)
                            }}
                        )

            except Exception as e:
                logger.error(f"Error in background processing for video {video_id}: {e}")
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

        if not os.path.exists(video.get('path', '')):
            return jsonify({"status": "error", "message": "Video file not found"}), 404

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

        # Get metadata or allow custom title/description
        title = data.get('title', f"Short Video - {video.get('filename', 'Video')}")
        description = data.get('description', f"Created with LazyCreator\nOriginal prompt: {video.get('original_prompt', '')}")
        tags = data.get('tags', ["shorts", "ai", "automation"])

        # Upload the video
        youtube_response = upload_video(
            youtube,
            video['path'],
            title,
            description,
            tags
        )

        # Update video metadata
        videos_collection.update_one(
            {'_id': ObjectId(video_id)},
            {'$set': {
                'uploaded_to_yt': True,
                'youtube_id': youtube_response.get('id'),
                'youtube_title': title,
                'youtube_description': description,
                'youtube_tags': tags,
                'uploaded_at': datetime.utcnow(),
                'uploaded_by': current_user['email']
            }}
        )

        return jsonify({
            "status": "success",
            "message": "Video uploaded to YouTube successfully",
            "youtube_id": youtube_response.get('id')
        })

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

# Serve gallery videos
@app.route('/gallery/<filename>', methods=['GET'])
def serve_gallery_file(filename):
    try:
        # Create a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_file:
            # Download from Cloud Storage
            blob_name = f"videos/{filename}"
            cloud_storage.download_file(blob_name, temp_file.name)
            return send_file(temp_file.name)

    except Exception as e:
        logger.error(f"Error serving gallery file: {e}")
        return jsonify({"status": "error", "message": str(e)}), 404

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
            # Download from Cloud Storage
            blob_name = f"demo/{filename}"
            cloud_storage.download_file(blob_name, temp_file.name)
            return send_file(temp_file.name)

    except Exception as e:
        logger.error(f"Error serving demo video: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=4000, debug=True)
