package handlers

import (
	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/services"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	// Add JWT library, e.g., "github.com/golang-jwt/jwt/v4"
)

func LoginHandler(dbService *services.DBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := c.BindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "Invalid request"})
			return
		}

		passwordHash, _, err := dbService.GetUserCredentials(req.Username)
		if err != nil || bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)) != nil {
			c.JSON(401, gin.H{"error": "Invalid credentials"})
			return
		}

		// Generate JWT (implement with your chosen library)
		token := "your-jwt-token" // Placeholder
		c.JSON(200, gin.H{"token": token})
	}
}
