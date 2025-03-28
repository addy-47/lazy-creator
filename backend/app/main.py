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

from automation.shorts_main import generate_youtube_short
from automation.youtube_upload import upload_video, get_authenticated_service, check_auth_status
from automation.youtube_auth import get_auth_url, get_credentials_from_code

# Initialize Flask app
app = Flask(__name__)
CORS(app)
logger = logging.getLogger(__name__)

# Configuration
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-here')
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['GALLERY_FOLDER'] = 'gallery'
app.config['TOKEN_EXPIRATION'] = 86400  # 24 hours in seconds

# Ensure directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['GALLERY_FOLDER'], exist_ok=True)

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

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = users_collection.find_one({'email': data['email']})
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
def generate_short():
    try:
        # Extract form data
        prompt = request.form.get('prompt', 'latest AI news')
        duration = int(request.form.get('duration', 25))
        background_type = request.form.get('background_type', 'video')
        background_source = request.form.get('background_source', 'provided')
        background_file = request.files.get('background_file')

        # Validate inputs
        if background_source == 'custom' and not background_file:
            return jsonify({"status": "error", "message": "Background file is required for custom source"}), 400

        # Handle file upload for custom background
        background_path = None
        if background_file:
            filename = secure_filename(background_file.filename)
            background_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            background_file.save(background_path)

        # Create a video entry with 'processing' status
        video_data = {
            'original_prompt': prompt,
            'duration': duration,
            'background_type': background_type,
            'created_at': datetime.utcnow(),
            'status': 'processing',  # Add status field
            'progress': 0,  # Add progress field
            'uploaded_to_yt': False,
            'youtube_id': None
        }

        # Insert into database and get ID
        video_id = videos_collection.insert_one(video_data).inserted_id

        # Start background processing (in a real app, use a task queue like Celery)
        # For now, we'll simulate it with a thread
        import threading

        def process_video():
            try:
                # Call the generation function
                video_path = generate_youtube_short(
                    topic=prompt,
                    max_duration=duration,
                    background_type=background_type,
                    background_source=background_source,
                    background_path=background_path
                )

                # Create a unique filename
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"{prompt.replace(' ', '_')}_{timestamp}.mp4"
                gallery_path = os.path.join(app.config['GALLERY_FOLDER'], filename)

                # Move the video to the gallery folder
                shutil.move(video_path, gallery_path)

                # Update the database with completed status and file info
                videos_collection.update_one(
                    {'_id': ObjectId(video_id)},
                    {'$set': {
                        'status': 'completed',
                        'progress': 100,
                        'filename': filename,
                        'path': gallery_path
                    }}
                )

            except Exception as e:
                logger.error(f"Error in background processing: {e}")
                # Update with error status
                videos_collection.update_one(
                    {'_id': ObjectId(video_id)},
                    {'$set': {
                        'status': 'error',
                        'error_message': str(e)
                    }}
                )

        # Start the processing thread
        thread = threading.Thread(target=process_video)
        thread.daemon = True
        thread.start()

        return jsonify({
            "status": "success",
            "message": "YouTube Short generation started",
            "video": {
                "id": str(video_id),
            }
        })

    except Exception as e:
        logger.error(f"Error generating YouTube Short: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# Check video status
@app.route('/api/video-status/<video_id>', methods=['GET'])
def check_video_status(video_id):
    try:
        # Find the video
        video = videos_collection.find_one({'_id': ObjectId(video_id)})

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

# Get User's Videos
@app.route('/api/gallery', methods=['GET'])
def get_gallery():
    try:
        videos = list(videos_collection.find(
            {'status': 'completed'},  # Only show completed videos
            {'path': 0}  # Don't include full path in response
        ).sort('created_at', -1))

        # Convert ObjectId and datetime to strings
        for video in videos:
            video['id'] = str(video['_id'])
            del video['_id']
            if 'created_at' in video:
                video['created_at'] = video['created_at'].strftime('%Y-%m-%d %H:%M:%S')
            if 'uploaded_at' in video and video['uploaded_at']:
                video['uploaded_at'] = video['uploaded_at'].strftime('%Y-%m-%d %H:%M:%S')

        return jsonify({"status": "success", "videos": videos})

    except Exception as e:
        logger.error(f"Error fetching gallery: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# Download Video
@app.route('/api/download/<video_id>', methods=['GET'])
def download_video(video_id):
    try:
        video = videos_collection.find_one({
            '_id': ObjectId(video_id)
        })

        if not video or video.get('status') != 'completed' or not os.path.exists(video.get('path', '')):
            return jsonify({"status": "error", "message": "File not found"}), 404

        return send_file(video['path'], as_attachment=True)

    except Exception as e:
        logger.error(f"Error downloading video: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# Check YouTube Auth Status
@app.route('/api/youtube-auth-status', methods=['GET'])
@token_required
def check_youtube_auth_status(current_user):
    try:
        user_id = str(current_user['_id'])
        is_authenticated = check_auth_status(user_id)

        return jsonify({
            "status": "success",
            "authenticated": is_authenticated
        })
    except Exception as e:
        logger.error(f"Error checking YouTube auth status: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# Start YouTube Auth Flow
@app.route('/api/youtube-auth-start', methods=['GET'])
@token_required
def start_youtube_auth(current_user):
    try:
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
            '_id': ObjectId(video_id),
            'user_email': current_user['email']
        })

        if not video:
            return jsonify({"status": "error", "message": "Video not found"}), 404

        # Delete file if exists
        if os.path.exists(video['path']):
            os.remove(video['path'])

        # Delete from database
        videos_collection.delete_one({'_id': ObjectId(video_id)})

        return jsonify({"status": "success", "message": "Video deleted successfully"})

    except Exception as e:
        logger.error(f"Error deleting video: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# Serve gallery videos
@app.route('/gallery/<filename>', methods=['GET'])
def serve_gallery_file(filename):
    try:
        return send_from_directory(app.config['GALLERY_FOLDER'], filename)
    except Exception as e:
        logger.error(f"Error serving gallery file: {e}")
        return jsonify({"status": "error", "message": "File not found"}), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=4000, debug=True)
