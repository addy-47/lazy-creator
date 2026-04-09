from flask import Flask, request, jsonify, send_file, Blueprint
from flask_cors import CORS
import os
import sys
import logging
import tempfile
import threading
import json
import uuid
import signal
from datetime import datetime, timezone
from typing import Tuple, List, Dict, Any, Optional
from werkzeug.utils import secure_filename
from functools import wraps

# Video Generation Engine Imports
from app.video_gen.generator import generate_youtube_short
from dotenv import load_dotenv

# Configure logging
from .logging_config import get_app_logger, configure_root_logger

# Configure root logger
configure_root_logger()

# Get application logger
logger = get_app_logger()

# Load environment variables
load_dotenv()

from asgiref.wsgi import WsgiToAsgi

# Track all video generation tasks
active_tasks = {}

# Initialize Flask app
app = Flask(__name__)
# Create Blueprint for API versioning and service identification
api_v1 = Blueprint('api_v1', __name__, url_prefix='/api/v1/lzy-director')

# Configure CORS
CORS(app, resources={r"/*": {"origins": "*"}})

@api_v1.route('/health', methods=['GET', 'HEAD'])
def health_check():
    return jsonify({'status': 'ok', 'service': 'lzy-director-engine'}), 200

# Get Go Orchestrator URL for callbacks
ORCHESTRATOR_URL = os.getenv("ORCHESTRATOR_URL", "http://localhost:8888")

def notify_orchestrator_completion(task_data: Dict[str, Any]):
    """
    Notify the Go orchestrator that video generation is complete.
    The orchestrator will handle metadata storage and file retrieval.
    """
    try:
        import requests
        
        callback_url = f"{ORCHESTRATOR_URL}/video-complete"
        
        # Prepare payload with video metadata
        payload = {
            "task_id": task_data.get("task_id"),
            "status": "completed",
            "video_path": task_data.get("video_path"),
            "thumbnail_path": task_data.get("thumbnail_path"),
            "metadata": {
                "title": task_data.get("content", {}).get("title", "Untitled"),
                "description": task_data.get("content", {}).get("description", ""),
                "script": task_data.get("content", {}).get("script", ""),
                "duration_seconds": 0,  # Will be calculated from video
                "resolution": [1080, 1920],
                "fps": 30,
                "background_type": task_data.get("background_type", "video"),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        }
        
        # Send completion notification
        response = requests.post(callback_url, json=payload, timeout=10)
        
        if response.status_code == 200:
            logger.info(f"Successfully notified orchestrator for task {task_data.get('task_id')}")
        else:
            logger.warning(f"Orchestrator callback failed with status {response.status_code}")
            
    except Exception as e:
        logger.error(f"Failed to notify orchestrator: {str(e)}")

# Signal handler for graceful shutdown
def handle_shutdown_signal(signum, frame):
    logger.info(f"Received shutdown signal {signum}, shutting down gracefully...")
    sys.exit(0)

signal.signal(signal.SIGINT, handle_shutdown_signal)
signal.signal(signal.SIGTERM, handle_shutdown_signal)

# Generate YouTube Short - Stateless Engine Endpoint
@api_v1.route('/generate', methods=['POST'])
def generate_short():
    """
    Triggers the video generation process.
    This is now a stateless engine endpoint called by the Go Orchestrator.
    """
    try:
        # Extract data
        prompt = request.form.get('prompt', 'latest AI news')
        duration = int(request.form.get('duration', 25))
        background_type = request.form.get('background_type', 'video')
        background_source = request.form.get('background_source', 'provided')
        background_file = request.files.get('background_file')

        # Generate a unique task ID
        task_id = str(uuid.uuid4())
        
        # Handle custom background file if provided
        background_path = None
        if background_file:
            temp_bg = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(background_file.filename)[1])
            background_file.save(temp_bg.name)
            background_path = temp_bg.name
            logger.info(f"Saved temporary background to {background_path}")

        # Task response
        response = {
            "status": "started",
            "task_id": task_id,
            "message": "Video generation task initiated"
        }

        # Background processing
        def process_video_task(tid, p, d, bt, bs, bp):
            try:
                active_tasks[tid] = {"status": "processing", "progress": 0}

                def progress_callback(progress, message, remaining):
                    active_tasks[tid] = {
                        "status": "processing",
                        "progress": progress,
                        "message": message,
                        "remaining": remaining
                    }
                    logger.info(f"Task {tid}: {progress}% - {message}")

                # Generate video
                video_path, thumbnail_path, comprehensive_content = generate_youtube_short(
                    topic=p,
                    max_duration=d,
                    background_type=bt,
                    background_source=bs,
                    background_path=bp,
                    progress_callback=progress_callback
                )

                # Store result locally for orchestrator to fetch
                active_tasks[tid] = {
                    "status": "completed",
                    "progress": 100,
                    "video_path": video_path,
                    "thumbnail_path": thumbnail_path,
                    "content": comprehensive_content,
                    "background_type": bt
                }
                
                # Notify orchestrator to handle metadata and file retrieval
                notify_orchestrator_completion(active_tasks[tid])
                
                logger.info(f"Task {tid} completed successfully")

            except Exception as e:
                logger.error(f"Error in task {tid}: {str(e)}")
                active_tasks[tid] = {"status": "error", "error": str(e)}

        thread = threading.Thread(target=process_video_task, args=(task_id, prompt, duration, background_type, background_source, background_path))
        thread.daemon = True
        thread.start()

        return jsonify(response), 202

    except Exception as e:
        logger.error(f"Error initiating generation: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@api_v1.route('/status/<task_id>', methods=['GET'])
def get_task_status(task_id):
    task = active_tasks.get(task_id)
    if not task:
        return jsonify({"status": "error", "message": "Task not found"}), 404
    return jsonify(task)

@api_v1.route('/download/<task_id>/video', methods=['GET'])
def download_video(task_id):
    """
    Download video file for a completed task.
    Called by the Go orchestrator to fetch the video file.
    """
    task = active_tasks.get(task_id)
    if not task or task.get("status") != "completed":
        return jsonify({"status": "error", "message": "Video not found"}), 404
    
    video_path = task.get("video_path")
    if not video_path or not os.path.exists(video_path):
        return jsonify({"status": "error", "message": "Video file not found"}), 404
    
    return send_file(
        video_path,
        mimetype='video/mp4',
        as_attachment=True,
        download_name=f"video_{task_id}.mp4"
    )

@api_v1.route('/download/<task_id>/thumbnail', methods=['GET'])
def download_thumbnail(task_id):
    """
    Download thumbnail file for a completed task.
    Called by the Go orchestrator to fetch the thumbnail file.
    """
    task = active_tasks.get(task_id)
    if not task or task.get("status") != "completed":
        return jsonify({"status": "error", "message": "Thumbnail not found"}), 404
    
    thumbnail_path = task.get("thumbnail_path")
    if not thumbnail_path or not os.path.exists(thumbnail_path):
        return jsonify({"status": "error", "message": "Thumbnail file not found"}), 404
    
    return send_file(
        thumbnail_path,
        mimetype='image/jpeg',
        as_attachment=True,
        download_name=f"thumbnail_{task_id}.jpg"
    )

# Register Blueprint
app.register_blueprint(api_v1)

# ASGI Wrapper for uvicorn
asgi_app = WsgiToAsgi(app)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 9999))
    logger.info(f"Starting LZY-DIRECTOR on port {port} (WSGI mode)")
    app.run(host='0.0.0.0', port=port)