package handlers

import (
	"encoding/json"
	"fmt"

	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/models"
	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/services"
	"github.com/gin-gonic/gin"
)

// Settings defines the structure for AI settings
// @Description AI settings configuration
type Settings struct {
	AIProvider string            `json:"provider" example:"openai"`
	AIModel    string            `json:"model" example:"gpt-3.5-turbo"`
	Prompts    map[string]string `json:"prompts" example:"{'beginner':'Explain in simple terms...','intermediate':'Provide detailed analysis...'}"`
}

// UpdateSettingsHandler godoc
// @Summary Update AI settings
// @Description Update the AI provider, model and prompts configuration
// @Tags settings
// @Accept json
// @Produce json
// @Param settings body Settings true "AI settings configuration"
// @Success 200 {object} map[string]string "Settings updated successfully"
// @Failure 400 {object} map[string]string "Invalid settings format"
// @Failure 500 {object} map[string]string "Server error"
// @Router /settings [get]
func UpdateSettingsHandler(dbService *services.DBService, settingsService *services.SettingsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == "GET" {
			// Get all settings
			settings := make(map[string]*services.AiSettings)
			for _, service := range []models.ServiceType{models.QueryService, models.AnalyzeService} {
				setting, err := settingsService.GetAiSettings(service)
				if err != nil {
					c.JSON(500, gin.H{"error": fmt.Sprintf("Failed to retrieve settings: %v", err)})
					return
				}
				settings[service.String()] = setting
			}
			c.JSON(200, settings)
			return
		}

		// Handle POST request
		var req struct {
			Service string          `json:"service" binding:"required"`
			Config  json.RawMessage `json:"config" binding:"required"`
		}
		if err := c.BindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "Invalid request format"})
			return
		}

		configJSON, err := json.Marshal(req.Config)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to marshal settings"})
			return
		}

		// Use DBService to update settings
		if err := dbService.UpdateSettings(req.Service, string(configJSON)); err != nil {
			c.JSON(500, gin.H{"error": "Failed to update settings"})
			return
		}

		// Reload settings to reflect changes
		if err := settingsService.LoadAiSettings(); err != nil {
			c.JSON(500, gin.H{"error": "Failed to load settings"})
			return
		}

		c.JSON(200, gin.H{"status": "success"})
	}
}
