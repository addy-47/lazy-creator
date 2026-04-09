package youtube

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/addy-47/lazy-creator/lazy-svc/internal/services/auth"
	"github.com/gin-gonic/gin"
)

type YouTubeHandler struct {
	oauthSvc *auth.YouTubeOAuthService
}

func NewYouTubeHandler(oauthSvc *auth.YouTubeOAuthService) *YouTubeHandler {
	return &YouTubeHandler{
		oauthSvc: oauthSvc,
	}
}

// AuthStart returns the Google OAuth URL for YouTube
func (h *YouTubeHandler) AuthStart(c *gin.Context) {
	userID := c.GetString("userID")
	authURL := h.oauthSvc.GetAuthURL(userID)
	c.JSON(http.StatusOK, gin.H{
		"status":   "success",
		"auth_url": authURL,
	})
}

// AuthCallback handles the Google OAuth redirect
func (h *YouTubeHandler) AuthCallback(c *gin.Context) {
	state := c.Query("state")
	code := c.Query("code")

	if state == "" || code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing state or code"})
		return
	}

	// state format is "user-<userID>"
	userID := strings.TrimPrefix(state, "user-")
	if userID == state {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid state format"})
		return
	}

	_, err := h.oauthSvc.ExchangeCode(c.Request.Context(), code, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to exchange code: " + err.Error()})
		return
	}

	// Return a bridge page that notifies the opener and closes the popup
	c.Header("Content-Type", "text/html")
	html := `
	<!DOCTYPE html>
	<html>
	<head>
		<title>Authentication Successful</title>
		<style>
			body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f9fafb; color: #111827; }
			.card { background: white; padding: 2rem; border-radius: 1rem; shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); text-align: center; max-width: 400px; }
			h1 { color: #059669; margin-bottom: 0.5rem; }
			p { color: #4b5563; line-height: 1.5; }
			.loader { border: 3px solid #f3f3f3; border-top: 3px solid #059669; border-radius: 50%; width: 24px; height: 24px; animate: spin 1s linear infinite; margin: 1rem auto; }
			@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
		</style>
	</head>
	<body>
		<div class="card">
			<h1>Connected!</h1>
			<p>Your YouTube account has been successfully linked.</p>
			<div class="loader"></div>
			<p style="font-size: 0.875rem;">Closing this window...</p>
		</div>
		<script>
			// Send message to the main window
			if (window.opener) {
				window.opener.postMessage({ 
					type: 'YOUTUBE_AUTH_SUCCESS', 
					status: 'success' 
				}, "*");
				setTimeout(() => window.close(), 1000);
			} else {
				// Fallback if not opened in a popup
				setTimeout(() => {
					window.location.href = "/gallery";
				}, 2000);
			}
		</script>
	</body>
	</html>
	`
	c.String(http.StatusOK, html)
}

// AuthDisconnect unlinks the YouTube account
func (h *YouTubeHandler) AuthDisconnect(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	err := h.oauthSvc.UnlinkYouTube(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unlink YouTube account"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "YouTube account unlinked successfully"})
}

// GetChannels returns the user's YouTube channels
func (h *YouTubeHandler) GetChannels(c *gin.Context) {
	userID := c.GetString("userID")
	service, err := h.oauthSvc.GetYouTubeService(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "YouTube account not connected"})
		return
	}

	response, err := service.Channels.List([]string{"snippet", "contentDetails"}).Mine(true).Do()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to get channels: %v", err)})
		return
	}

	channels := make([]gin.H, 0, len(response.Items))
	for _, channel := range response.Items {
		channels = append(channels, gin.H{
			"id":          channel.Id,
			"title":       channel.Snippet.Title,
			"thumbnail":   channel.Snippet.Thumbnails.Default.Url,
			"subscribers": "hidden",
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"status":   "success",
		"channels": channels,
	})
}

// GetStatus checks if the user has connected YouTube
func (h *YouTubeHandler) GetStatus(c *gin.Context) {
	userID := c.GetString("userID")
	authStatus := h.oauthSvc.CheckAuthStatus(c.Request.Context(), userID)
	c.JSON(http.StatusOK, gin.H{
		"status":        "success",
		"authenticated": authStatus,
		"is_connected":  authStatus,
	})
}

// Upload is a placeholder for YouTube video upload
func (h *YouTubeHandler) Upload(c *gin.Context) {
	userID := c.GetString("userID")

	_, err := h.oauthSvc.GetYouTubeService(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "YouTube account not connected"})
		return
	}

	videoURL := c.Query("video_url")
	if videoURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "video_url required"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    "success",
		"message":   "Upload endpoint ready - implementation pending",
		"video_url": videoURL,
	})
}
