# Backend Setup

This is the backend component of the LazyCreator project based on Python with Flask.

## Configuration

- Port configured to run on 4000
- Added a Flask-based REST API server

## How to Run

1. Install dependencies:

```
pip install -r requirements.txt
```

2. Start the server:

```
python server.py
```

Or use the batch file:

```
run_server.bat
```

The backend will be available at http://localhost:4000

## API Endpoints

- `GET /api/health` - Health check endpoint
- `POST /api/generate-short` - Generate a YouTube short
  - Parameters:
    - `topic` (string, optional) - Topic for the YouTube short
    - `style` (string, optional) - Style of the video ("video" or "animation")
    - `max_duration` (integer, optional) - Maximum duration of the video in seconds

## Notes

- The core functionality remains the same as the original python script
- Added a Flask server to allow communication with the frontend
