FROM python:3.12-slim AS base

WORKDIR /app

# Install system dependencies (ffmpeg, imagemagick, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    imagemagick \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and fonts
COPY backend/app /app/app
COPY backend/fonts /app/fonts

# Expose port
EXPOSE 8000

# Run with gunicorn
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "app.main:app", "--bind", "0.0.0.0:8000"]
