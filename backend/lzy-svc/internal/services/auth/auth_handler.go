package auth

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/addy-47/lazy-creator/lazy-svc/internal/db"
	"github.com/addy-47/lazy-creator/lazy-svc/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	jwtSvc         *JWTService
	googleOAuthSvc *GoogleOAuthService
}

func NewAuthHandler(jwtSvc *JWTService, googleOAuthSvc *GoogleOAuthService) *AuthHandler {
	return &AuthHandler{
		jwtSvc:         jwtSvc,
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

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}

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
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
		return
	}

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

	newToken, err := h.jwtSvc.GenerateToken(claims.UserID, claims.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to refresh token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": newToken,
	})
}

// GetGoogleAuthURL returns the Google OAuth URL for the popup flow
func (h *AuthHandler) GetGoogleAuthURL(c *gin.Context) {
	state := uuid.New().String()
	url := h.googleOAuthSvc.GetAuthURL(state)
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"url":    url,
	})
}

// GoogleLogin is a legacy stub for ID token based login (can be used for mobile later)
func (h *AuthHandler) GoogleLogin(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Please use /auth/google-url for the popup flow"})
}

// GoogleAuthCallback handles the OAuth redirect and communicates with the frontend popup via postMessage
func (h *AuthHandler) GoogleAuthCallback(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Code required"})
		return
	}

	ctx := c.Request.Context()
	_, idToken, err := h.googleOAuthSvc.ExchangeCode(ctx, code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to exchange code: %v", err)})
		return
	}

	userInfo, err := ExtractUserInfoFromIDToken(idToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to extract user info"})
		return
	}

	// Upsert user
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
		db.DB.Create(&user)
	} else {
		user.Name = userInfo.Name
		user.Picture = userInfo.Picture
		db.DB.Save(&user)
	}

	// Generate local JWT
	jwtToken, err := h.jwtSvc.GenerateToken(user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	// Securely marshal auth data to JSON for use in the script
	authData := gin.H{
		"status": "success",
		"token":  jwtToken,
		"user": gin.H{
			"id":      user.ID,
			"email":   user.Email,
			"name":    user.Name,
			"picture": user.Picture,
		},
	}
	
	jsonData, _ := json.Marshal(authData)

	// Return HTML/JS bridge for popup flow
	htmlContent := fmt.Sprintf(`
		<!DOCTYPE html>
		<html>
		<head><title>Authentication Successful</title></head>
		<body>
			<script>
				const authData = %s;
				if (window.opener) {
					window.opener.postMessage(authData, "*");
					window.close();
				} else {
					document.body.innerHTML = "<h1>Authentication Successful</h1><p>You can close this window now.</p>";
				}
			</script>
		</body>
		</html>
	`, string(jsonData))

	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(htmlContent))
}

func (h *AuthHandler) Logout(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Logged out successfully",
	})
}
