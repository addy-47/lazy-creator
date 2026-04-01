package auth

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/addy-47/lazy-creator/lazy-svc/internal/db"
	"github.com/addy-47/lazy-creator/lazy-svc/internal/models"
	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

type GoogleOAuthService struct {
	oauthConfig *oauth2.Config
	verifier    *oidc.IDTokenVerifier
}

func NewGoogleOAuthService(clientID, clientSecret, redirectURL string) (*GoogleOAuthService, error) {
	ctx := context.Background()

	// Configure OAuth2
	config := &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURL,
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint:     google.Endpoint,
	}

	// Configure OIDC verifier
	provider, err := oidc.NewProvider(ctx, "https://accounts.google.com")
	if err != nil {
		return nil, fmt.Errorf("failed to create OIDC provider: %v", err)
	}

	verifier := provider.Verifier(&oidc.Config{ClientID: clientID})

	return &GoogleOAuthService{
		oauthConfig: config,
		verifier:    verifier,
	}, nil
}

// GetAuthURL generates the Google OAuth URL for popup flow
func (s *GoogleOAuthService) GetAuthURL(state string) string {
	return s.oauthConfig.AuthCodeURL(state, oauth2.AccessTypeOffline)
}

// ExchangeCode exchanges the authorization code for tokens
func (s *GoogleOAuthService) ExchangeCode(ctx context.Context, code string) (*oauth2.Token, *oidc.IDToken, error) {
	token, err := s.oauthConfig.Exchange(ctx, code)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to exchange code: %v", err)
	}

	// Extract and verify ID token
	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok {
		return nil, nil, fmt.Errorf("no id_token in response")
	}

	idToken, err := s.verifier.Verify(ctx, rawIDToken)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to verify id_token: %v", err)
	}

	return token, idToken, nil
}

// VerifyIDToken verifies a Google ID token and returns user info
func (s *GoogleOAuthService) VerifyIDToken(ctx context.Context, rawIDToken string) (*oidc.IDToken, error) {
	return s.verifier.Verify(ctx, rawIDToken)
}

type GoogleUserInfo struct {
	Email       string `json:"email"`
	Name        string `json:"name"`
	Picture     string `json:"picture"`
	EmailVerified bool `json:"email_verified"`
}

func ExtractUserInfoFromIDToken(idToken *oidc.IDToken) (*GoogleUserInfo, error) {
	var claims struct {
		Email       string `json:"email"`
		Name        string `json:"name"`
		Picture     string `json:"picture"`
		EmailVerified bool   `json:"email_verified"`
	}

	if err := idToken.Claims(&claims); err != nil {
		return nil, fmt.Errorf("failed to parse claims: %v", err)
	}

	return &GoogleUserInfo{
		Email:       claims.Email,
		Name:        claims.Name,
		Picture:     claims.Picture,
		EmailVerified: claims.EmailVerified,
	}, nil
}

// GoogleAuthHandler handles Google OAuth login
func (h *AuthHandler) GoogleLogin(c *gin.Context) {
	var req struct {
		IDToken string `json:"id_token" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()

	// Verify the Google ID token
	idToken, err := h.googleOAuthSvc.VerifyIDToken(ctx, req.IDToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid google id token"})
		return
	}

	// Extract user info from token
	userInfo, err := ExtractUserInfoFromIDToken(idToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to extract user info"})
		return
	}

	// Find or create user in database
	var user models.User
	if err := db.DB.Where("email = ?", userInfo.Email).First(&user).Error; err != nil {
		// User doesn't exist, create one
		user = models.User{
			ID:       uuid.New().String(),
			Email:    userInfo.Email,
			Name:     userInfo.Name,
			Picture:  userInfo.Picture,
			Provider: "google",
			IsActive: true,
		}
		if err := db.DB.Create(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
			return
		}
	} else {
		// User exists, update picture and name if they've changed
		if user.Picture != userInfo.Picture || user.Name != userInfo.Name {
			user.Name = userInfo.Name
			user.Picture = userInfo.Picture
			db.DB.Save(&user)
		}
	}

	// Generate JWT token
	jwtToken, err := h.jwtSvc.GenerateToken(user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	log.Printf("Google login successful for user: %s", userInfo.Email)

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"token":  jwtToken,
		"user": gin.H{
			"id":      user.ID,
			"email":   user.Email,
			"name":    user.Name,
			"picture": user.Picture,
		},
	})
}

// GetGoogleAuthURL returns the Google OAuth URL for popup flow
func (h *AuthHandler) GetGoogleAuthURL(c *gin.Context) {
	state := uuid.New().String()
	authURL := h.googleOAuthSvc.GetAuthURL(state)

	c.JSON(http.StatusOK, gin.H{
		"status":      "success",
		"auth_url":    authURL,
		"state":       state,
		"redirect_uri": h.googleOAuthSvc.oauthConfig.RedirectURL,
	})
}

// GoogleAuthCallback handles the OAuth callback
func (h *AuthHandler) GoogleAuthCallback(c *gin.Context) {
	code := c.Query("code")
	state := c.Query("state")

	if code == "" || state == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "code and state are required"})
		return
	}

	ctx := c.Request.Context()
	token, idToken, err := h.googleOAuthSvc.ExchangeCode(ctx, code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to exchange code: %v", err)})
		return
	}

	userInfo, err := ExtractUserInfoFromIDToken(idToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to extract user info"})
		return
	}

	// Find or create user
	var user models.User
	if err := db.DB.Where("email = ?", userInfo.Email).First(&user).Error; err != nil {
		user = models.User{
			ID:       uuid.New().String(),
			Email:    userInfo.Email,
			Name:     userInfo.Name,
			Picture:  userInfo.Picture,
			Provider: "google",
			IsActive: true,
		}
		if err := db.DB.Create(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
			return
		}
	}

	// Generate JWT
	jwtToken, err := h.jwtSvc.GenerateToken(user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"token":  jwtToken,
		"token_type": token.TokenType,
		"expires_in": token.Expiry.Sub(time.Now()).Seconds(),
		"user": gin.H{
			"id":      user.ID,
			"email":   user.Email,
			"name":    user.Name,
			"picture": user.Picture,
		},
	})
}
