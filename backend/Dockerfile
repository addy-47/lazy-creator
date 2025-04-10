FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    portaudio19-dev \
    python3-dev \
    gcc \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Download NLTK data
RUN python -c "import nltk; nltk.download('stopwords'); nltk.download('punkt')"

# Copy project files
COPY . .

# Set environment variables (these will be overridden by .env file if mounted)
ENV NEWS_API_KEY=""
ENV PEXELS_API_KEY=""
ENV PIXABAY_API_KEY=""
ENV USE_AZURE_TTS="false"
ENV AZURE_VOICE="en-US-JennyNeural"
ENV YOUTUBE_TOPIC="Artificial Intelligence"
ENV ENABLE_YOUTUBE_UPLOAD="false"
ENV MEDIA_BUCKET="lazycreator-media"
ENV UPLOADS_BUCKET="lazycreator-uploads"

# Cloud Run specific: Use $PORT environment variable
ENV PORT 8080

# Command to run the application with gunicorn
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 main:app
