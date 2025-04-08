package handlers

import (
	"encoding/json"

	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/services"
	"github.com/gin-gonic/gin"
)

func UpdateSettingsHandler(dbService *services.DBService, settingsService *services.SettingsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Service string          `json:"service"`
			Config  json.RawMessage `json:"config"`
		}
		if err := c.BindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "Invalid request"})
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
