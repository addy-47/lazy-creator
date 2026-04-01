package auth

import (
	"net/http"

	"github.com/addy-47/lazy-creator/lazy-svc/internal/db"
	"github.com/addy-47/lazy-creator/lazy-svc/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	jwtSvc         *JWTService
	firebaseSvc    *FirebaseService
	googleOAuthSvc *GoogleOAuthService
}

func NewAuthHandler(jwtSvc *JWTService, firebaseSvc *FirebaseService, googleOAuthSvc *GoogleOAuthService) *AuthHandler {
	return &AuthHandler{
		jwtSvc:         jwtSvc,
		firebaseSvc:    firebaseSvc,
		googleOAuthSvc: googleOAuthSvc,
	}
}

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	Name     string `json:"name" binding:"required"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	user := models.User{
		ID:           uuid.New().String(),
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		Name:         req.Name,
		Provider:     "email",
		IsActive:     true,
	}

	if err := db.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "user already exists or database error"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "User registered successfully",
		"user_id": user.ID,
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := db.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}

	// Generate JWT
	token, err := h.jwtSvc.GenerateToken(user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"token":  token,
		"user": gin.H{
			"id":      user.ID,
			"email":   user.Email,
			"name":    user.Name,
			"picture": user.Picture,
		},
	})
}

func (h *AuthHandler) RefreshToken(c *gin.Context) {
	// Extract the existing token from headers
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
		return
	}

	// Assuming Bearer token
	if len(authHeader) < 7 || authHeader[:7] != "Bearer " {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header format"})
		return
	}

	tokenStr := authHeader[7:]
	claims, err := h.jwtSvc.ValidateToken(tokenStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
		return
	}

	// Generate a fresh token
	newToken, err := h.jwtSvc.GenerateToken(claims.UserID, claims.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to refresh token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": newToken,
	})
}

type FirebaseLoginRequest struct {
	IDToken string `json:"id_token" binding:"required"`
}

func (h *AuthHandler) FirebaseLogin(c *gin.Context) {
	var req FirebaseLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()
	token, err := h.firebaseSvc.VerifyIDToken(ctx, req.IDToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid firebase token"})
		return
	}

	email := token.Claims["email"].(string)
	name, _ := token.Claims["name"].(string)
	picture, _ := token.Claims["picture"].(string)

	var user models.User
	if err := db.DB.Where("email = ?", email).First(&user).Error; err != nil {
		// User doesn't exist, create one
		user = models.User{
			ID:       uuid.New().String(),
			Email:    email,
			Name:     name,
			Picture:  picture,
			Provider: "google", // Assume google for social login via firebase for now
			IsActive: true,
		}
		if err := db.DB.Create(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
			return
		}
	} else {
		// User exists, update picture and name if they've changed
		user.Name = name
		user.Picture = picture
		db.DB.Save(&user)
	}

	// Generate local JWT
	jwtToken, err := h.jwtSvc.GenerateToken(user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

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

func (h *AuthHandler) Logout(c *gin.Context) {
	// For stateless JWT, logout is primarily handled by the client by clearing the token.
	// This endpoint provides a consistent API for the logout action.
	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Logged out successfully",
	})
}
