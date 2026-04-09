package video

import (
	"log"
	"net/http"
	"strconv"

	"github.com/addy-47/lazy-creator/lazy-svc/internal/config"
	"github.com/addy-47/lazy-creator/lazy-svc/internal/middleware"
	"github.com/addy-47/lazy-creator/lazy-svc/internal/models"
	"github.com/addy-47/lazy-creator/lazy-svc/internal/services/auth"
	"github.com/gin-gonic/gin"
	"fmt"
)

// VideoHandler handles HTTP requests for video operations
type VideoHandler struct {
	videoSvc *VideoService
}

// NewVideoHandler creates a new video handler
func NewVideoHandler(cfg *config.Config) *VideoHandler {
	return &VideoHandler{
		videoSvc: NewVideoService(cfg),
	}
}

// VideoCompleteRequest represents the callback from Python service
type VideoCompleteRequest struct {
	TaskID        string                     `json:"task_id" binding:"required"`
	Status        string                     `json:"status" binding:"required"`
	VideoPath     string                     `json:"video_path"`
	ThumbnailPath string                     `json:"thumbnail_path"`
	Metadata      models.VideoMetadataPayload `json:"metadata"`
}

// VideoComplete handles the video completion callback from Python service
func (h *VideoHandler) VideoComplete(c *gin.Context) {
	var req VideoCompleteRequest
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status": "error",
			"message": err.Error(),
		})
		return
	}

	ctx := c.Request.Context()

	// First, check if video metadata exists
	video, err := h.videoSvc.GetByTaskID(ctx, req.TaskID)
	
	if err != nil {
		// Video doesn't exist yet - this shouldn't happen as Go service creates it first
		log.Printf("Video not found for task %s, creating new record", req.TaskID)
		
		// Create new video record (fallback)
		video = &models.VideoMetadata{
			TaskID:         req.TaskID,
			UserID:         c.GetString("userID"), // Should be set by middleware
			Status:         models.VideoStatusCompleted,
			Progress:       100,
			VideoPath:      req.VideoPath,
			ThumbnailPath:  req.ThumbnailPath,
			Title:          req.Metadata.Title,
			Description:    req.Metadata.Description,
			Script:         req.Metadata.Script,
			DurationSeconds: req.Metadata.DurationSeconds,
			Resolution:     req.Metadata.Resolution,
			FPS:            req.Metadata.FPS,
			BackgroundType: req.Metadata.BackgroundType,
		}
		
		if err := h.videoSvc.CreateVideo(ctx, video); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status": "error",
				"message": "Failed to create video metadata",
			})
			return
		}
	} else {
		// Update existing video record
		if err := h.videoSvc.CompleteVideo(ctx, req.TaskID, req.VideoPath, req.ThumbnailPath, &req.Metadata); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status": "error",
				"message": "Failed to update video metadata",
			})
			return
		}
	}

	log.Printf("Video completion recorded for task %s", req.TaskID)

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"message": "Video completion recorded successfully",
		"video_id": video.ID.Hex(),
	})
}

// VideoProgress handles progress updates from Python service
func (h *VideoHandler) VideoProgress(c *gin.Context) {
	var req struct {
		TaskID         string  `json:"task_id" binding:"required"`
		Progress       int     `json:"progress"`
		Message        string  `json:"message"`
		RemainingSeconds float64 `json:"remaining_seconds"`
	}
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"status": "error",
			"message": err.Error(),
		})
		return
	}

	ctx := c.Request.Context()

	if err := h.videoSvc.UpdateProgress(ctx, req.TaskID, req.Progress, req.Message); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status": "error",
			"message": "Failed to update progress",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"message": "Progress updated",
	})
}

// GetVideo retrieves a specific video by ID
func (h *VideoHandler) GetVideo(c *gin.Context) {
	videoID := c.Param("id")
	
	ctx := c.Request.Context()
	video, err := h.videoSvc.GetByID(ctx, videoID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"status": "error",
			"message": "Video not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"video": video,
	})
}

