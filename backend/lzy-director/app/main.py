from flask import Flask, request, jsonify, send_file
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

# Initialize Flask app
app = Flask(__name__)

# Configure CORS for the gateway
CORS(app, resources={r"/*": {"origins": "*"}})

# Track all video generation tasks
active_tasks = {}

# Signal handler for graceful shutdown
def handle_shutdown_signal(signum, frame):
    logger.info(f"Received shutdown signal {signum}, shutting down gracefully...")
    sys.exit(0)

signal.signal(signal.SIGINT, handle_shutdown_signal)
signal.signal(signal.SIGTERM, handle_shutdown_signal)

@app.route('/health', methods=['GET', 'HEAD'])
def health_check():
    return jsonify({'status': 'ok', 'service': 'lzy-director-engine'}), 200

# Generate YouTube Short - Stateless Engine Endpoint
@app.route('/generate', methods=['POST'])
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

                # Store result (In a real production environment, this would upload to GCS/S3)
                # For Phase 3, we keep the file accessible for the Orchestrator to fetch
                active_tasks[tid] = {
                    "status": "completed",
                    "progress": 100,
                    "video_path": video_path,
                    "thumbnail_path": thumbnail_path,
                    "content": comprehensive_content
                }
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

@app.route('/status/<task_id>', methods=['GET'])
def get_task_status(task_id):
    task = active_tasks.get(task_id)
    if not task:
        return jsonify({"status": "error", "message": "Task not found"}), 404
    return jsonify(task)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 9999))
    app.run(host='0.0.0.0', port=port)