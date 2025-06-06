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
	APIURL          string            `json:"api_url,omitempty"` // API endpoint URL for the provider
}

// ProviderConfig holds the default configuration for AI providers
type ProviderConfig struct {
	Name        string `json:"name"`
	DefaultURL  string `json:"default_url"`
	Description string `json:"description"`
}

// GetSupportedProviders returns the list of supported AI providers with their default configurations
func GetSupportedProviders() []ProviderConfig {
	return []ProviderConfig{
		{
			Name:        "groq",
			DefaultURL:  "https://api.groq.com/openai/v1/chat/completions",
			Description: "Groq API for fast LLM inference",
		},
		{
			Name:        "openai",
			DefaultURL:  "https://api.openai.com/v1/chat/completions",
			Description: "OpenAI API for GPT models",
		},
		{
			Name:        "anthropic",
			DefaultURL:  "https://api.anthropic.com/v1/messages",
			Description: "Anthropic API for Claude models",
		},
		{
			Name:        "azure-openai",
			DefaultURL:  "https://{endpoint}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version=2023-12-01-preview",
			Description: "Azure OpenAI API",
		},
		{
			Name:        "cohere",
			DefaultURL:  "https://api.cohere.ai/v1/chat",
			Description: "Cohere API for command models",
		},
		{
			Name:        "huggingface",
			DefaultURL:  "https://api-inference.huggingface.co/models/{model}",
			Description: "Hugging Face Inference API",
		},
		{
			Name:        "custom",
			DefaultURL:  "",
			Description: "Custom API endpoint (user-defined)",
		},
	}
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

// GetProviderAPIURL returns the API URL for a given provider
// If the settings don't contain a custom URL, it returns the default URL for the provider
func (ss *SettingsService) GetProviderAPIURL(provider string, settings *AiSettings) string {
	// If settings contain a custom API URL, use it
	if settings != nil && settings.APIURL != "" {
		return settings.APIURL
	}

	// Otherwise, return the default URL for the provider
	supportedProviders := GetSupportedProviders()
	for _, providerConfig := range supportedProviders {
		if providerConfig.Name == provider {
			return providerConfig.DefaultURL
		}
	}

	// If provider not found in supported list, return empty string
	return ""
}

// GetProviderConfig returns the configuration for a specific provider
func GetProviderConfig(providerName string) *ProviderConfig {
	supportedProviders := GetSupportedProviders()
	for _, provider := range supportedProviders {
		if provider.Name == providerName {
			return &provider
		}
	}
	return nil
}
