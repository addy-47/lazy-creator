package db

import (
	"github.com/addy-47/lazy-creator/lazy-svc/internal/models"
)

// GetYouTubeCredentialByUserID retrieves the YouTube credentials for a specific user from Postgres
func GetYouTubeCredentialByUserID(userID string) (*models.YouTubeCredential, error) {
	var ytCred models.YouTubeCredential
	result := DB.Where("user_id = ?", userID).First(&ytCred)
	if result.Error != nil {
		return nil, result.Error
	}
	return &ytCred, nil
}

// DeleteYouTubeCredentialByUserID removes the YouTube credentials for a specific user from Postgres
func DeleteYouTubeCredentialByUserID(userID string) error {
	result := DB.Where("user_id = ?", userID).Delete(&models.YouTubeCredential{})
	return result.Error
}
