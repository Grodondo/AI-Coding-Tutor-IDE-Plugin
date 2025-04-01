package handlers

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/services"
	"github.com/gin-gonic/gin"
)

// AnalyzeRequest defines the expected JSON body for /analyze
type AnalyzeRequest struct {
	Code  string `json:"code"`
	Level string `json:"level"`
}

// AnalyzeHandler returns a Gin handler for analyzing full code
func AnalyzeHandler(aiService *services.AIService, dbService *services.DBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req AnalyzeRequest
		if err := c.BindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "Invalid request"})
			return
		}

		// Construct prompt for full code analysis
		prompt := fmt.Sprintf(
			"Analyze the following code for a %s level programmer and provide suggestions for improvement. "+
				"Format each suggestion as 'Line X: suggestion text', where X is the line number.\n\n%s",
			req.Level, req.Code,
		)

		// TODO Get AI response - get a lower quiality ai version later on
		response, err := aiService.GetResponseGroq(prompt)
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
