package main

import (
	"log"
	"net/http"


	"github.com/addy-47/lazy-creator/lazy-svc/internal/config"
	"github.com/addy-47/lazy-creator/lazy-svc/internal/db"
	"github.com/addy-47/lazy-creator/lazy-svc/internal/middleware"
	"github.com/addy-47/lazy-creator/lazy-svc/internal/services/auth"
	"github.com/addy-47/lazy-creator/lazy-svc/internal/services/storage"
	"github.com/addy-47/lazy-creator/lazy-svc/internal/services/video"
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
	googleOAuthSvc, err := auth.NewGoogleOAuthService(cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.GoogleRedirectURI)
	if err != nil {
		log.Fatalf("Failed to initialize Google OAuth service: %v", err)
	}
	authHandler := auth.NewAuthHandler(jwtSvc, googleOAuthSvc)

	// YouTube Services
	ytOAuthSvc := auth.NewYouTubeOAuthService(cfg)
	ytHandler := youtube.NewYouTubeHandler(ytOAuthSvc)

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
		v1.POST("/auth/google-login", authHandler.GoogleLogin)
		v1.GET("/auth/google-url", authHandler.GetGoogleAuthURL)
		v1.GET("/auth/google-callback", authHandler.GoogleAuthCallback)
		v1.GET("/youtube/auth-callback", ytHandler.AuthCallback)
		v1.POST("/auth/refresh", authHandler.RefreshToken)
		v1.POST("/auth/logout", authHandler.Logout)

		// Protected YouTube Routes
		yt := v1.Group("/youtube")
		yt.Use(middleware.AuthMiddleware(jwtSvc))
		{
			yt.GET("/auth-start", ytHandler.AuthStart)
			yt.GET("/channels", ytHandler.GetChannels)
			yt.GET("/status", ytHandler.GetStatus)
			yt.DELETE("/disconnect", ytHandler.AuthDisconnect)
			yt.POST("/upload", ytHandler.Upload)
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

		// Video and Python Callback Routes
		videoHandler := video.NewVideoHandler(cfg)

		// Public Video Callbacks (Internal use by engine)
		v1.POST("/video-complete", videoHandler.VideoComplete)
		v1.POST("/video-progress", videoHandler.VideoProgress)
		
		// Public Explore/Trending
		v1.GET("/youtube-trending-shorts", videoHandler.GetTrendingShorts)

		// Protected Video Routes
		videoGroup := v1.Group("/videos")
		videoGroup.Use(middleware.AuthMiddleware(jwtSvc))
		{
			videoGroup.GET("", videoHandler.GetUserVideos)
			videoGroup.GET("/status/:task_id", videoHandler.GetTaskStatus)
			videoGroup.POST("/generate", videoHandler.Generate)
			videoGroup.GET("/:id", videoHandler.GetVideo)
			videoGroup.DELETE("/:id", videoHandler.DeleteVideo)
		}
	}

	// 6. Start Server
	log.Printf("LZY-SVC Orchestrator starting on port %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Critical fail in server startup: %v", err)
	}
}
