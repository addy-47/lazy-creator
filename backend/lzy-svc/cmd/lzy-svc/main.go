package main

import (
	"log"
	"net/http"

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
	authHandler := auth.NewAuthHandler(jwtSvc, firebaseSvc)
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

			yt.GET("/status", func(c *gin.Context) {
				userID := c.GetString("userID")
				authStatus := ytSvc.CheckAuthStatus(c.Request.Context(), userID)
				c.JSON(http.StatusOK, gin.H{
					"status":        "success",
					"authenticated": authStatus,
					"is_connected":  authStatus,
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
