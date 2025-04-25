package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
	"golang.org/x/oauth2/google"
)

var encryptionKey string = os.Getenv("ENCRYPTION_KEY")

func validatePassword(password string) error {
	if len(password) < 8 {
		return fmt.Errorf("password must be at least 8 characters long")
	}

	patterns := map[string]*regexp.Regexp{
		"uppercase": regexp.MustCompile(`[A-Z]`),
		"lowercase": regexp.MustCompile(`[a-z]`),
		"number":    regexp.MustCompile(`[0-9]`),
		"special":   regexp.MustCompile(`[^A-Za-z0-9]`),
	}

	for pattern, regex := range patterns {
		if !regex.MatchString(password) {
			return fmt.Errorf("password must contain at least one %s character", pattern)
		}
	}

	return nil
}

// Deprecated
func verifyCaptcha(token string) error {
	secretKey := "YOUR_RECAPTCHA_SECRET_KEY"

	resp, err := http.PostForm("https://www.google.com/recaptcha/api/siteverify",
		url.Values{
			"secret":   {secretKey},
			"response": {token},
		})
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var result struct {
		Success bool `json:"success"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return err
	}

	if !result.Success {
		return fmt.Errorf("invalid captcha")
	}

	return nil
}

// LoginRequest defines the structure for authentication requests
// @Description Login request structure
type LoginRequest struct {
	Username string `json:"username" binding:"required" example:"johndoe"`
	Password string `json:"password" binding:"required" example:"secretpass123"`
}

// LoginHandler godoc
// @Summary User login
// @Description Authenticate user and return JWT token
// @Tags authentication
// @Accept json
// @Produce json
// @Param credentials body LoginRequest true "Login credentials"
// @Success 200 {object} map[string]interface{} "Example: {'token': 'eyJhbG...', 'user': {'username': 'johndoe', 'role': 'user'}}"
// @Failure 400 {object} map[string]string "Example: {'error': 'Invalid request format'}"
// @Failure 401 {object} map[string]string "Example: {'error': 'Invalid credentials'}"
// @Failure 500 {object} map[string]string "Example: {'error': 'Failed to generate token'}"
// @Router /login [post]
func LoginHandler(dbService *services.DBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req LoginRequest
		if err := c.BindJSON(&req); err != nil {
			fmt.Printf("LoginHandler: err=%v\n | Invalid request format", err)
			c.JSON(400, gin.H{"error": "Invalid request format"})
			return
		}

		passwordHash, role, err := dbService.GetUserCredentials(req.Username)
		fmt.Printf("LoginHandler: passwordHash=%v\n | role=%v\n | err=%v\n", passwordHash, role, err)
		fmt.Printf("LoginHandler: req.Password=%v\n", req.Password)
		if err != nil || bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)) != nil {
			fmt.Printf("LoginHandler: err=%v\n | Invalid credentials", err)
			c.JSON(401, gin.H{"error": "Invalid credentials"})
			return
		}

		// Generate JWT token
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"username": req.Username,
			"role":     role,
			"exp":      time.Now().Add(time.Hour * 24).Unix(),
		})

		// Sign the token with your secret key
		tokenString, err := token.SignedString([]byte(encryptionKey))
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to generate token"})
			return
		}

		c.JSON(200, gin.H{
			"token": tokenString,
			"user": gin.H{
				"username": req.Username,
				"role":     role,
			},
		})
	}
}

// RegisterRequest defines the structure for registration requests
// @Description Registration request structure
type RegisterRequest struct {
	FirstName string `json:"firstName" binding:"required" example:"John"`
	LastName  string `json:"lastName" binding:"required" example:"Doe"`
	Email     string `json:"email" binding:"required,email" example:"john.doe@example.com"`
	Username  string `json:"username" binding:"required" example:"johndoe"`
	Password  string `json:"password" binding:"required" example:"SecurePass123!"`
}

// RegisterHandler godoc
// @Summary User registration
// @Description Register a new user with their details
// @Tags authentication
// @Accept json
// @Produce json
// @Param registration body RegisterRequest true "Registration details"
// @Success 201 {object} map[string]string "Example: {'message': 'User registered successfully'}"
// @Failure 400 {object} map[string]string "Example: {'error': 'Invalid request format'} or {'error': 'Email already registered'} or {'error': 'Password must contain...'}"
// @Failure 500 {object} map[string]string "Example: {'error': 'Internal server error'} or {'error': 'Failed to create user'}"
// @Router /register [post]
func RegisterHandler(dbService *services.DBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req RegisterRequest
		if err := c.BindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "Invalid request format"})
			return
		}

		// Validate password
		if err := validatePassword(req.Password); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}

		// Check if email already exists
		exists, err := dbService.EmailExists(req.Email)
		if err != nil {
			c.JSON(500, gin.H{"error": "Internal server error"})
			return
		}
		if exists {
			c.JSON(400, gin.H{"error": "Email already registered"})
			return
		}

		// Hash password
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(500, gin.H{"error": "Internal server error"})
			return
		}

		// Create user
		err = dbService.CreateUser(services.User{
			FirstName:    req.FirstName,
			LastName:     req.LastName,
			Email:        req.Email,
			Username:     req.Username,
			PasswordHash: string(hashedPassword),
			Role:         "user",
		})
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to create user"})
			return
		}

		c.JSON(201, gin.H{"message": "User registered successfully"})
	}
}

func GoogleAuthHandler(c *gin.Context) {
	// Initialize OAuth config for Google
	config := &oauth2.Config{
		ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		RedirectURL:  "http://localhost:8080/api/v1/auth/google/callback",
		Scopes: []string{
			"https://www.googleapis.com/auth/userinfo.email",
			"https://www.googleapis.com/auth/userinfo.profile",
		},
		Endpoint: google.Endpoint,
	}

	// Generate OAuth URL
	url := config.AuthCodeURL("state")
	c.JSON(http.StatusOK, gin.H{"authUrl": url})
}

func GithubAuthHandler(c *gin.Context) {
	// Initialize OAuth config for GitHub
	config := &oauth2.Config{
		ClientID:     os.Getenv("GITHUB_CLIENT_ID"),
		ClientSecret: os.Getenv("GITHUB_CLIENT_SECRET"),
		RedirectURL:  "http://localhost:8080/api/v1/auth/github/callback",
		Scopes:       []string{"user:email"},
		Endpoint:     github.Endpoint,
	}

	// Generate OAuth URL
	url := config.AuthCodeURL("state")
	c.JSON(http.StatusOK, gin.H{"authUrl": url})
}

// VerifyTokenHandler godoc
// @Summary Verify JWT token
// @Description Verify if the provided JWT token is valid
// @Tags authentication
// @Accept json
// @Produce json
// @Security ApiKeyAuth
// @Success 200 {object} map[string]interface{} "Token is valid"
// @Failure 401 {object} map[string]string "Invalid or missing token"
// @Router /verify-token [get]
func VerifyTokenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get token from Authorization header
		authHeader := c.GetHeader("Authorization")
		fmt.Printf("VerifyTokenHandler: authHeader=%v\n", authHeader)
		if authHeader == "" {
			c.JSON(401, gin.H{"error": "No authorization header"})
			return
		}

		// Remove "Bearer " prefix
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		fmt.Printf("VerifyTokenHandler: tokenString=%v\n", tokenString)

		// Parse and validate the token
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(encryptionKey), nil
		})
		fmt.Printf("VerifyTokenHandler: token=%v\n", token)

		if err != nil {
			c.JSON(401, gin.H{"error": "Invalid token"})
			return
		}

		if !token.Valid {
			c.JSON(401, gin.H{"error": "Token is not valid"})
			return
		}

		c.JSON(200, gin.H{"status": "valid"})
	}
}
