# Lazy Creator Architecture - Phase 3

## Service Separation & Video Metadata Management

---

## Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Frontend      │         │   Go Service     │         │  Python Service │
│   (React+TS)    │◄───────►│   (lzy-svc)      │◄───────►│  (lzy-director) │
│                 │  REST   │   Port: 8888     │  REST   │  Port: 9999     │
└─────────────────┘         └──────────────────┘         └─────────────────┘
         │                           │                            │
         │                           ▼                            │
         │                    ┌──────────────┐                    │
         │                    │  PostgreSQL  │                    │
         │                    │  (Users,     │                    │
         │                    │   YouTube)   │                    │
         │                    └──────────────┘                    │
         │                           │                            │
         │                    ┌──────────────┐                    │
         └───────────────────►│   MongoDB    │◄───────────────────┘
                              │  (Videos)    │
                              └──────────────┘
```

---

## Service Responsibilities

### 1. **Python Service (lzy-director)** - Video Generation Engine

**Purpose**: Stateless video generation pipeline

**Responsibilities**:
- ✅ Generate video content using AI (OpenAI GPT-4o-mini)
- ✅ Fetch background videos/images (Pexels, Pixabay)
- ✅ Generate AI images (Hugging Face, Unsplash)
- ✅ Create text-to-speech audio (Google Cloud TTS, gTTS)
- ✅ Composite video sections with text overlays
- ✅ Render final video using FFmpeg
- ✅ Generate thumbnails
- ❌ **NO authentication**
- ❌ **NO database connections**
- ❌ **NO cloud storage uploads**
- ❌ **NO user management**

**Key Changes**:
- Removed `google-cloud-storage` dependency
- Removed `google-cloud-secret-manager` dependency
- Removed `pymongo` dependency
- Removed `PyJWT` dependency
- Removed `secrets.py` (GCP Secret Manager)
- Fixed broken `storage` import in `image.py`
- Added callback to Go service on video completion
- Added download endpoints for Go service to fetch files

**New Endpoints**:
```
GET  /health                          - Health check
POST /generate                        - Start video generation
GET  /status/:task_id                 - Get generation progress
GET  /download/:task_id/video         - Download video file
GET  /download/:task_id/thumbnail     - Download thumbnail file
```

**Callback to Go Service**:
```python
POST {ORCHESTRATOR_URL}/api/v1/lzy-director/video-complete
{
  "task_id": "uuid",
  "status": "completed",
  "video_path": "/tmp/...",
  "thumbnail_path": "/tmp/...",
  "metadata": {
    "title": "...",
    "description": "...",
    "script": "...",
    "duration_seconds": 30.5,
    "resolution": [1080, 1920],
    "fps": 30,
    "background_type": "video",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

---

### 2. **Go Service (lzy-svc)** - Orchestrator & API Gateway

**Purpose**: Central orchestrator handling auth, metadata, and external integrations

**Responsibilities**:
- ✅ User authentication (JWT, Google OAuth, Firebase)
- ✅ YouTube OAuth integration
- ✅ Video metadata management (MongoDB)
- ✅ User data management (PostgreSQL)
- ✅ Cloud storage management (GCS)
- ✅ File upload/download signed URLs
- ✅ Video generation task initiation
- ✅ Video metadata storage on completion

**New Services**:
- `internal/services/video/video_service.go` - MongoDB operations
- `internal/services/video/video_handler.go` - HTTP handlers
- `internal/models/video.go` - Video metadata models

**New Endpoints**:
```
# Video Management (Protected)
GET  /api/v1/lzy-svc/videos              - Get user's videos
GET  /api/v1/lzy-svc/videos/:id          - Get specific video
DELETE /api/v1/lzy-svc/videos/:id        - Delete video
POST /api/v1/lzy-svc/videos/generate     - Start video generation

# Python Service Callbacks (No auth - use API key in production)
POST /api/v1/lzy-svc/lzy-director/video-complete  - Video completion
POST /api/v1/lzy-svc/lzy-director/video-progress  - Progress update
```

---

### 3. **MongoDB** - Video Metadata Store

**Purpose**: Store unstructured video metadata with flexible schema

**Collection**: `video_metadata`

**Schema**:
```javascript
{
  _id: ObjectId,
  task_id: "uuid-from-go-service",      // Unique, indexed
  user_id: "user-uuid",                  // Indexed
  status: "completed",                   // queued|processing|completed|failed|cancelled
  progress: 100,                         // 0-100
  
  // Video Information
  title: "Amazing AI Facts",
  description: "Check out these amazing facts...",
  script: "Full narration script...",
  duration_seconds: 30.5,
  
  // File Paths
  video_path: "videos/user-id/video.mp4",
  thumbnail_path: "thumbnails/user-id/thumb.jpg",
  
  // Properties
  resolution: [1080, 1920],
  fps: 30,
  background_type: "video",              // "video" or "image"
  background_source: "pexels",
  
  // AI Details
  prompt: "Amazing AI facts",
  ai_model: "gpt-4o-mini",
  
  // Timestamps
  created_at: ISODate,
  updated_at: ISODate,
  completed_at: ISODate,
  
  // Error Info
  error_message: null,
  
  // YouTube Integration
  youtube_video_id: null,
  youtube_url: null,
  uploaded_at: null
}
```

**Indexes**:
- `user_id` - Fast user video lookups
- `task_id` (unique) - Fast task lookups
- `status` - Filter by status
- `user_id + created_at` (compound) - User videos sorted by date

---

### 4. **PostgreSQL** - Structured Data

**Purpose**: Store structured relational data

**Tables**:
- `users` - User accounts
- `youtube_credentials` - YouTube OAuth tokens

**NO video metadata** - All video data is in MongoDB

---

## Video Generation Flow

### Complete Workflow

```
1. User (Frontend)
   └─► POST /api/v1/lzy-svc/videos/generate
       Body: { prompt, duration, background_type }

2. Go Service (lzy-svc)
   ├─► Validate authentication
   ├─► Create video metadata in MongoDB
   │   Status: "queued"
   ├─► Forward request to Python service
   └─► Return task_id to frontend

3. Python Service (lzy-director)
   ├─► Generate video content
   ├─► Update progress via callback
   │   POST /api/v1/lzy-svc/lzy-director/video-progress
   ├─► Render final video
   ├─► Notify Go service on completion
   │   POST /api/v1/lzy-svc/lzy-director/video-complete
   └─► Keep video files accessible

4. Go Service (lzy-svc)
   ├─► Receive completion callback
   ├─► Update MongoDB status to "completed"
   ├─► Fetch video files from Python service
   │   GET /download/:task_id/video
   │   GET /download/:task_id/thumbnail
   ├─► Upload to GCS (optional)
   └─► Update file paths in MongoDB

5. Frontend
   ├─► Poll for status
   │   GET /api/v1/lzy-svc/videos/:id
   └─► Display completed video
```

---

## Environment Variables

### Python Service (.env)
```bash
# Server
PORT=9999

# AI Services
OPENAI_API_KEY=sk-...

# Stock Media
PEXELS_API_KEY=...
PIXABAY_API_KEY=...
UNSPLASH_API_KEY=...

# Hugging Face
HUGGINGFACE_API_KEY=hf_...
HF_MODEL=stabilityai/stable-diffusion-xl-base-1.0

# TTS
GOOGLE_APPLICATION_CREDENTIALS=/path/to/gcp-creds.json
USE_GOOGLE_TTS=true
GOOGLE_VOICE=en-US-Neural2-D

# Storage
TEMP_DIR=/tmp

# Orchestrator Callback
ORCHESTRATOR_URL=http://localhost:8888
```

### Go Service (.env)
```bash
# Server
PORT=8888
GIN_MODE=release

# Auth
SECRET_KEY=your-secret-key
TOKEN_EXPIRATION_SECONDS=2592000

# Databases
POSTGRES_URI=postgres://user:pass@localhost:5432/lzy
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=lzy

# URLs
FRONTEND_URL=http://localhost:5555
PYTHON_DIRECTOR_URL=http://localhost:9999

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:8888/api/v1/lzy-svc/auth/google-callback

# YouTube OAuth
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_REDIRECT_URI=http://localhost:8888/api/v1/lzy-svc/youtube/auth-callback

# GCS
GCP_PROJECT_ID=your-project
GCS_BUCKET_NAME=your-bucket
GOOGLE_APPLICATION_CREDENTIALS=/path/to/gcp-creds.json
```

---

## API Reference

### Go Service - Video Management

#### Get User's Videos
```http
GET /api/v1/lzy-svc/videos?limit=20&skip=0
Authorization: Bearer <token>

Response:
{
  "status": "success",
  "videos": [...],
  "pagination": {
    "total": 50,
    "limit": 20,
    "skip": 0
  }
}
```

#### Get Specific Video
```http
GET /api/v1/lzy-svc/videos/:id
Authorization: Bearer <token>

Response:
{
  "status": "success",
  "video": {
    "id": "...",
    "task_id": "...",
    "title": "...",
    "status": "completed",
    ...
  }
}
```

#### Delete Video
```http
DELETE /api/v1/lzy-svc/videos/:id
Authorization: Bearer <token>

Response:
{
  "status": "success",
  "message": "Video deleted successfully"
}
```

#### Generate Video
```http
POST /api/v1/lzy-svc/videos/generate
Authorization: Bearer <token>
Content-Type: multipart/form-data

FormData:
- prompt: "Amazing AI facts"
- duration: 30
- background_type: "video"
- background_source: "pexels"

Response:
{
  "status": "success",
  "task_id": "uuid-here",
  "message": "Video generation started"
}
```

### Python Service - Video Generation

#### Start Generation
```http
POST /generate
Content-Type: multipart/form-data

FormData:
- prompt: "Amazing AI facts"
- duration: 30
- background_type: "video"
- background_source: "pexels"

Response:
{
  "status": "started",
  "task_id": "uuid-here"
}
```

#### Get Status
```http
GET /status/:task_id

Response:
{
  "status": "processing",
  "progress": 45,
  "message": "Generating background clips",
  "remaining": 120.5
}
```

#### Download Video
```http
GET /download/:task_id/video

Response: Video file (video/mp4)
```

#### Download Thumbnail
```http
GET /download/:task_id/thumbnail

Response: Image file (image/jpeg)
```

---

## Security Considerations

### Current Implementation
- ✅ Go service handles all authentication
- ✅ Python service is stateless and isolated
- ✅ MongoDB only stores video metadata
- ✅ PostgreSQL stores user data and credentials
- ✅ No secrets in frontend code

### Future Improvements
1. **API Key Authentication** for Python service callbacks
   ```bash
   # Add to Go service
   PYTHON_SERVICE_API_KEY=secure-random-key
   
   # Add to Python service
   ORCHESTRATOR_API_KEY=secure-random-key
   
   # Include in callback headers
   Authorization: Bearer <PYTHON_SERVICE_API_KEY>
   ```

2. **File Cleanup** - Implement automatic temp file deletion
3. **Rate Limiting** - Add rate limiting to video generation
4. **Video Encryption** - Encrypt videos at rest in GCS

---

## Migration Guide

### Database Migration
```sql
-- PostgreSQL: No changes needed (users, youtube_credentials only)

-- MongoDB: Create indexes
db.video_metadata.createIndex({ "user_id": 1 })
db.video_metadata.createIndex({ "task_id": 1 }, { unique: true })
db.video_metadata.createIndex({ "status": 1 })
db.video_metadata.createIndex({ "user_id": 1, "created_at": -1 })
```

### Code Changes Required

#### Frontend
- Update API calls to use new `/videos` endpoints
- Handle video metadata from MongoDB
- Update polling to check Go service status

#### Python Service
- ✅ Removed GCS dependencies
- ✅ Added orchestrator callback
- ✅ Added download endpoints

#### Go Service
- ✅ Added video metadata models
- ✅ Added MongoDB service
- ✅ Added video routes
- ⏳ Implement video generation initiation
- ⏳ Implement file fetching from Python service

---

## Testing Checklist

- [ ] Test video generation flow end-to-end
- [ ] Test MongoDB indexing and queries
- [ ] Test callback from Python to Go service
- [ ] Test file download from Python service
- [ ] Test user isolation (users can't see each other's videos)
- [ ] Test error handling (failed video generation)
- [ ] Test progress updates
- [ ] Test video deletion
- [ ] Load test with concurrent video generations

---

## Performance Optimizations

1. **MongoDB Indexes** - All critical fields indexed
2. **Connection Pooling** - MongoDB and PostgreSQL pooled
3. **Async Processing** - Video generation in background
4. **Progress Callbacks** - Real-time progress updates
5. **File Streaming** - Direct file streaming from Python service

---

## Conclusion

This architecture provides:
- ✅ **Clear separation of concerns** - Python for video, Go for orchestration
- ✅ **Scalability** - Stateless Python service can scale horizontally
- ✅ **Security** - Auth handled by Go, no secrets in Python
- ✅ **Flexibility** - MongoDB schema adapts to changing requirements
- ✅ **Maintainability** - Clean service boundaries

All video metadata is now properly stored in MongoDB with relationships to users in PostgreSQL, and the Python service is a pure video generation engine with no external dependencies beyond AI/media APIs.
