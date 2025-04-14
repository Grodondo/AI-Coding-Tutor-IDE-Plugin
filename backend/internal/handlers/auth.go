package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"time"

	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type RegisterRequest struct {
	FirstName    string `json:"firstName" binding:"required"`
	LastName     string `json:"lastName" binding:"required"`
	Email        string `json:"email" binding:"required,email"`
	Password     string `json:"password" binding:"required"`
	CaptchaToken string `json:"captchaToken" binding:"required"`
}

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

func verifyCaptcha(token string) error {
	// Replace with your reCAPTCHA secret key
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

// LoginResponse defines the structure for authentication responses
// @Description Login response structure
type LoginResponse struct {
	Token string `json:"token" example:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`
}

// @Summary User authentication
// @Description Authenticate a user and return a JWT token
// @Tags Authentication
// @Accept json
// @Produce json
// @Param credentials body LoginRequest true "Login credentials"
// @Success 200 {object} LoginResponse
// @Failure 400 {object} map[string]string "Invalid request format"
// @Failure 401 {object} map[string]string "Invalid credentials"
// @Router /api/v1/login [post]
func LoginHandler(dbService *services.DBService) gin.HandlerFunc {
	return func(c *gin.Context) {

		// TODO DELETE
		/*password := "admin123"
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			panic(err)
		}
		fmt.Println("Bcrypt hash:", string(hash))*/

		var req LoginRequest
		if err := c.BindJSON(&req); err != nil {
			fmt.Printf("LoginHandler: err=%v\n", err)
			c.JSON(400, gin.H{"error": "Invalid request format"})
			return
		}

		passwordHash, role, err := dbService.GetUserCredentials(req.Username)
		if err != nil || bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)) != nil {
			fmt.Printf("LoginHandler: err=%v\n", err)
			c.JSON(401, gin.H{"error": "Invalid credentials"})
			return
		}

		// Generate JWT token
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"username": req.Username,
			"role":     role,
			"exp":      time.Now().Add(time.Hour * 24).Unix(),
		})

		//TODO CHANGE SECRET KEY TO ENV VAR
		// Sign the token with your secret key
		tokenString, err := token.SignedString([]byte("your-secret-key")) // Replace with env variable in production
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

		// Verify CAPTCHA
		if err := verifyCaptcha(req.CaptchaToken); err != nil {
			c.JSON(400, gin.H{"error": "Invalid CAPTCHA"})
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
