FROM python:3.13-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV FFMPEG_THREADS=2

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    portaudio19-dev \
    python3-dev \
    gcc \
    imagemagick \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s /usr/bin/convert /usr/local/bin/magick

# Update ImageMagick policy
RUN sed -i 's#<policy domain="path" rights="none" pattern="@\*"/>#<policy domain="path" rights="read|write" pattern="@*"/>#g' /etc/ImageMagick-6/policy.xml && \
    sed -i '/<policymap>/a\  <policy domain="coder" rights="read|write" pattern="PNG"/>' /etc/ImageMagick-6/policy.xml

# Set working directory
WORKDIR /app

# Copy requirements first
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Download NLTK data
RUN python -c "import nltk; nltk.download('stopwords'); nltk.download('punkt')"

# Copy project files
COPY . .

# Configure FFmpeg for better performance
RUN echo "FFREPORT=file=/tmp/ffreport.log:level=32" >> /etc/environment && \
    mkdir -p /tmp/transcodes && \
    chmod 777 /tmp/transcodes

# Set environment variables
ENV USE_AZURE_TTS="false" \
    AZURE_VOICE="en-US-JennyNeural" \
    YOUTUBE_TOPIC="Artificial Intelligence" \
    ENABLE_YOUTUBE_UPLOAD="false" \
    MEDIA_BUCKET="lazycreator-media" \
    UPLOADS_BUCKET="lazycreator-uploads" \
    DEBUG="False" \
    MONGODB_DB_NAME="lazy-creator" \
    PORT=8080 \
    USE_GOOGLE_TTS="true" \
    GOOGLE_VOICE="en-US-Neural2-D" \
    MOVIEPY_THREADS=2 \
    FFMPEG_PRESET=ultrafast \
    FFMPEG_CRF=28

# Command to run with gunicorn - optimized for video processing
CMD exec gunicorn --bind :$PORT \
    --workers 2 \
    --threads 4 \
    --worker-class gthread \
    --worker-tmp-dir /dev/shm \
    --timeout 0 \
    --max-requests 1000 \
    --max-requests-jitter 50 \
    app.main:app
