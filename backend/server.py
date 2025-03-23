from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import logging
from main import generate_youtube_short

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('server.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "message": "Server is running"})

@app.route('/api/generate-short', methods=['POST'])
def generate_short():
    try:
        data = request.json
        topic = data.get('topic', 'Artificial Intelligence')
        style = data.get('style', 'video')
        max_duration = data.get('max_duration', 25)

        video_path = generate_youtube_short(
            topic=topic,
            style=style,
            max_duration=max_duration
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
    port = int(os.environ.get('PORT', 4000))
    app.run(host='0.0.0.0', port=port, debug=True)
