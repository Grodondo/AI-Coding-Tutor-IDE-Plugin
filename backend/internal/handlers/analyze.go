package handlers

import (
	"regexp"
	"strconv"
	"strings"

	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/logger"
	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/services"
	"github.com/gin-gonic/gin"
)

// AnalyzeRequest defines the structure for code analysis requests
// @Description Request structure for code analysis
type AnalyzeRequest struct {
	Code               string `json:"code" binding:"required" example:"def hello_world():\n    print('Hello, World!')"`
	Level              string `json:"level" binding:"required" example:"beginner" enums:"beginner,intermediate,advanced"`
	IncludeLineNumbers bool   `json:"includeLineNumbers" example:"true"`
}

// Suggestion represents a single code analysis suggestion
// @Description Individual suggestion from code analysis
type Suggestion struct {
	Line        int    `json:"line" example:"0"`
	Message     string `json:"message" example:"Consider adding docstring"`
	Explanation string `json:"explanation" example:"Adding a docstring improves code readability"`
	Diff        string `json:"diff,omitempty" example:"- old_code\n+ new_code"`
}

// AnalyzeResponse defines the structure for code analysis responses
// @Description Response structure for code analysis results
type AnalyzeResponse struct {
	Suggestions []Suggestion `json:"suggestions"`
}

// AnalyzeHandler godoc
// @Summary Analyze code
// @Description Analyze code for best practices, improvements, and potential issues
// @Tags Code Analysis
// @Accept json
// @Produce json
// @Param request body handlers.AnalyzeRequest true "Code to analyze"
// @Success 200 {object} handlers.AnalyzeResponse
// @Failure 400 {object} map[string]string "Invalid request format or level"
// @Failure 500 {object} map[string]string "Server error"
// @Router /analyze [post]
func AnalyzeHandler(aiService *services.AIService, dbService *services.DBService, settingsService *services.SettingsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req AnalyzeRequest
		if err := c.BindJSON(&req); err != nil {
			logger.Log.Warnf("Invalid request: %v", err)
			c.JSON(400, gin.H{"error": "Invalid request"})
			return
		}

		// Construct prompt for full code analysis
		ai_settings, err := settingsService.GetAiSettings("analyze")
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

		// Enhance the prompt to include guidance about line numbers
		enhancedPrompt := promptTemplate
		if req.IncludeLineNumbers {
			enhancedPrompt += "\n\nIMPORTANT: For each suggestion, include the exact line number using the format 'Line X:' at the start of the suggestion. For example: 'Line 10: Use a more descriptive variable name'.\n\n"
			enhancedPrompt += "For each issue, provide:\n"
			enhancedPrompt += "1. A clear explanation of the problem\n"
			enhancedPrompt += "2. A specific code improvement suggestion\n"
			enhancedPrompt += "3. A concrete example showing 'before' and 'after' code\n\n"
			enhancedPrompt += "Format your response like this:\n"
			enhancedPrompt += "Line 15: Use meaningful variable names\n"
			enhancedPrompt += "Problem: The variable name 'i' is not descriptive of its purpose.\n"
			enhancedPrompt += "Suggestion: Rename to reflect its actual function.\n"
			enhancedPrompt += "Before: `i = 5`\n"
			enhancedPrompt += "After: `counterIndex = 5`\n\n"
			enhancedPrompt += "Focus on the most important improvements that will have the greatest impact on code quality, readability, and maintainability.\n"
		}

		prompt := enhancedPrompt + req.Code
		logger.Log.Debugf("Analysis prompt created for level: %s", req.Level)

		// Get AI response
		response, err := aiService.GetResponse("analyze", ai_settings.AIProvider, ai_settings.AIModel, prompt)
		if err != nil {
			logger.Log.Errorf("Failed to get AI response: %v", err)
			c.JSON(500, gin.H{"error": "Failed to get AI response"})
			return
		}

		logger.Log.Debugf("Analysis response received, parsing suggestions")

		// Parse the response into a list of suggestions
		suggestions := parseAnalyzeResponse(response)

		// If no line-specific suggestions were found, try to create them
		if len(suggestions) == 0 && req.IncludeLineNumbers {
			logger.Log.Warnf("No line-specific suggestions found, using fallback parsing")
			suggestions = createFallbackSuggestions(response, req.Code)
		}

		logger.Log.Infof("Analysis complete with %d suggestions", len(suggestions))

		// Respond to client
		c.JSON(200, gin.H{
			"suggestions": suggestions,
		})
	}
}

