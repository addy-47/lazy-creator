package db

import (
	"log"
	"time"

	"github.com/addy-47/lazy-creator/lazy-svc/internal/config"
	"github.com/addy-47/lazy-creator/lazy-svc/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitPostgres(cfg *config.Config) {
	var err error
	
	// Create GORM logger for development
	newLogger := logger.New(
		log.Default(),
		logger.Config{
			SlowThreshold:             time.Second,
			LogLevel:                  logger.Info,
			IgnoreRecordNotFoundError: true,
			Colorful:                  true,
		},
	)

	DB, err = gorm.Open(postgres.Open(cfg.PostgresURI), &gorm.Config{
		Logger: newLogger,
	})

	if err != nil {
		log.Fatalf("Failed to connect to Postgres: %v", err)
	}

	sqlDB, err := DB.DB()
	if err != nil {
		log.Fatalf("Failed to get generic database object: %v", err)
	}

	// Set connection pool settings
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	log.Println("Postgres connection established successfully")

	// Run migrations
	DB.AutoMigrate(&models.User{}, &models.YouTubeCredential{})
	log.Println("Database migrations applied successfully")
}
