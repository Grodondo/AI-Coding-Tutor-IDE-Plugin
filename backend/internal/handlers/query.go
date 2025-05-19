package handlers

import (
	"strings"

	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/logger"
	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/models"
	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// QueryRequest defines the structure for AI query requests
// @Description Query request structure for AI interactions
type QueryRequest struct {
	Query   string `json:"query" binding:"required" example:"How do I create a new file in Python?"`
	Level   string `json:"level" binding:"required" example:"beginner" enums:"beginner,intermediate,advanced"`
	Context string `json:"context,omitempty"`
}

// QueryResponse defines the structure for AI query responses
// @Description Response structure for AI query results
type QueryResponse struct {
	ID       string `json:"id" example:"550e8400-e29b-41d4-a716-446655440000"`
	Response string `json:"response" example:"To create a new file in Python, you can use the open() function with 'w' mode..."`
}

// @Summary Query the AI
// @Description Send a query to the AI and get a response
// @Tags AI Interaction
// @Accept json
// @Produce json
// @Param query body QueryRequest true "Query parameters"
// @Success 200 {object} QueryResponse
// @Failure 400 {object} map[string]string "Invalid request format"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /api/v1/query [post]
func QueryHandler(aiService *services.AIService, dbService *services.DBService, settingsService *services.SettingsService) gin.HandlerFunc {
	logger.Log.Debugf("QueryHandler: aiService=%v, dbService=%v", aiService, dbService)
	return func(c *gin.Context) {
		var req QueryRequest
		if err := c.BindJSON(&req); err != nil {
			logger.Log.Warnf("Invalid request: %v", err)
			c.JSON(400, gin.H{"error": "Invalid request"})
			return
		}

		// Generate unique ID
		id := uuid.New().String()

		// Settings service to get the prompt template
		ai_settings, err := settingsService.GetAiSettings("query")
		if err != nil {
			logger.Log.Errorf("Failed to get settings: %v", err)
			c.JSON(500, gin.H{"error": "Failed to get settings"})
			return
		}
		promptTemplate, ok := ai_settings.Prompts[req.Level]
		if !ok {
			logger.Log.Warnf("Invalid level: %s", req.Level)
			c.JSON(400, gin.H{"error": "Invalid level"})
			return
		}
		prompt := promptTemplate
		if req.Context != "" {
			prompt += "\nPrevious conversation:\n" + req.Context + "\n\nCurrent query: "
		}
		prompt += req.Query

		// Get AI response
		response, err := aiService.GetResponse("query", ai_settings.AIProvider, ai_settings.AIModel, prompt)
		if err != nil {
			logger.Log.Errorf("Failed to get AI response: %v", err)
			c.JSON(500, gin.H{"error": "Failed to get AI response"})
			return
		}

		logger.Log.Infof("Response received: %s", strings.Split(response, "\n")[0])

		// Store in database
		query := &models.Query{
			ID:       id,
			Query:    req.Query,
			Provider: ai_settings.AIProvider,
			Level:    req.Level,
			Response: response,
			Feedback: nil,
		}
		if err := dbService.CreateQuery(query); err != nil {
			logger.Log.Errorf("Failed to store query: %v", err)
			c.JSON(500, gin.H{"error": "Failed to store query"})
			return
		}

		// Respond to client
		c.JSON(200, gin.H{
			"id":       id,
			"response": response,
		})
	}
}
