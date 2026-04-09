package auth

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/addy-47/lazy-creator/lazy-svc/internal/config"
	"github.com/addy-47/lazy-creator/lazy-svc/internal/db"
	"github.com/addy-47/lazy-creator/lazy-svc/internal/models"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/option"
	"google.golang.org/api/youtube/v3"
)

type YouTubeOAuthService struct {
	config *oauth2.Config
}

func NewYouTubeOAuthService(cfg *config.Config) *YouTubeOAuthService {
	return &YouTubeOAuthService{
		config: &oauth2.Config{
			ClientID:     cfg.GoogleClientID,
			ClientSecret: cfg.GoogleClientSecret,
			Endpoint:     google.Endpoint,
			RedirectURL:  cfg.YoutubeRedirectURI,
			Scopes: []string{
				youtube.YoutubeScope,
				youtube.YoutubeUploadScope,
				youtube.YoutubeReadonlyScope,
				youtube.YoutubeForceSslScope,
			},
		},
	}
}

func (s *YouTubeOAuthService) GetAuthURL(userID string) string {
	return s.config.AuthCodeURL(fmt.Sprintf("user-%s", userID), oauth2.AccessTypeOffline)
}

func (s *YouTubeOAuthService) GetCredential(userID string) (*models.YouTubeCredential, error) {
	return db.GetYouTubeCredentialByUserID(userID)
}

// UnlinkYouTube removes the YouTube credentials for a specific user
func (s *YouTubeOAuthService) UnlinkYouTube(userID string) error {
	return db.DeleteYouTubeCredentialByUserID(userID)
}

// ExchangeCode handles the callback and saves tokens to Postgres
func (s *YouTubeOAuthService) ExchangeCode(ctx context.Context, code, userID string) (*oauth2.Token, error) {
	token, err := s.config.Exchange(ctx, code)
	if err != nil {
		return nil, err
	}

	// Save to Postgres
	err = s.saveTokenToDB(ctx, userID, token)
	if err != nil {
		return nil, err
	}

	return token, nil
}

func (s *YouTubeOAuthService) saveTokenToDB(ctx context.Context, userID string, token *oauth2.Token) error {
	ytCred := models.YouTubeCredential{
		UserID:       userID,
		AccessToken:  token.AccessToken,
		RefreshToken: token.RefreshToken,
		Expiry:       token.Expiry,
		TokenType:    token.TokenType,
		UpdatedAt:    time.Now(),
	}

	// Upsert: update if exists, insert if new
	result := db.DB.Where(models.YouTubeCredential{UserID: userID}).
		Assign(ytCred).
		FirstOrCreate(&ytCred)

	if result.Error != nil {
		log.Printf("Error saving YouTube credentials to Postgres: %v", result.Error)
		return result.Error
	}

	log.Printf("Successfully saved YouTube credentials to Postgres for user %s", userID)
	return nil
}

// GetYouTubeService returns an authenticated YouTube client
func (s *YouTubeOAuthService) GetYouTubeService(ctx context.Context, userID string) (*youtube.Service, error) {
	var ytCred models.YouTubeCredential
	result := db.DB.Where("user_id = ?", userID).First(&ytCred)
	if result.Error != nil {
		return nil, fmt.Errorf("YouTube credentials not found for user %s", userID)
	}

	token := &oauth2.Token{
		AccessToken:  ytCred.AccessToken,
		RefreshToken: ytCred.RefreshToken,
		Expiry:       ytCred.Expiry,
		TokenType:    ytCred.TokenType,
	}

	// Automatic Token Refresh handled by oauth2.Config.TokenSource
	tokenSource := s.config.TokenSource(ctx, token)
	client := oauth2.NewClient(ctx, tokenSource)
	
	// Refresh check logic: if the source returned a new token, sync back to DB
	newToken, err := tokenSource.Token()
	if err == nil && newToken.AccessToken != token.AccessToken {
		s.saveTokenToDB(ctx, userID, newToken)
	}

	return youtube.NewService(ctx, option.WithHTTPClient(client))
}

// CheckAuthStatus verifies if the user has valid/refreshable credentials
func (s *YouTubeOAuthService) CheckAuthStatus(ctx context.Context, userID string) bool {
	var count int64
	db.DB.Model(&models.YouTubeCredential{}).Where("user_id = ?", userID).Count(&count)
	return count > 0
}
