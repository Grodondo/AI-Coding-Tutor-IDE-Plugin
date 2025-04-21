package handlers

import (
	"encoding/json"
	"fmt"

	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/models"
	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/services"
	"github.com/gin-gonic/gin"
)

// GetSettingsHandler godoc
// @Summary Get AI settings
// @Description Retrieve the current AI settings for all services
// @Tags settings
// @Accept json
// @Produce json
// @Success 200 {object} map[string]*services.AiSettings "Current settings for all services"
// @Failure 500 {object} map[string]string "Error retrieving settings"
// @Router /settings [get]
func GetSettingsHandler(dbService *services.DBService, settingsService *services.SettingsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		settings := make(map[string]*services.AiSettings)
		//TODO Change serviceType for a function inside the db service that returns as strings all of the services
		for _, service := range []models.ServiceType{models.QueryService, models.AnalyzeService} {
			setting, err := settingsService.GetAiSettings(service)
			if err != nil {
				c.JSON(500, gin.H{"error": fmt.Sprintf("Failed to retrieve settings: %v", err)})
				return
			}
			settings[service.String()] = setting
		}
		c.JSON(200, settings)
	}
}

// UpdateSettingsHandler godoc
// @Summary Update AI settings
// @Description Update the AI provider, model and prompts configuration for a specific service
// @Tags settings
// @Accept json
// @Produce json
// @Param request body ServiceConfig true "Service configuration update request"
// @Success 200 {object} map[string]string "Settings updated successfully"
// @Failure 400 {object} map[string]string "Invalid request format"
// @Failure 500 {object} map[string]string "Server error"
// @Router /settings [post]
func UpdateSettingsHandler(dbService *services.DBService, settingsService *services.SettingsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Bind request body
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

// DeleteSettingsHandler godoc
// @Summary Delete AI settings
// @Description Delete the AI settings for a specific service
// @Tags settings
// @Accept json
// @Produce json
// @Param service path string true "Service name"
// @Success 200 {object} map[string]string "Settings deleted successfully"
// @Failure 400 {object} map[string]string "Invalid request format"
// @Failure 500 {object} map[string]string "Server error"
// @Router /settings/{service} [delete]
func DeleteSettingsHandler(dbService *services.DBService, settingsService *services.SettingsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Extract the service parameter from the URL
		service := c.Param("service")
		if service == "" {
			c.JSON(400, gin.H{"error": "Service name is required"})
			return
		}

		// Delete the setting from the database
		err := dbService.DeleteSettings(service)
		if err != nil {
			c.JSON(500, gin.H{"error": fmt.Sprintf("Failed to delete settings: %v", err)})
			return
		}

		// Reload settings to reflect the deletion
		if err := settingsService.LoadAiSettings(); err != nil {
			c.JSON(500, gin.H{"error": "Failed to load settings"})
			return
		}

		// Return success response
		c.JSON(200, gin.H{"status": "success"})
	}
}
