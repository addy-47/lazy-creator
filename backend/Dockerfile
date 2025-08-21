# Stage 1: Build stage with full build dependencies
FROM python:3.12-slim as builder

# Install build tools and dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    portaudio19-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
WORKDIR /app
COPY backend/requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt


# Stage 2: Final stage with only runtime dependencies
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV FFMPEG_THREADS=4
ENV MOVIEPY_THREADS=8
ENV PORT=8080

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    imagemagick \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Update ImageMagick policy to allow reading and writing PNGs
RUN sed -i 's#<policy domain="path" rights="none" pattern="@\*"/>#<policy domain="path" rights="read|write" pattern="@*"/>#g' /etc/ImageMagick-6/policy.xml && \
    sed -i '/<policymap>/a\  <policy domain="coder" rights="read|write" pattern="PNG"/>' /etc/ImageMagick-6/policy.xml

# Copy Python dependencies from builder stage
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir /wheels/* gunicorn

# Set working directory
WORKDIR /app

# Download NLTK data
RUN python -c "import nltk; nltk.download('stopwords'); nltk.download('punkt')"

# Copy project files
COPY backend/app /app/app
COPY backend/fonts /app/fonts

# Expose port
EXPOSE 8080

# Run the application
CMD exec gunicorn --bind :$PORT \
    --workers 2 \
    --threads 4 \
    --worker-class gthread \
    --worker-tmp-dir /dev/shm \
    --timeout 0 \
    --max-requests 1000 \
    --max-requests-jitter 50 \
    app.main:app