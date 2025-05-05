# Lazy Creator Backend

This is the backend service for the Lazy Creator application, providing API endpoints for AI-powered video generation and YouTube uploading.

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

## Setup Instructions

### Local Development

1. **Install dependencies:**

   ```
   pip install -r requirements.txt
   ```

2. **Configure environment variables:**

   - Copy `env.example` to `.env` and customize
   - OR use the setup scripts:
     - Windows: `.\setup_env.ps1`
     - Linux/Mac: `source setup_env.sh`

3. **Run the application:**

   ```
   python -m app.main
   ```

   The app will be available at http://localhost:4000

### Production Deployment (Cloud Run)

1. **Build the Docker image:**

   ```
   docker build -t gcr.io/your-project-id/lazy-creator-backend .
   ```

2. **Push to Container Registry:**

   ```
   docker push gcr.io/your-project-id/lazy-creator-backend
   ```

3. **Deploy to Cloud Run:**
   - Use Google Cloud Console or gcloud CLI
   - Make sure to configure the environment variables in the Cloud Run service configuration

## Authentication

The backend uses JWT tokens for authentication. Tokens are valid for 30 days by default.

To obtain a token, use:

- `/api/login` - For regular login
- `/api/refresh-token` - To refresh an existing token

## Troubleshooting

### Google Cloud Storage Issues

If you see errors like `Invalid JSON in GOOGLE_APPLICATION_CREDENTIALS`, ensure:

1. In local development, point to the credentials file path, not the contents
2. In production, ensure the service account has proper permissions

### YouTube Authentication Issues

If YouTube auth is failing:

1. Ensure your client_secret.json file is properly configured
2. For local development, use the file path in YOUTUBE_CLIENT_SECRETS
3. In production, make sure you have correctly set up the OAuth credentials

### Token Expiration Issues

If tokens are expiring too quickly:

1. Check your system clock is correct
2. Use the /api/refresh-token endpoint to refresh tokens before they expire
3. Ensure TOKEN_EXPIRATION_SECONDS is set properly

## API Endpoints

The backend provides the following key endpoints:

- `/api/register` - User registration
- `/api/login` - User login
- `/api/refresh-token` - Refresh JWT token
- `/api/gallery` - Get all user videos
- `/api/generate-short` - Generate a YouTube short
- `/api/youtube/auth/start` - Start YouTube authentication
- `/api/youtube/upload/{video_id}` - Upload video to YouTube

For a complete list of endpoints, see the API documentation.

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
