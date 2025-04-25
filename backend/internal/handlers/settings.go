package handlers

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/models"
	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/services"
	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/utils"
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
		providers, err := dbService.GetAllUniqueServices()
		if err != nil {
			c.JSON(500, gin.H{"error": fmt.Sprintf("Failed to get providers: %v", err)})
			return
		}
		for _, service := range providers {
			setting, err := settingsService.GetAiSettings(service)
			if err != nil {
				c.JSON(500, gin.H{"error": fmt.Sprintf("Failed to retrieve settings: %v", err)})
				return
			}
			settings[service] = setting
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

		// Get encryption key from environment
		encryptionKey := os.Getenv("ENCRYPTION_KEY")
		if encryptionKey == "" {
			c.JSON(500, gin.H{"error": "Encryption key not set"})
			return
		}

		// Unmarshal config to extract and encrypt the API key
		var configMap map[string]interface{}
		if err := json.Unmarshal(req.Config, &configMap); err != nil {
			c.JSON(400, gin.H{"error": "Invalid config format"})
			return
		}

		// Extract and encrypt the API key
		apiKey, ok := configMap["api_key"].(string)
		if !ok {
			c.JSON(400, gin.H{"error": "API key is missing or invalid"})
			return
		}
		encryptedApiKey, err := utils.Encrypt(apiKey, encryptionKey)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to encrypt API key"})
			return
		}

		// Update config map with encrypted API key
		delete(configMap, "api_key")
		configMap["encrypted_api_key"] = encryptedApiKey

		// Marshal modified config back to JSON
		configJSON, err := json.Marshal(configMap)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to marshal settings"})
			return
		}

		// Use DBService to update settings
		if err := dbService.UpdateOrInsertSettings(req.Service, string(configJSON)); err != nil {
			c.JSON(500, gin.H{"error": "Failed to update settings"})
			return
		}

		// Reload settings to reflect changes
		if err := settingsService.LoadAiSettings(); err != nil {
			c.JSON(500, gin.H{"error": "Failed to load settings"})
			return
		}
		// Return success response
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

		// Validate the service name
		if service == string(models.QueryService) || service == string(models.AnalyzeService) {
			c.JSON(400, gin.H{"error": "Cannot delete settings for query or analyze service"})
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
