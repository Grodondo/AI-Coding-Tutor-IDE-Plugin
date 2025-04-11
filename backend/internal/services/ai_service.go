package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/models"
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

func (s *AIService) GetResponse(service models.ServiceType, provider string, model string, prompt string) (string, error) {
	settings, err := s.settingsService.GetAiSettings(service) // or "analyze" depending on context
	if err != nil {
		return "", fmt.Errorf("failed to get AI settings: %w", err)
	}

	switch provider {
	case "groq":
		return s.GetResponseGroq(settings.APIKey, model, prompt)
	case "openai":
		return s.GetResponseGPT(settings.APIKey, model, prompt)
	default:
		return "", fmt.Errorf("unknown provider: %s", provider)
	}
}

// GetResponseGroq sends a prompt to Groq's API and returns the response
func (s *AIService) GetResponseGroq(apiKey string, model string, prompt string) (string, error) {
	fmt.Printf("GetResponseGroq: prompt=%s\n", prompt)
	reqBody, err := json.Marshal(map[string]interface{}{
		"model":       model,
		"temperature": 0.7,
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
	})
	if err != nil {
		return "", fmt.Errorf("failed to marshal request body: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.groq.com/openai/v1/chat/completions", bytes.NewBuffer(reqBody))
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

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	fmt.Printf("Response: %v\n", result)
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

// GetResponseGPT sends a prompt to the AI API and returns the response
func (s *AIService) GetResponseGPT(apiKey string, model string, prompt string) (string, error) {
	reqBody, err := json.Marshal(map[string]interface{}{
		"model":       model,
		"temperature": 0.7,
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
	})
	if err != nil {
		return "", fmt.Errorf("failed to marshal request body: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(reqBody))
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

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	choices := result["choices"].([]interface{})
	firstChoice := choices[0].(map[string]interface{})
	message := firstChoice["message"].(map[string]interface{})
	content := message["content"].(string)
	return content, nil
}
