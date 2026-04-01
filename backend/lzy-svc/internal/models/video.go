package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// VideoStatus represents the current state of video generation
type VideoStatus string

const (
	VideoStatusQueued     VideoStatus = "queued"
	VideoStatusProcessing VideoStatus = "processing"
	VideoStatusCompleted  VideoStatus = "completed"
	VideoStatusFailed     VideoStatus = "failed"
	VideoStatusCancelled  VideoStatus = "cancelled"
)

// VideoMetadata represents a generated video in MongoDB
type VideoMetadata struct {
	ID       bson.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	TaskID   string        `bson:"task_id" json:"task_id"`   // From Go orchestrator
	UserID   string        `bson:"user_id" json:"user_id"`   // Owner of the video
	Status   VideoStatus   `bson:"status" json:"status"`     // Current status
	Progress int           `bson:"progress" json:"progress"` // 0-100 progress percentage

	// Video Information
	Title           string  `bson:"title" json:"title"`
	Description     string  `bson:"description" json:"description"`
	Script          string  `bson:"script" json:"script"`                     // Full script text
	DurationSeconds float64 `bson:"duration_seconds" json:"duration_seconds"` // Actual duration

	// File Paths (relative to storage)
	VideoPath     string `bson:"video_path" json:"video_path"`         // GCS path or local path
	ThumbnailPath string `bson:"thumbnail_path" json:"thumbnail_path"` // GCS path or local path

	// Video Properties
	Resolution       []int  `bson:"resolution" json:"resolution"` // [width, height]
	FPS              int    `bson:"fps" json:"fps"`
	BackgroundType   string `bson:"background_type" json:"background_type"`     // "video" or "image"
	BackgroundSource string `bson:"background_source" json:"background_source"` // "pexels", "pixabay", "custom"

	// AI Generation Details
	Prompt  string `bson:"prompt" json:"prompt"`     // Original user prompt
	AIModel string `bson:"ai_model" json:"ai_model"` // e.g., "gpt-4o-mini"

	// Timestamps
	CreatedAt   time.Time  `bson:"created_at" json:"created_at"`
	UpdatedAt   time.Time  `bson:"updated_at" json:"updated_at"`
	CompletedAt *time.Time `bson:"completed_at,omitempty" json:"completed_at,omitempty"`

	// Error Information
	ErrorMessage string `bson:"error_message,omitempty" json:"error_message,omitempty"`

	// YouTube Integration
	YouTubeVideoID string     `bson:"youtube_video_id,omitempty" json:"youtube_video_id,omitempty"`
	YouTubeURL     string     `bson:"youtube_url,omitempty" json:"youtube_url,omitempty"`
	UploadedAt     *time.Time `bson:"uploaded_at,omitempty" json:"uploaded_at,omitempty"`
}

// VideoCreationRequest represents the payload from Python service
type VideoCreationRequest struct {
	TaskID        string               `json:"task_id" binding:"required"`
	Status        string               `json:"status" binding:"required"`
	VideoPath     string               `json:"video_path"`
	ThumbnailPath string               `json:"thumbnail_path"`
	Metadata      VideoMetadataPayload `json:"metadata"`
}

// VideoMetadataPayload is nested in VideoCreationRequest
type VideoMetadataPayload struct {
	Title           string  `json:"title"`
	Description     string  `json:"description"`
	Script          string  `json:"script"`
	DurationSeconds float64 `json:"duration_seconds"`
	Resolution      []int   `json:"resolution"`
	FPS             int     `json:"fps"`
	BackgroundType  string  `json:"background_type"`
	CreatedAt       string  `json:"created_at"`
}

// VideoProgressUpdate represents progress update from Python service
type VideoProgressUpdate struct {
	TaskID           string  `json:"task_id" binding:"required"`
	Progress         int     `json:"progress"`
	Message          string  `json:"message"`
	RemainingSeconds float64 `json:"remaining_seconds"`
}

// VideoQuery represents query parameters for listing videos
type VideoQuery struct {
	UserID     string      `json:"user_id"`
	Status     VideoStatus `json:"status"`
	Limit      int         `json:"limit"`
	Skip       int         `json:"skip"`
	SortBy     string      `json:"sort_by"` // "created_at", "title", "duration"
	Descending bool        `json:"descending"`
}
