package main

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/addy-47/lazy-creator/lazy-svc/internal/config"
	"github.com/addy-47/lazy-creator/lazy-svc/internal/db"
	"github.com/addy-47/lazy-creator/lazy-svc/internal/middleware"
	"github.com/addy-47/lazy-creator/lazy-svc/internal/services/auth"
	"github.com/addy-47/lazy-creator/lazy-svc/internal/services/storage"
	"github.com/addy-47/lazy-creator/lazy-svc/internal/services/youtube"
	"github.com/gin-gonic/gin"
)

func main() {
	// 1. Initialize Config
	cfg := config.LoadConfig()

	// 2. Initialize Databases
	// Ensure DBs are reachable (Pinged inside Init)
	db.InitPostgres(cfg)
	db.InitMongoDB(cfg)

	// 3. Initialize Services
	jwtSvc := auth.NewJWTService(cfg)
	firebaseSvc, err := auth.NewFirebaseService()
	if err != nil {
		log.Fatalf("Failed to initialize Firebase service: %v", err)
	}
	googleOAuthSvc, err := auth.NewGoogleOAuthService(cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.GoogleRedirectURI)
	if err != nil {
		log.Fatalf("Failed to initialize Google OAuth service: %v", err)
	}
	authHandler := auth.NewAuthHandler(jwtSvc, firebaseSvc, googleOAuthSvc)
	ytSvc := youtube.NewOAuthService(cfg)
	storageSvc, err := storage.NewStorageService(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize storage service: %v", err)
	}

	// 4. Setup Gin
	gin.SetMode(cfg.GinMode)
	r := gin.Default()

	// Add Global Recovery and Logger
	r.Use(gin.Recovery())
	r.Use(gin.Logger())

	// Standardize CORS
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", cfg.FrontendURL)
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, x-access-token, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// 5. Route Groups
	v1 := r.Group("/api/v1/lzy-svc")
	{
		// Public Health
		v1.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"status":  "ok",
				"service": "lzy-svc",
				"version": "v1.1.0", // Updated for Auth implementation
				"port":    cfg.Port,
			})
		})

		// Auth Routes
		v1.POST("/auth/register", authHandler.Register)
		v1.POST("/auth/login", authHandler.Login)
		v1.POST("/auth/firebase-login", authHandler.FirebaseLogin)
		v1.POST("/auth/google-login", authHandler.GoogleLogin)
		v1.GET("/auth/google-url", authHandler.GetGoogleAuthURL)
		v1.GET("/auth/google-callback", authHandler.GoogleAuthCallback)
		v1.POST("/auth/refresh", authHandler.RefreshToken)
		v1.POST("/auth/logout", authHandler.Logout)

		// Protected YouTube Routes
		yt := v1.Group("/youtube")
		yt.Use(middleware.AuthMiddleware(jwtSvc))
		{
			yt.GET("/auth-start", func(c *gin.Context) {
				userID := c.GetString("userID")
				authURL := ytSvc.GetAuthURL(userID)
				c.JSON(http.StatusOK, gin.H{
					"status":   "success",
					"auth_url": authURL,
				})
			})

			yt.GET("/auth-callback", func(c *gin.Context) {
				userID := c.GetString("userID")
				code := c.Query("code")
				if code == "" {
					c.JSON(http.StatusBadRequest, gin.H{"error": "authorization code required"})
					return
				}

				token, err := ytSvc.ExchangeCode(c.Request.Context(), code, userID)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to exchange code: %v", err)})
					return
				}

				c.JSON(http.StatusOK, gin.H{
					"status":     "success",
					"message":    "YouTube account connected successfully",
					"token_type": token.TokenType,
					"expires_in": token.Expiry.Sub(time.Now()).Seconds(),
				})
			})

			yt.GET("/channels", func(c *gin.Context) {
				userID := c.GetString("userID")
				service, err := ytSvc.GetYouTubeService(c.Request.Context(), userID)
				if err != nil {
					c.JSON(http.StatusUnauthorized, gin.H{"error": "YouTube account not connected"})
					return
				}

				// Get channel information
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
						"subscribers": "hidden", // YouTube API v3 doesn't return subscriber count without additional permissions
					})
				}

				c.JSON(http.StatusOK, gin.H{
					"status":   "success",
					"channels": channels,
				})
			})

			yt.GET("/status", func(c *gin.Context) {
				userID := c.GetString("userID")
				authStatus := ytSvc.CheckAuthStatus(c.Request.Context(), userID)
				c.JSON(http.StatusOK, gin.H{
					"status":        "success",
					"authenticated": authStatus,
					"is_connected":  authStatus,
				})
			})

			yt.POST("/upload", func(c *gin.Context) {
				userID := c.GetString("userID")

				// Get YouTube service
				_, err := ytSvc.GetYouTubeService(c.Request.Context(), userID)
				if err != nil {
					c.JSON(http.StatusUnauthorized, gin.H{"error": "YouTube account not connected"})
					return
				}

				// Get upload URL from query or request body
				videoURL := c.Query("video_url")
				if videoURL == "" {
					c.JSON(http.StatusBadRequest, gin.H{"error": "video_url required"})
					return
				}

				// TODO: Implement actual YouTube upload logic
				// This would download the video from GCS and upload to YouTube
				c.JSON(http.StatusOK, gin.H{
					"status":    "success",
					"message":   "Upload endpoint ready - implementation pending",
					"video_url": videoURL,
				})
			})
		}

		// Storage Routes
		st := v1.Group("/storage")
		st.Use(middleware.AuthMiddleware(jwtSvc))
		{
			st.GET("/upload-url", func(c *gin.Context) {
				filename := c.Query("filename")
				if filename == "" {
					c.JSON(http.StatusBadRequest, gin.H{"error": "filename required"})
					return
				}
				url, err := storageSvc.GenerateSignedUploadURL(filename)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				c.JSON(http.StatusOK, gin.H{"status": "success", "upload_url": url})
			})

			st.GET("/download-url", func(c *gin.Context) {
				filename := c.Query("filename")
				if filename == "" {
					c.JSON(http.StatusBadRequest, gin.H{"error": "filename required"})
					return
				}
				url, err := storageSvc.GenerateSignedDownloadURL(filename)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				c.JSON(http.StatusOK, gin.H{"status": "success", "download_url": url})
			})
		}
	}

	// 6. Start Server
	log.Printf("LZY-SVC Orchestrator starting on port %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Critical fail in server startup: %v", err)
	}
}
