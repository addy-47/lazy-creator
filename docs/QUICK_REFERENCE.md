# Quick Reference Guide

## Service Architecture

```
Frontend (React+TS)
    ↓ REST API
Go Service (Port 8888) ←→ PostgreSQL (Users, YouTube)
    ↓ REST API              ←→ MongoDB (Videos)
Python Service (Port 9999) - Video Generation Only
```

---

## Key Endpoints

### Go Service (`/api/v1/lzy-svc`)

#### Authentication
```
POST /auth/register          - Register user
POST /auth/login             - Email/password login
POST /auth/google-login      - Google OAuth login
POST /auth/firebase-login    - Firebase login
POST /auth/refresh           - Refresh JWT token
POST /auth/logout            - Logout
```

#### Video Management
```
GET  /videos                 - Get user's videos (paginated)
GET  /videos/:id             - Get specific video
DELETE /videos/:id           - Delete video
POST /videos/generate        - Start video generation

# Query params: ?limit=20&skip=0
```

#### YouTube
```
GET  /youtube/auth-start     - Get OAuth URL
GET  /youtube/auth-callback  - Handle OAuth callback
GET  /youtube/channels       - Get user's channels
GET  /youtube/status         - Check connection status
POST /youtube/upload         - Upload video to YouTube
```

#### Storage
```
GET /storage/upload-url?filename=video.mp4   - Get upload URL
GET /storage/download-url?filename=file.jpg  - Get download URL
```

#### Python Service Callbacks
```
POST /lzy-director/video-complete   - Video completion (from Python)
POST /lzy-director/video-progress   - Progress update (from Python)
```

### Python Service

```
POST /generate                       - Start video generation
GET  /status/:task_id                - Get progress
GET  /download/:task_id/video        - Download video file
GET  /download/:task_id/thumbnail    - Download thumbnail
GET  /health                         - Health check
```

---

## Database Schemas

### PostgreSQL

**users**
```sql
id, email, password_hash, name, picture, provider, is_active, created_at, updated_at
```

**youtube_credentials**
```sql
id, user_id, access_token, refresh_token, expiry, token_type, created_at, updated_at
```

### MongoDB

**video_metadata**
```javascript
{
  _id: ObjectId,
  task_id: String (unique),
  user_id: String (indexed),
  status: "queued"|"processing"|"completed"|"failed"|"cancelled",
  progress: 0-100,
  title: String,
  description: String,
  script: String,
  duration_seconds: Number,
  video_path: String,
  thumbnail_path: String,
  resolution: [1080, 1920],
  fps: 30,
  background_type: "video"|"image",
  prompt: String,
  ai_model: "gpt-4o-mini",
  created_at: Date,
  updated_at: Date,
  completed_at: Date,
  error_message: String,
  youtube_video_id: String,
  youtube_url: String,
  uploaded_at: Date
}
```

---

## Video Generation Flow

```
1. Frontend → POST /videos/generate
2. Go Service → Create MongoDB record (status: "queued")
3. Go Service → POST http://python:9999/generate
4. Python Service → Generate video (updates progress via callback)
5. Python Service → POST /lzy-director/video-complete
6. Go Service → Update MongoDB (status: "completed")
7. Go Service → GET /download/:task_id/video (fetch file)
8. Go Service → Upload to GCS (optional)
9. Frontend → Poll /videos/:id until completed
```

---

## Environment Variables

### Python (.env)
```bash
PORT=9999
OPENAI_API_KEY=sk-...
PEXELS_API_KEY=...
PIXABAY_API_KEY=...
UNSPLASH_API_KEY=...
HUGGINGFACE_API_KEY=hf_...
GOOGLE_APPLICATION_CREDENTIALS=/path/to/creds.json
USE_GOOGLE_TTS=true
TEMP_DIR=/tmp
ORCHESTRATOR_URL=http://localhost:8888
```

### Go (.env)
```bash
PORT=8888
GIN_MODE=release
SECRET_KEY=your-secret-key
POSTGRES_URI=postgres://user:pass@localhost:5500/lzy
MONGODB_URI=mongodb://localhost:27000
MONGODB_DB_NAME=lzy
FRONTEND_URL=http://localhost:5555
PYTHON_DIRECTOR_URL=http://localhost:9999
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:8888/api/v1/lzy-svc/auth/google-callback
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_REDIRECT_URI=http://localhost:8888/api/v1/lzy-svc/youtube/auth-callback
GCP_PROJECT_ID=...
GCS_BUCKET_NAME=...
GOOGLE_APPLICATION_CREDENTIALS=/path/to/creds.json
```

### Frontend (.env.development)
```bash
VITE_LZY_SVC_URL=http://localhost:8888/api/v1/lzy-svc
VITE_LZY_DIRECTOR_URL=http://localhost:9999/api/v1/lzy-director
VITE_FRONTEND_URL=http://localhost:5555
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
# ... other Firebase config
```

---

## Common Commands

### Backend
```bash
# Go service
cd backend/lzy-svc
go run cmd/lzy-svc/main.go
go build -o lzy-svc cmd/lzy-svc/main.go

# Python service
cd backend/lzy-director
python app/main.py
gunicorn -w 2 -t 120 -b 0.0.0.0:9999 app.main:app
```

