package handlers

import (
	"encoding/json"

	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/logger"
	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/services"
	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/utils"
	"github.com/gin-gonic/gin"
)

// ServiceConfig describes the POST body for UpdateSettingsHandler.
// swagger:model ServiceConfig
type ServiceConfig struct {
	// the unique service name, e.g. "query"
	// required: true
	Service string `json:"service"`

	// config for this service
	// required: true
	Config struct {
		// which AI provider to use
		// required: true
		AIProvider string `json:"ai_provider"`
		// model identifier
		// required: true
		AIModel string `json:"ai_model"`
		// raw API key; server will encrypt this
		// required: true
		APIKey string `json:"api_key"`
		// AI model temperature
		Temperature *float64 `json:"temperature,omitempty"`
		// named prompts
		Prompts map[string]string `json:"prompts"`
	} `json:"config"`
}

// GetSettingsHandler godoc
// @Summary   Get AI settings
// @Description  Return for each service: provider, model, encrypted_api_key, and prompts
// @Tags      settings
// @Produce   json
// @Success   200  {object} map[string]*services.AiSettings
// @Failure   500  {object} map[string]string
// @Router    /settings [get]
func GetSettingsHandler(dbService *services.DBService, settingsService *services.SettingsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		settings := make(map[string]*services.AiSettings)
		providers, err := dbService.GetAllUniqueServices()
		if err != nil {
			logger.Log.Errorf("Failed to get providers: %v", err)
			c.JSON(500, gin.H{"error": "Failed to get providers"})
			return
		}
		for _, service := range providers {
			setting, err := settingsService.GetAiSettings(service)
			if err != nil {
				logger.Log.Errorf("Failed to retrieve settings for %s: %v", service, err)
				c.JSON(500, gin.H{"error": "Failed to retrieve settings"})
				return
			}
			settings[service] = setting
		}
		logger.Log.Debugf("Retrieved settings for %d services", len(settings))
		c.JSON(200, settings)
	}
}

// UpdateSettingsHandler godoc
// @Summary   Update AI settings
// @Description  Accepts raw api_key; server will encrypt it and store under encrypted_api_key
// @Tags      settings
// @Accept    json
// @Produce   json
// @Param     request  body  handlers.ServiceConfig  true  "Service configuration update request"
// @Success   200  {object} map[string]string  "status: success"
// @Failure   400  {object} map[string]string  "Invalid request format or missing api_key"
// @Failure   500  {object} map[string]string  "Server error encrypting or saving"
// @Router    /settings [post]
func UpdateSettingsHandler(dbService *services.DBService, settingsService *services.SettingsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Bind request body
		var req struct {
			Service string          `json:"service" binding:"required"`
			Config  json.RawMessage `json:"config" binding:"required"`
		}

		if err := c.BindJSON(&req); err != nil {
			logger.Log.Warnf("Invalid settings request format: %v", err)
			c.JSON(400, gin.H{"error": "Invalid request format"})
			return
		}

		if EncryptionKey == "" {
			logger.Log.Errorf("Encryption key not set")
			c.JSON(500, gin.H{"error": "Encryption key not set"})
			return
		}

		// Unmarshal config to extract and encrypt the API key
		var configMap map[string]interface{}
		if err := json.Unmarshal(req.Config, &configMap); err != nil {
			logger.Log.Warnf("Invalid config format: %v", err)
			c.JSON(400, gin.H{"error": "Invalid config format"})
			return
		}

		// Extract and encrypt the API key
		apiKey, ok := configMap["api_key"].(string)
		if !ok {
			logger.Log.Warnf("API key is missing or invalid for service: %s", req.Service)
			c.JSON(400, gin.H{"error": "API key is missing or invalid"})
			return
		}
		encryptedApiKey, err := utils.Encrypt(apiKey, EncryptionKey)
		if err != nil {
			logger.Log.Errorf("Failed to encrypt API key: %v", err)
			c.JSON(500, gin.H{"error": "Failed to encrypt API key"})
			return
		}

		// Update config map with encrypted API key
		delete(configMap, "api_key")
		configMap["encrypted_api_key"] = encryptedApiKey

		// Marshal modified config back to JSON
		configJSON, err := json.Marshal(configMap)
		if err != nil {
			logger.Log.Errorf("Failed to marshal settings: %v", err)
			c.JSON(500, gin.H{"error": "Failed to marshal settings"})
			return
		}

		// Use DBService to update settings
		if err := dbService.UpdateOrInsertSettings(req.Service, string(configJSON)); err != nil {
			logger.Log.Errorf("Failed to update settings for %s: %v", req.Service, err)
			c.JSON(500, gin.H{"error": "Failed to update settings"})
			return
		}

		// Reload settings to reflect changes
		if err := settingsService.LoadAiSettings(); err != nil {
			logger.Log.Errorf("Failed to load settings: %v", err)
			c.JSON(500, gin.H{"error": "Failed to load settings"})
			return
		}

		logger.Log.Infof("Settings updated successfully for service: %s", req.Service)
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
			logger.Log.Warnf("Attempted to delete settings with empty service name")
			c.JSON(400, gin.H{"error": "Service name is required"})
			return
		}
		// Validate the service name and check if it's protected
		isDefault, err := dbService.IsDefaultService(service)
		if err != nil {
			logger.Log.Errorf("Failed to check if service is default: %v", err)
			c.JSON(500, gin.H{"error": "Failed to validate service"})
			return
		}
		if isDefault {
			logger.Log.Warnf("Attempted to delete protected default service: %s", service)
			c.JSON(400, gin.H{"error": "Cannot delete default system services (query and analyze)"})
			return
		}

		// Delete the setting from the database
		err = dbService.DeleteSettings(service)
		if err != nil {
			logger.Log.Errorf("Failed to delete settings for %s: %v", service, err)
			c.JSON(500, gin.H{"error": "Failed to delete settings"})
			return
		}

		// Reload settings to reflect the deletion
		if err := settingsService.LoadAiSettings(); err != nil {
			logger.Log.Errorf("Failed to load settings after deletion: %v", err)
			c.JSON(500, gin.H{"error": "Failed to load settings"})
			return
		}

		logger.Log.Infof("Settings deleted successfully for service: %s", service)
		// Return success response
		c.JSON(200, gin.H{"status": "success"})
	}
}
