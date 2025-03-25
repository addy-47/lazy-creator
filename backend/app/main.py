from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
import os
import logging
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
logger = logging.getLogger(__name__)

# Assume this is your function to generate the short
from .automation.shorts_main import generate_youtube_short

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
            background_path = os.path.join('uploads', filename)
            os.makedirs('uploads', exist_ok=True)
            background_file.save(background_path)

        # Call the generation function with the inputs
        video_path = generate_youtube_short(
            topic=prompt,
            max_duration=duration,
            background_type=background_type,
            background_source=background_source,
            background_path=background_path
        )

        return jsonify({
            "status": "success",
            "message": "YouTube Short created successfully",
            "video_path": video_path
        })

    except Exception as e:
        logger.error(f"Error generating YouTube Short: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=4000, debug=True)