### Frontend
```bash
cd frontend
pnpm dev
pnpm build
pnpm preview
```

### Database
```bash
# MongoDB
mongosh
> use lzy
> db.video_metadata.find({ user_id: "user-uuid" })
> db.video_metadata.createIndex({ "user_id": 1 })

# PostgreSQL
psql postgres://user:pass@localhost:5500/lzy
> SELECT * FROM users WHERE email = 'user@example.com';
```

---

## API Request Examples

### Generate Video
```bash
curl -X POST http://localhost:8888/api/v1/lzy-svc/videos/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "prompt=Amazing AI facts" \
  -F "duration=30" \
  -F "background_type=video" \
  -F "background_source=pexels"
```

### Get User Videos
```bash
curl http://localhost:8888/api/v1/lzy-svc/videos?limit=20&skip=0 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Google Login
```bash
curl -X POST http://localhost:8888/api/v1/lzy-svc/auth/google-login \
  -H "Content-Type: application/json" \
  -d '{"id_token": "google-id-token-here"}'
```

---

## Troubleshooting

### Python Service Issues
```bash
# Check if service is running
curl http://localhost:9999/health

# Check task status
curl http://localhost:9999/status/TASK_ID

# View logs
tail -f /tmp/lzy-director.log
```

### Go Service Issues
```bash
# Check if service is running
curl http://localhost:8888/api/v1/lzy-svc/health

# Check MongoDB connection
mongosh
> use lzy
> db.video_metadata.countDocuments()

# Check PostgreSQL connection
psql postgres://user:pass@localhost:5500/lzy
> SELECT count(*) FROM users;
```

### Frontend Issues
```bash
# Check API connectivity
curl http://localhost:8888/api/v1/lzy-svc/health

# Clear localStorage
localStorage.clear()

# Check browser console for errors
```

---

## File Locations

### Python Service
```
backend/lzy-director/
├── app/main.py                    # Entry point
├── app/video_gen/generator.py     # Main orchestrator
├── app/video_gen/makers/          # Video creators
│   ├── shorts_maker_V.py         # Video backgrounds
│   ├── shorts_maker_I.py         # Image backgrounds
│   ├── content_generator.py      # OpenAI scripts
│   └── thumbnail.py              # Thumbnail generation
└── app/video_gen/helpers/         # Utilities
    ├── fetch.py                  # Pexels/Pixabay
    ├── image.py                  # HuggingFace/Unsplash
    ├── audio.py                  # TTS processing
    ├── text.py                   # Text clips
    └── renderer.py               # FFmpeg rendering
```

### Go Service
```
backend/lzy-svc/
├── cmd/lzy-svc/main.go           # Entry point
├── internal/
│   ├── config/config.go          # Environment config
│   ├── db/                       # Database connections
│   ├── models/                   # Data models
│   │   ├── user.go              # User model
│   │   └── video.go             # Video model (NEW)
│   ├── middleware/               # JWT auth
│   └── services/
│       ├── auth/                 # Authentication
│       ├── video/                # Video metadata (NEW)
│       ├── youtube/              # YouTube OAuth
│       └── storage/              # GCS operations
```

### Frontend
```
frontend/src/
├── services/api/                 # API clients (NEW)
│   ├── client.ts
│   ├── auth.ts
│   ├── youtube.ts
│   ├── video.ts
│   └── trending.ts
├── components/                   # React components
├── pages/                        # Route pages
├── contexts/                     # React contexts
└── hooks/                        # Custom hooks
```

---

## Quick Fixes

### Reset Database
```bash
# MongoDB
mongosh
> use lzy
> db.dropDatabase()

# PostgreSQL
psql postgres://user:pass@localhost:5500/lzy
> TRUNCATE users, youtube_credentials RESTART IDENTITY CASCADE;
```

### Clear Temp Files
```bash
# Python service temp files
rm -rf /tmp/lzy-director/*
rm -rf /tmp/generated_images/*
rm -rf /tmp/shorts_v_*
```

### Restart All Services
```bash
# Kill all
pkill -f "lzy-svc"
pkill -f "python.*main.py"
pkill -f "pnpm.*dev"

# Start Go
cd backend/lzy-svc && go run cmd/lzy-svc/main.go &

# Start Python
cd backend/lzy-director && python app/main.py &

# Start Frontend
cd frontend && pnpm dev &
```

---

## Performance Tips

1. **MongoDB Indexes** - Ensure all indexes are created
2. **Connection Pooling** - Already configured in Go service
3. **Video Generation** - Runs in background thread (non-blocking)
4. **Frontend** - Lazy loading enabled for routes
5. **Caching** - Consider adding Redis for frequently accessed data

---

## Security Checklist

- [x] No secrets in frontend code
- [x] Python service isolated (no auth/DB)
- [x] JWT authentication for protected routes
- [x] CORS configured properly
- [ ] API key for Python callbacks (TODO)
- [ ] Rate limiting (TODO)
- [ ] Input validation (TODO)
- [ ] Video file validation (TODO)
