package storage

import (
	"context"
	"fmt"
	"time"

	"cloud.google.com/go/storage"
	"github.com/addy-47/lazy-creator/lazy-svc/internal/config"
	"google.golang.org/api/option"
)

type StorageService struct {
	client *storage.Client
	bucket string
}

func NewStorageService(cfg *config.Config) (*StorageService, error) {
	ctx := context.Background()
	var opts []option.ClientOption

	if cfg.GSCreds != "" {
		opts = append(opts, option.WithCredentialsFile(cfg.GSCreds))
	}

	client, err := storage.NewClient(ctx, opts...)
	if err != nil {
		return nil, fmt.Errorf("storage.NewClient: %v", err)
	}

	return &StorageService{
		client: client,
		bucket: cfg.GCSBucket,
	}, nil
}

// GenerateSignedUploadURL creates a URL for the frontend to upload files directly to GCS
func (s *StorageService) GenerateSignedUploadURL(objectName string) (string, error) {
	opts := &storage.SignedURLOptions{
		Scheme:         storage.SigningSchemeV4,
		Method:         "PUT",
		Expires:        time.Now().Add(15 * time.Minute),
		ContentType:    "application/octet-stream", // Default, can be refined
	}

	url, err := s.client.Bucket(s.bucket).SignedURL(objectName, opts)
	if err != nil {
		return "", fmt.Errorf("Bucket(%q).SignedURL: %v", s.bucket, err)
	}

	return url, nil
}

// GenerateSignedDownloadURL creates a URL for private content access
func (s *StorageService) GenerateSignedDownloadURL(objectName string) (string, error) {
	opts := &storage.SignedURLOptions{
		Scheme:  storage.SigningSchemeV4,
		Method:  "GET",
		Expires: time.Now().Add(1 * time.Hour),
	}

	url, err := s.client.Bucket(s.bucket).SignedURL(objectName, opts)
	if err != nil {
		return "", fmt.Errorf("Bucket(%q).SignedURL: %v", s.bucket, err)
	}

	return url, nil
}
