package handlers

import (
	"fmt"

	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/services"
	"github.com/gin-gonic/gin"
)

// FeedbackRequest defines the expected JSON body for /feedback
type FeedbackRequest struct {
	ID       string `json:"id"`
	Feedback string `json:"feedback"`
}

// FeedbackHandler returns a Gin handler for processing feedback
func FeedbackHandler(dbService *services.DBService) gin.HandlerFunc {
	fmt.Printf("FeedbackHandler: dbService=%v\n", dbService)
	return func(c *gin.Context) {
		var req FeedbackRequest
		if err := c.BindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "Invalid request"})
			return
		}

		// Update feedback in database
		if err := dbService.UpdateFeedback(req.ID, req.Feedback); err != nil {
			c.JSON(500, gin.H{"error": "Failed to update feedback"})
			return
		}

		c.JSON(200, gin.H{"status": "success"})
	}
}
