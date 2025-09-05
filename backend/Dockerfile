FROM python:3.12-slim AS base

WORKDIR /app

# Install system dependencies (ffmpeg, imagemagick, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc\
    libasound2-dev \
    portaudio19-dev \
    libportaudio2 \
    libportaudiocpp0 \
    ffmpeg \
    imagemagick \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and fonts
COPY app /app/app
COPY fonts /app/fonts

# Expose port
EXPOSE 8000

# Run with gunicorn

CMD ["gunicorn", "--workers=2", "--threads=4", "--bind=0.0.0.0:$PORT", "app.main:app"]
