package video

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/addy-47/lazy-creator/lazy-svc/internal/db"
	"github.com/addy-47/lazy-creator/lazy-svc/internal/models"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// VideoService handles video metadata operations in MongoDB
type VideoService struct {
	collection *mongo.Collection
}

// NewVideoService creates a new video metadata service
func NewVideoService() *VideoService {
	collection := db.MongoDB.Collection("video_metadata")

	// Create indexes for better query performance
	createIndexes(context.Background(), collection)

	return &VideoService{
		collection: collection,
	}
}

// createIndexes creates MongoDB indexes for efficient queries
func createIndexes(ctx context.Context, collection *mongo.Collection) {
	// Index on user_id for fast user video lookups
	indexModel := mongo.IndexModel{
		Keys: bson.D{
			{Key: "user_id", Value: 1},
		},
	}
	_, err := collection.Indexes().CreateOne(ctx, indexModel)
	if err != nil {
		log.Printf("Failed to create user_id index: %v", err)
	}

	// Index on task_id for fast task lookups
	indexModel = mongo.IndexModel{
		Keys: bson.D{
			{Key: "task_id", Value: 1},
		},
		Options: options.Index().SetUnique(true),
	}
	_, err = collection.Indexes().CreateOne(ctx, indexModel)
	if err != nil {
		log.Printf("Failed to create task_id index: %v", err)
	}

	// Index on status for filtering by status
	indexModel = mongo.IndexModel{
		Keys: bson.D{
			{Key: "status", Value: 1},
		},
	}
	_, err = collection.Indexes().CreateOne(ctx, indexModel)
	if err != nil {
		log.Printf("Failed to create status index: %v", err)
	}

	// Compound index for user videos sorted by date
	indexModel = mongo.IndexModel{
		Keys: bson.D{
			{Key: "user_id", Value: 1},
			{Key: "created_at", Value: -1},
		},
	}
	_, err = collection.Indexes().CreateOne(ctx, indexModel)
	if err != nil {
		log.Printf("Failed to create compound index: %v", err)
	}

	log.Println("MongoDB indexes created/verified successfully")
}

// CreateVideo creates a new video metadata record
func (s *VideoService) CreateVideo(ctx context.Context, video *models.VideoMetadata) error {
	video.CreatedAt = time.Now()
	video.UpdatedAt = time.Now()

	result, err := s.collection.InsertOne(ctx, video)
	if err != nil {
		return fmt.Errorf("failed to insert video metadata: %w", err)
	}

	if oid, ok := result.InsertedID.(bson.ObjectID); ok {
		video.ID = oid
		log.Printf("Created video metadata for task %s with ID %s", video.TaskID, video.ID.Hex())
	}
	return nil
}

// GetByTaskID retrieves video metadata by task ID
func (s *VideoService) GetByTaskID(ctx context.Context, taskID string) (*models.VideoMetadata, error) {
	var video models.VideoMetadata

	err := s.collection.FindOne(ctx, bson.M{"task_id": taskID}).Decode(&video)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("video not found for task %s", taskID)
		}
		return nil, fmt.Errorf("failed to get video: %w", err)
	}

	return &video, nil
}

// GetByID retrieves video metadata by MongoDB ID
func (s *VideoService) GetByID(ctx context.Context, id string) (*models.VideoMetadata, error) {
	objectID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		return nil, fmt.Errorf("invalid video ID: %w", err)
	}

	var video models.VideoMetadata
	err = s.collection.FindOne(ctx, bson.M{"_id": objectID}).Decode(&video)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("video not found")
		}
		return nil, fmt.Errorf("failed to get video: %w", err)
	}

	return &video, nil
}

// GetUserVideos retrieves all videos for a user with pagination
func (s *VideoService) GetUserVideos(ctx context.Context, userID string, limit, skip int) ([]models.VideoMetadata, error) {
	opts := options.Find().
		SetLimit(int64(limit)).
		SetSkip(int64(skip)).
		SetSort(bson.D{{Key: "created_at", Value: -1}})

	cursor, err := s.collection.Find(ctx, bson.M{"user_id": userID}, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to query videos: %w", err)
	}
	defer cursor.Close(ctx)

	var videos []models.VideoMetadata
	if err := cursor.All(ctx, &videos); err != nil {
		return nil, fmt.Errorf("failed to decode videos: %w", err)
	}

	return videos, nil
}