// parseAnalyzeResponse parses the AI response into a list of suggestions with line numbers
func parseAnalyzeResponse(response string) []Suggestion {
	var suggestions []Suggestion

	// Split the response into sections by line numbers
	linePattern := regexp.MustCompile(`(?m)^Line (\d+):(.+)$`)
	matches := linePattern.FindAllStringSubmatchIndex(response, -1)

	if len(matches) == 0 {
		return suggestions
	}

	// Process each section
	for i, match := range matches {
		if len(match) < 4 {
			continue
		}

		// Extract line number and title
		startPos := match[0]
		endPos := len(response)
		if i < len(matches)-1 {
			endPos = matches[i+1][0]
		}

		lineNumStr := response[match[2]:match[3]]
		title := strings.TrimSpace(response[match[4]:match[5]])

		// Extract the content for this suggestion
		content := response[startPos:endPos]

		// Try to parse line number
		lineNum, err := strconv.Atoi(lineNumStr)
		if err != nil {
			continue
		}

		// Try to extract before/after code examples
		beforePattern := regexp.MustCompile(`(?m)Before:[ \t]*\x60(.+?)\x60`)
		afterPattern := regexp.MustCompile(`(?m)After:[ \t]*\x60(.+?)\x60`)

		beforeMatch := beforePattern.FindStringSubmatch(content)
		afterMatch := afterPattern.FindStringSubmatch(content)

		diff := ""
		if len(beforeMatch) > 1 && len(afterMatch) > 1 {
			before := beforeMatch[1]
			after := afterMatch[1]
			diff = strings.Join([]string{"- ", before, "\n+ ", after}, "")
		}

		// Extract explanation (anything between the title and Before/After examples)
		explanation := content
		explanation = strings.TrimPrefix(explanation, strings.Join([]string{"Line ", lineNumStr, ":", title}, ""))

		// Remove Before/After lines if present
		if beforeMatch != nil {
			explanation = strings.Replace(explanation, beforeMatch[0], "", 1)
		}
		if afterMatch != nil {
			explanation = strings.Replace(explanation, afterMatch[0], "", 1)
		}

		explanation = strings.TrimSpace(explanation)
		// Create the suggestion
		suggestion := Suggestion{
			Line:        lineNum - 1, // Adjust to zero-based index for VS Code
			Message:     title,
			Explanation: explanation,
		}

		if diff != "" {
			suggestion.Diff = diff
		}

		suggestions = append(suggestions, suggestion)
	}

	return suggestions
}

// createFallbackSuggestions attempts to create suggestions when the AI doesn't format with line numbers
func createFallbackSuggestions(response string, code string) []Suggestion {
	var suggestions []Suggestion

	// Split the response into paragraphs
	paragraphs := strings.Split(response, "\n\n")
	codeLines := strings.Split(code, "\n")

	for i, paragraph := range paragraphs {
		paragraph = strings.TrimSpace(paragraph)
		if paragraph == "" || strings.Contains(paragraph, "Here are my suggestions") ||
			strings.Contains(paragraph, "Analysis complete") {
			continue
		}

		// Try to find some code snippet in the paragraph that matches a line in the code
		lineIndex := -1
		paragraphLines := strings.Split(paragraph, "\n")

		for _, pLine := range paragraphLines {
			pLine = strings.TrimSpace(pLine)
			if pLine == "" {
				continue
			}

			// Check for code snippets (simplified approach)
			for j, codeLine := range codeLines {
				codeLine = strings.TrimSpace(codeLine)
				if len(codeLine) > 10 && strings.Contains(pLine, codeLine[:10]) {
					lineIndex = j
					break
				}
			}

			if lineIndex != -1 {
				break
			}
		}

		// If no matching line found, use a default position based on paragraph order
		if lineIndex == -1 {
			// Try to find a reasonable position based on paragraph number
			lineIndex = (len(codeLines) * i) / len(paragraphs)
		}
		// Create a suggestion
		suggestion := Suggestion{
			Line:        lineIndex,
			Message:     paragraphLines[0], // Use first line as message
			Explanation: paragraph,         // Use full paragraph as explanation
		}

		suggestions = append(suggestions, suggestion)
	}

	return suggestions
}
