package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port         string
	GinMode      string
	SecretKey    string
	TokenExpiry  int
	MongoDBURI   string
	MongoDBName  string
	PostgresURI  string
	FrontendURL  string
	DirectorURL  string
	GCPProjectID string
	GCSBucket    string
	GSCreds      string

	// YouTube OAuth
	YoutubeClientID     string
	YoutubeClientSecret string

	// Google OAuth (Shared for Social Login and YouTube)
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURI  string
	YoutubeRedirectURI string
	GoogleSecretFile   string
}

func LoadConfig() *Config {
	// Load .env if it exists
	if err := godotenv.Load(".env"); err != nil {
		log.Println("No .env file found, relying on system environment variables")
	}

	tokenExpiry, _ := strconv.Atoi(getEnv("TOKEN_EXPIRATION_SECONDS", "2592000"))

	return &Config{
		Port:         getEnv("PORT", "8888"),
		GinMode:      getEnv("GIN_MODE", "debug"),
		SecretKey:    getEnv("SECRET_KEY", "lazy-creator-secret-key-2024"),
		TokenExpiry:  tokenExpiry,
		MongoDBURI:   getEnv("MONGODB_URI", "mongodb://localhost:27000"),
		MongoDBName:  getEnv("MONGODB_DB_NAME", "lzy"),
		PostgresURI:  getEnv("POSTGRES_URI", "postgres://localhost:5500/lzy"),
		FrontendURL:  getEnv("FRONTEND_URL", "http://localhost:5555"),
		DirectorURL:  getEnv("DIRECTOR_URL", getEnv("PYTHON_DIRECTOR_URL", "http://localhost:9999/api/v1/lzy-director")),
		GCPProjectID: getEnv("GCP_PROJECT_ID", "lazycreator-1"),
		GCSBucket:    getEnv("GCS_BUCKET_NAME", "lazy-creator-shorts-1"),
		GSCreds:      getEnv("GOOGLE_APPLICATION_CREDENTIALS", ""),

		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURI:  getEnv("GOOGLE_REDIRECT_URI", ""),
		YoutubeRedirectURI: getEnv("YOUTUBE_REDIRECT_URI", ""),
		GoogleSecretFile:   getEnv("GOOGLE_OAUTH_SECRET_FILE", ""),
	}
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
