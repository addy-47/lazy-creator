# LazyCreator Backend

The backend component of LazyCreator is built with Python and Flask, providing a robust API for video generation and YouTube integration.

## Core Technologies

- Python 3.10+
- Flask (REST API)
- MongoDB (Database)
- Google Cloud Storage
- YouTube Data API v3
- FFmpeg for video processing

## Project Structure

```
backend/
├── app/
│   ├── automation/       # Video generation core
│   ├── credentials/      # API credentials
│   ├── demo/            # Demo video assets
│   ├── logs/            # Application logs
│   ├── main.py          # Main Flask application
│   ├── storage.py       # Storage management
│   ├── youtube_auth.py  # YouTube authentication
│   └── logging_config.py # Logging configuration
└── requirements.txt      # Python dependencies
```

## Setup

1. Install Python dependencies:

```bash
pip install -r requirements.txt
```

2. Configure environment variables in `.env`:

```
MONGODB_URI=your_mongodb_uri
SECRET_KEY=your_jwt_secret
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json
MEDIA_BUCKET=your-media-bucket
UPLOADS_BUCKET=your-uploads-bucket
FRONTEND_URL=http://localhost:3500
```

3. Set up Google Cloud credentials:

   - Create a service account in Google Cloud Console
   - Download the JSON key file
   - Set the path in GOOGLE_APPLICATION_CREDENTIALS

4. Start the server:

```bash
python app/main.py
```

## API Endpoints

### Authentication

- `POST /api/register` - Register new user
- `POST /api/login` - User login
- `GET /api/profile` - Get user profile

### Video Generation

- `POST /api/generate-short` - Generate YouTube short
- `GET /api/gallery` - List user's videos
- `GET /api/download/<video_id>` - Download generated video
- `DELETE /api/video/<video_id>` - Delete video

### YouTube Integration

- `GET /api/youtube/auth/start` - Start YouTube authorization
- `GET /api/youtube/auth/callback` - OAuth callback
- `GET /api/youtube/channels` - List user's YouTube channels
- `POST /api/youtube/upload` - Upload video to YouTube

## Features

- Secure JWT authentication
- Automatic video generation
- YouTube API integration
- Background task processing
- File upload handling
- Cloud storage integration
- Comprehensive logging
- Error handling and monitoring
- CORS support

## Development

The server runs on port 4000 by default. API endpoints are prefixed with `/api/`.

### Logging

Logs are stored in `app/logs/`:

- `app.log` - General application logs
- `video_creation.log` - Video generation logs

### Error Handling

All endpoints include proper error handling with appropriate HTTP status codes and JSON responses.

### Storage

Files are stored in Google Cloud Storage with separate buckets for:

- Media files (generated videos)
- Uploaded content (user backgrounds)

## Production Deployment

1. Build Docker image:

```bash
docker build -t lazycreator-backend .
```

2. Run container:

```bash
docker run -p 4000:4000 --env-file .env lazycreator-backend
```

## Monitoring

- Check application logs in `app/logs/`
- Monitor MongoDB performance
- Watch Google Cloud Storage usage
- Track YouTube API quota usage

## Security

- JWT token authentication
- Secure password hashing
- CORS configuration
- Rate limiting
- Input validation
- File upload restrictions

## Contributing

1. Follow PEP 8 style guide
2. Add tests for new features
3. Update documentation
4. Ensure all tests pass
5. Submit pull request

## License

This project is licensed under the MIT License.
