package db

import (
	"context"
	"log"
	"time"

	"github.com/addy-47/lazy-creator/lazy-svc/internal/config"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// MongoClient exported for global use in Video Metadata operations
var MongoClient *mongo.Client
var MongoDB *mongo.Database

func InitMongoDB(cfg *config.Config) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Initialize MongoDB client with standardized options
	client, err := mongo.Connect(options.Client().ApplyURI(cfg.MongoDBURI))
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}

	// Verify connection with Ping
	err = client.Ping(ctx, nil)
	if err != nil {
		log.Fatalf("MongoDB ping failed: %v", err)
	}

	MongoClient = client
	MongoDB = client.Database(cfg.MongoDBName)

	log.Printf("MongoDB connection established successfully for database: %s", cfg.MongoDBName)
	log.Println("Ready for Video Metadata and Unstructured data operations")
}
