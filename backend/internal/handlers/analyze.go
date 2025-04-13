package handlers

import (
	"strconv"
	"strings"

	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/models"
	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/services"
	"github.com/gin-gonic/gin"
)

// AnalyzeRequest defines the structure for code analysis requests
// @Description Request structure for code analysis
type AnalyzeRequest struct {
	Code  string `json:"code" binding:"required" example:"def hello_world():\n    print('Hello, World!')"`
	Level string `json:"level" binding:"required" example:"beginner" enums:"beginner,intermediate,advanced"`
}

// AnalyzeResponse defines the structure for code analysis responses
// @Description Response structure for code analysis results
type AnalyzeResponse struct {
	Suggestions []string `json:"suggestions" example:"['Consider adding docstring to the function', 'Follow PEP 8 naming conventions']"`
}

// @Summary Analyze code
// @Description Analyze code for best practices, improvements, and potential issues
// @Tags Code Analysis
// @Accept json
// @Produce json
// @Param code body AnalyzeRequest true "Code to analyze"
// @Success 200 {object} AnalyzeResponse
// @Failure 400 {object} map[string]string "Invalid request format"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /api/v1/analyze [post]
func AnalyzeHandler(aiService *services.AIService, dbService *services.DBService, settingsService *services.SettingsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req AnalyzeRequest
		if err := c.BindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "Invalid request"})
			return
		}

		// Construct prompt for full code analysis
		ai_settings, err := settingsService.GetAiSettings(models.AnalyzeService)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to get settings"})
			return
		}
		promptTemplate, ok := ai_settings.Prompts[req.Level]
		if !ok {
			c.JSON(400, gin.H{"error": "Invalid level"})
			return
		}
		prompt := promptTemplate + req.Code

		// Get AI response
		response, err := aiService.GetResponse("analyze", ai_settings.AIProvider, ai_settings.AIModel, prompt)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to get AI response"})
			return
		}

		// Parse the response into a list of suggestions
		suggestions := parseAnalyzeResponse(response)

		// Respond to client
		c.JSON(200, gin.H{
			"suggestions": suggestions,
		})
	}
}

// parseAnalyzeResponse parses the AI response into a list of suggestions with line numbers
func parseAnalyzeResponse(response string) []map[string]interface{} {
	var suggestions []map[string]interface{}
	lines := strings.Split(response, "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "Line ") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				lineNumStr := strings.TrimSpace(strings.TrimPrefix(parts[0], "Line "))
				lineNum, err := strconv.Atoi(lineNumStr)
				if err == nil {
					suggestions = append(suggestions, map[string]interface{}{
						"line":    lineNum - 1, // Adjust to zero-based index for VS Code
						"message": strings.TrimSpace(parts[1]),
					})
				}
			}
		}
	}
	return suggestions
}
