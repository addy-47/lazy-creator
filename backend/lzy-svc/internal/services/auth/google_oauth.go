package auth

import (
	"context"
	"fmt"

	"github.com/coreos/go-oidc/v3/oidc"
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
