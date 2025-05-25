package services

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/utils"
)

// Settings holds the AI configuration
type AiSettings struct {
	AIProvider      string            `json:"ai_provider"`
	AIModel         string            `json:"ai_model"`
	EncryptedAPIKey string            `json:"encrypted_api_key"`
	APIKey          string            // Decrypted, not stored in DB
	Temperature     *float64          `json:"temperature,omitempty"` // AI model temperature
	Prompts         map[string]string `json:"prompts"`
}

// SettingsService manages loading settings from the database
type SettingsService struct {
	dbService *DBService
	settings  map[string]*AiSettings
}

// NewSettingsService initializes the settings service
func NewSettingsService(dbService *DBService) (*SettingsService, error) {
	ss := &SettingsService{
		dbService: dbService,
		settings:  make(map[string]*AiSettings),
	}
	if err := ss.LoadAiSettings(); err != nil {
		return nil, err
	}
	return ss, nil
}

// LoadSettings fetches the latest settings from the database
func (ss *SettingsService) LoadAiSettings() error {
	rows, err := ss.dbService.db.Query("SELECT service, config FROM settings")
	if err != nil {
		return err
	}
	defer rows.Close()

	encryptionKey := os.Getenv("ENCRYPTION_KEY")
	if encryptionKey == "" {
		return fmt.Errorf("ENCRYPTION_KEY not set")
	}

	for rows.Next() {
		var service, configJSON string
		if err := rows.Scan(&service, &configJSON); err != nil {
			return err
		}

		var settings AiSettings
		if err := json.Unmarshal([]byte(configJSON), &settings); err != nil {
			return err
		}

		// Decrypt the API key
		apiKey, err := utils.Decrypt(settings.EncryptedAPIKey, encryptionKey)
		if err != nil {
			return err
		}
		settings.APIKey = apiKey
		ss.settings[service] = &settings
	}
	return nil
}

// GetSettings retrieves settings for a specific service
func (ss *SettingsService) GetAiSettings(service string) (*AiSettings, error) {
	uniqueProviders, err := ss.dbService.GetAllUniqueServices()
	if err != nil {
		return nil, fmt.Errorf("failed to get unique providers: %v", err)
	}

	// Check if the service is in the list of unique providers
	found := false
	for _, provider := range uniqueProviders {
		if provider == service {
			found = true
			break
		}
	}
	// If the service is not found, return an error
	if !found {
		return nil, fmt.Errorf("service %s not found in settings", service)
	}

	settings, exists := ss.settings[service]
	if !exists {
		return nil, fmt.Errorf("no settings for service: %s", service)
	}
	return settings, nil
}