// GetUserVideos retrieves all videos for the authenticated user
func (h *VideoHandler) GetUserVideos(c *gin.Context) {
	userID := c.GetString("userID")
	
	// Get pagination parameters
	limitStr := c.DefaultQuery("limit", "20")
	skipStr := c.DefaultQuery("skip", "0")
	
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 || limit > 100 {
		limit = 20
	}
	
	skip, err := strconv.Atoi(skipStr)
	if err != nil || skip < 0 {
		skip = 0
	}

	ctx := c.Request.Context()
	videos, err := h.videoSvc.GetUserVideos(ctx, userID, limit, skip)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status": "error",
			"message": "Failed to retrieve videos",
		})
		return
	}

	// Get total count for pagination
	totalCount, err := h.videoSvc.GetUserVideoCount(ctx, userID)
	if err != nil {
		totalCount = 0
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"videos": videos,
		"pagination": gin.H{
			"total": totalCount,
			"limit": limit,
			"skip":  skip,
		},
	})
}

// DeleteVideo deletes a video (soft delete or hard delete based on requirements)
func (h *VideoHandler) DeleteVideo(c *gin.Context) {
	videoID := c.Param("id")
	userID := c.GetString("userID")
	
	ctx := c.Request.Context()
	
	// First verify the video belongs to the user
	video, err := h.videoSvc.GetByID(ctx, videoID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"status": "error",
			"message": "Video not found",
		})
		return
	}
	
	if video.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{
			"status": "error",
			"message": "Access denied",
		})
		return
	}

	// Delete the video metadata
	// Note: Actual file deletion from storage should be handled separately
	if err := h.videoSvc.DeleteVideo(ctx, video.TaskID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status": "error",
			"message": "Failed to delete video",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"message": "Video deleted successfully",
	})
}

// Generate initiates video generation by forwarding to the Python engine
func (h *VideoHandler) Generate(c *gin.Context) {
	userID := c.GetString("userID")
	
	prompt := c.PostForm("prompt")
	if prompt == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"status": "error",
			"message": "Prompt is required",
		})
		return
	}

	durationStr := c.DefaultPostForm("duration", "25")
	duration, _ := strconv.Atoi(durationStr)
	
	backgroundType := c.DefaultPostForm("background_type", "video")
	backgroundSource := c.DefaultPostForm("background_source", "pexels")

	ctx := c.Request.Context()
	taskID, err := h.videoSvc.InitiateGeneration(ctx, userID, prompt, duration, backgroundType, backgroundSource)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status": "error",
			"message": fmt.Sprintf("Failed to initiate generation: %v", err),
		})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"status": "started",
		"task_id": taskID,
		"message": "Video generation task initiated",
	})
}

// GetTaskStatus retrieves the status of a video generation task from MongoDB
func (h *VideoHandler) GetTaskStatus(c *gin.Context) {
	taskID := c.Param("task_id")
	
	ctx := c.Request.Context()
	video, err := h.videoSvc.GetByTaskID(ctx, taskID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"status": "error",
			"message": "Task not found",
		})
		return
	}

	c.JSON(http.StatusOK, video)
}

// SetupVideoRoutes configures video routes in the Gin router
func SetupVideoRoutes(r *gin.RouterGroup, cfg *config.Config, jwtSvc *auth.JWTService) {
	handler := NewVideoHandler(cfg)
	
	// Public endpoint for Python service callback
	r.POST("/video-complete", handler.VideoComplete)
	r.POST("/video-progress", handler.VideoProgress)
	
	// Protected endpoints (require authentication)
	protected := r.Group("/")
	protected.Use(middleware.AuthMiddleware(jwtSvc))
	
	{
		protected.GET("/videos", handler.GetUserVideos)
		protected.GET("/videos/status/:task_id", handler.GetTaskStatus)
		protected.POST("/videos/generate", handler.Generate)
		protected.GET("/videos/:id", handler.GetVideo)
		protected.DELETE("/videos/:id", handler.DeleteVideo)
	}
}
