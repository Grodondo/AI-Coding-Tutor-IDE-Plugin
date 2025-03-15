package handlers

import (
	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/models"
	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// QueryRequest defines the expected JSON body for /query
type QueryRequest struct {
	Query string `json:"query"`
	Level string `json:"level"`
}

// QueryHandler returns a Gin handler for processing queries
func QueryHandler(aiService *services.AIService, dbService *services.DBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req QueryRequest
		if err := c.BindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "Invalid request"})
			return
		}

		// Generate unique ID
		id := uuid.New().String()

		// TODO Construct prompt based on proficiency level
		var prompt string
		switch req.Level {
		case "novice":
			prompt = "You are teaching a novice programmer who is just starting to learn coding. Provide very detailed explanations, breaking down complex concepts into simple, easy-to-understand steps. Use plenty of examples, analogies, and multiple code snippets to illustrate your points. Be encouraging and patient in your tone. Answer the following query: " + req.Query
		case "medium":
			prompt = "You are assisting a programmer with medium experience. They have a basic understanding of programming concepts but may need reminders or clarifications on intermediate topics. Provide clear answers with explanations where necessary, and include code snippets if they help clarify the explanation. Avoid over-explaining basic concepts. Answer the following query: " + req.Query
		case "expert":
			prompt = "You are helping an expert programmer who is highly skilled and experienced. Provide concise and advanced insights, assuming a deep understanding of programming concepts. Focus on efficient solutions, optimizations, and best practices. Include code snippets only if they provide unique insights or optimizations. Answer the following query: " + req.Query
		default:
			c.JSON(400, gin.H{"error": "Invalid level"})
			return
		}

		// Get AI response
		response, err := aiService.GetResponseGPT(prompt)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to get AI response"})
			return
		}

		// Store in database
		query := &models.Query{
			ID:       id,
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
