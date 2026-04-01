package auth

import (
	"context"
	"fmt"
	"log"
	"os"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
	"google.golang.org/api/option"
)

type FirebaseService struct {
	app  *firebase.App
	auth *auth.Client
}

func NewFirebaseService() (*FirebaseService, error) {
	ctx := context.Background()
	
	// Use the service account secret file
	saPath := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS")
	if saPath == "" {
		// Fallback to the known path if env is not set
		saPath = "sa-secret.json"
	}

	opt := option.WithCredentialsFile(saPath)
	app, err := firebase.NewApp(ctx, nil, opt)
	if err != nil {
		return nil, fmt.Errorf("error initializing firebase app: %v", err)
	}

	client, err := app.Auth(ctx)
	if err != nil {
		return nil, fmt.Errorf("error getting firebase auth client: %v", err)
	}

	log.Println("Firebase Admin SDK initialized successfully")
	return &FirebaseService{
		app:  app,
		auth: client,
	}, nil
}

func (s *FirebaseService) VerifyIDToken(ctx context.Context, idToken string) (*auth.Token, error) {
	token, err := s.auth.VerifyIDToken(ctx, idToken)
	if err != nil {
		return nil, fmt.Errorf("error verifying firebase id token: %v", err)
	}
	return token, nil
}
