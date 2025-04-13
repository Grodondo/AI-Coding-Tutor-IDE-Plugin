package handlers

import (
	"fmt"

	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/models"
	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// QueryRequest defines the expected JSON body for /query
type QueryRequest struct {
	Query string `json:"query" binding:"required" example:"How do I create a new file in Python?"`
	Level string `json:"level" binding:"required" example:"beginner"`
}

// @Summary Query the AI
// @Description Send a query to the AI and get a response
// @Tags query
// @Accept json
// @Produce json
// @Param query body QueryRequest true "Query Request"
// @Success 200 {object} map[string]interface{} "Returns query ID and response"
// @Failure 400 {object} map[string]string "Invalid request format"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /api/v1/query [post]
func QueryHandler(aiService *services.AIService, dbService *services.DBService, settingsService *services.SettingsService) gin.HandlerFunc {
	fmt.Printf("QueryHandler: aiService=%v, dbService=%v\n", aiService, dbService)
	return func(c *gin.Context) {
		var req QueryRequest
		if err := c.BindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "Invalid request"})
			return
		}

		// Generate unique ID
		id := uuid.New().String()

		// Settings service to get the prompt template
		ai_settings, err := settingsService.GetAiSettings(models.QueryService)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to get settings"})
			return
		}
		promptTemplate, ok := ai_settings.Prompts[req.Level]
		if !ok {
			c.JSON(400, gin.H{"error": "Invalid level"})
			return
		}
		prompt := promptTemplate + req.Query

		// Get AI response
		response, err := aiService.GetResponse("query", ai_settings.AIProvider, ai_settings.AIModel, prompt)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to get AI response"})
			return
		}

		fmt.Printf("QueryHandler: response=%s\n", response)

		// Store in database
		query := &models.Query{
			ID:       id,
			Provider: ai_settings.AIProvider,
			Query:    req.Query,
			Level:    req.Level,
			Response: response,
			Feedback: nil,
		}
		if err := dbService.CreateQuery(query); err != nil {
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
