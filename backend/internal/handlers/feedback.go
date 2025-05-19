package handlers

import (
	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/logger"
	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/services"
	"github.com/gin-gonic/gin"
)

// FeedbackRequest defines the structure for user feedback
// @Description Feedback request structure
type FeedbackRequest struct {
	QueryID  string `json:"id" binding:"required" example:"550e8400-e29b-41d4-a716-446655440000"`
	Feedback string `json:"feedback" binding:"required" example:"positive" enums:"positive,negative,neutral"`
}

// @Summary Submit feedback
// @Description Submit feedback for an AI interaction
// @Tags Feedback
// @Accept json
// @Produce json
// @Param feedback body FeedbackRequest true "Feedback details"
// @Success 200 {object} map[string]string "Feedback submitted successfully"
// @Failure 400 {object} map[string]string "Invalid request format"
// @Failure 404 {object} map[string]string "Query ID not found"
// @Router /api/v1/feedback [post]
func FeedbackHandler(dbService *services.DBService) gin.HandlerFunc {
	logger.Log.Debugf("Initializing Feedback Handler")
	return func(c *gin.Context) {
		var req FeedbackRequest
		if err := c.BindJSON(&req); err != nil {
			logger.Log.Warnf("Invalid feedback request: %v", err)
			c.JSON(400, gin.H{"error": "Invalid request"})
			return
		}

		logger.Log.Debugf("Processing feedback for query ID: %s", req.QueryID)

		// Update feedback in database
		if err := dbService.UpdateFeedback(req.QueryID, req.Feedback); err != nil {
			logger.Log.Errorf("Failed to update feedback: %v", err)
			c.JSON(500, gin.H{"error": "Failed to update feedback"})
			return
		}

		logger.Log.Infof("Feedback received for query %s: %s", req.QueryID, req.Feedback)
		c.JSON(200, gin.H{"status": "success"})
	}
}
