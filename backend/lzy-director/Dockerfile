FROM python:3.12-slim-bullseye AS base

WORKDIR /app

# Install system dependencies (ffmpeg, imagemagick, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    ffmpeg \
    imagemagick \
    libasound2-dev \
    portaudio19-dev \
    libportaudio2 \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and essential assets
COPY app /app/app
COPY fonts /app/fonts

# Standardize Port for LZY-DIRECTOR
ENV PORT=9999
EXPOSE 9999

# Run with gunicorn for production stability
CMD ["gunicorn", "--workers=2", "--threads=4", "--bind", "0.0.0.0:9999", "app.main:app"]
