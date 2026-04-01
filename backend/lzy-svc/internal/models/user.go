package models

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID                string         `gorm:"primaryKey" json:"id"`
	Email             string         `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash      string         `json:"-"` // Never expose hash in JSON
	Name              string         `json:"name"`
	Picture           string         `json:"picture"`
	Provider          string         `gorm:"default:email" json:"provider"` // e.g., 'email', 'google'
	IsActive          bool           `gorm:"default:true" json:"is_active"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
	
	// Relationships
	YouTubeCredentials []YouTubeCredential `gorm:"foreignKey:UserID" json:"youtube_credentials,omitempty"`
}

type YouTubeCredential struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	UserID       string    `gorm:"index;not null" json:"user_id"`
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	Expiry       time.Time `json:"expiry"`
	TokenType    string    `json:"token_type"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
