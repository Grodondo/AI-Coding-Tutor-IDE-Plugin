package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// AIService manages interactions with the AI API
type AIService struct {
	settingsService *SettingsService
	client          *http.Client
}

// NewAIService creates a new AI service instance
func NewAIService(settingsService *SettingsService) *AIService {
	return &AIService{
		settingsService: settingsService,
		client:          &http.Client{},
	}
}

func (s *AIService) GetResponse(service string, provider string, model string, prompt string) (string, error) {
	settings, err := s.settingsService.GetAiSettings(service)
	fmt.Printf("GetResponse: settings=%v\n | err=%v\n", settings, err)
	if err != nil {
		return "", fmt.Errorf("failed to get AI settings: %w", err)
	}

	switch provider {
	case "groq":
		return s.GetResponseGeneral(settings.APIKey, model, prompt, "https://api.groq.com/openai/v1/chat/completions", settings.Temperature)
	case "openai":
		return s.GetResponseGeneral(settings.APIKey, model, prompt, "https://api.openai.com/v1/chat/completions", settings.Temperature)
	default:
		return "", fmt.Errorf("unknown provider: %s", provider)
	}
}

func (s *AIService) GetResponseGeneral(apiKey string, model string, prompt string, url string, temperature *float64) (string, error) {
	temp := 0.7
	if temperature != nil {
		temp = *temperature
	}

	reqBody, err := json.Marshal(map[string]interface{}{
		"model":       model,
		"temperature": temp,
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
	})
	if err != nil {
		return "", fmt.Errorf("failed to marshal request body: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(reqBody))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	// Check HTTP status code
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("AI service returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	// Log the full response for debugging
	fmt.Printf("AI Response: %+v\n", result)

	// Extract response content
	choices, ok := result["choices"].([]interface{})
	if !ok || len(choices) == 0 {
		return "", fmt.Errorf("invalid response: no choices")
	}
	firstChoice, ok := choices[0].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("invalid choice format")
	}
	message, ok := firstChoice["message"].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("invalid message format")
	}
	content, ok := message["content"].(string)
	if !ok {
		return "", fmt.Errorf("content not a string")
	}
	return content, nil
}