// UpdateStatus updates the status and progress of a video
func (s *VideoService) UpdateStatus(ctx context.Context, taskID string, status models.VideoStatus, progress int) error {
	update := bson.M{
		"$set": bson.M{
			"status":     status,
			"progress":   progress,
			"updated_at": time.Now(),
		},
	}

	if status == models.VideoStatusCompleted {
		now := time.Now()
		update["$set"].(bson.M)["completed_at"] = &now
	}

	result, err := s.collection.UpdateOne(ctx, bson.M{"task_id": taskID}, update)
	if err != nil {
		return fmt.Errorf("failed to update status: %w", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("video not found for task %s", taskID)
	}

	log.Printf("Updated video %s status to %s, progress %d", taskID, status, progress)
	return nil
}

// UpdateProgress updates only the progress of a video
func (s *VideoService) UpdateProgress(ctx context.Context, taskID string, progress int, message string) error {
	update := bson.M{
		"$set": bson.M{
			"progress":   progress,
			"updated_at": time.Now(),
		},
	}

	if message != "" {
		update["$set"].(bson.M)["message"] = message
	}

	result, err := s.collection.UpdateOne(ctx, bson.M{"task_id": taskID}, update)
	if err != nil {
		return fmt.Errorf("failed to update progress: %w", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("video not found for task %s", taskID)
	}

	return nil
}

// CompleteVideo marks a video as completed with file paths
func (s *VideoService) CompleteVideo(ctx context.Context, taskID, videoPath, thumbnailPath string, metadata *models.VideoMetadataPayload) error {
	var parsedTime time.Time
	var err error

	if metadata.CreatedAt != "" {
		parsedTime, err = time.Parse(time.RFC3339, metadata.CreatedAt)
		if err != nil {
			parsedTime = time.Now()
		}
	} else {
		parsedTime = time.Now()
	}

	update := bson.M{
		"$set": bson.M{
			"status":           models.VideoStatusCompleted,
			"progress":         100,
			"video_path":       videoPath,
			"thumbnail_path":   thumbnailPath,
			"title":            metadata.Title,
			"description":      metadata.Description,
			"script":           metadata.Script,
			"duration_seconds": metadata.DurationSeconds,
			"resolution":       metadata.Resolution,
			"fps":              metadata.FPS,
			"background_type":  metadata.BackgroundType,
			"completed_at":     parsedTime,
			"updated_at":       time.Now(),
		},
	}

	result, err := s.collection.UpdateOne(ctx, bson.M{"task_id": taskID}, update)
	if err != nil {
		return fmt.Errorf("failed to complete video: %w", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("video not found for task %s", taskID)
	}

	log.Printf("Completed video %s: %s", taskID, videoPath)
	return nil
}

// FailVideo marks a video as failed with error message
func (s *VideoService) FailVideo(ctx context.Context, taskID, errorMessage string) error {
	update := bson.M{
		"$set": bson.M{
			"status":        models.VideoStatusFailed,
			"error_message": errorMessage,
			"updated_at":    time.Now(),
		},
	}

	result, err := s.collection.UpdateOne(ctx, bson.M{"task_id": taskID}, update)
	if err != nil {
		return fmt.Errorf("failed to mark video as failed: %w", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("video not found for task %s", taskID)
	}

	log.Printf("Marked video %s as failed: %s", taskID, errorMessage)
	return nil
}

// DeleteVideo deletes a video metadata record
func (s *VideoService) DeleteVideo(ctx context.Context, taskID string) error {
	result, err := s.collection.DeleteOne(ctx, bson.M{"task_id": taskID})
	if err != nil {
		return fmt.Errorf("failed to delete video: %w", err)
	}

	if result.DeletedCount == 0 {
		return fmt.Errorf("video not found for task %s", taskID)
	}

	log.Printf("Deleted video metadata for task %s", taskID)
	return nil
}

// UpdateYouTubeInfo updates YouTube upload information
func (s *VideoService) UpdateYouTubeInfo(ctx context.Context, taskID, youtubeVideoID, youtubeURL string) error {
	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"youtube_video_id": youtubeVideoID,
			"youtube_url":      youtubeURL,
			"uploaded_at":      now,
			"updated_at":       now,
		},
	}

	result, err := s.collection.UpdateOne(ctx, bson.M{"task_id": taskID}, update)
	if err != nil {
		return fmt.Errorf("failed to update YouTube info: %w", err)
	}

	if result.MatchedCount == 0 {
		return fmt.Errorf("video not found for task %s", taskID)
	}

	log.Printf("Updated YouTube info for video %s: %s", taskID, youtubeURL)
	return nil
}

// GetCountByStatus returns the count of videos with a specific status
func (s *VideoService) GetCountByStatus(ctx context.Context, status models.VideoStatus) (int64, error) {
	count, err := s.collection.CountDocuments(ctx, bson.M{"status": status})
	if err != nil {
		return 0, fmt.Errorf("failed to count videos: %w", err)
	}

	return count, nil
}

// GetUserVideoCount returns the total count of videos for a user
func (s *VideoService) GetUserVideoCount(ctx context.Context, userID string) (int64, error) {
	count, err := s.collection.CountDocuments(ctx, bson.M{"user_id": userID})
	if err != nil {
		return 0, fmt.Errorf("failed to count user videos: %w", err)
	}

	return count, nil
}
