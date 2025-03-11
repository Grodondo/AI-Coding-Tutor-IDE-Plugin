// cmd/server/main.go
package main

import (
	"io/ioutil" // To read files.
	"log"       // Standard logging package.
	"net/http"  // For HTTP server.
	"os"        // To read environment variables.

	"gopkg.in/yaml.v2" // YAML parsing package.

	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/utils" // Utility functions (logger initialization).

	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/handlers" // Our API handlers.
)

// Config represents the structure of our YAML configuration.
type Config struct {
	Server struct {
		Port string `yaml:"port"` // Server port.
	} `yaml:"server"`
	Logging struct {
		Level string `yaml:"level"` // Logging level.
	} `yaml:"logging"`
}

// loadConfig reads the YAML configuration file and unmarshals it into a Config struct.
func loadConfig() (*Config, error) {
	// Read the configuration file.
	data, err := ioutil.ReadFile("config/config.yaml")
	if err != nil {
		return nil, err
	}
	// Unmarshal YAML into the Config struct.
	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, err
	}
	return &config, nil
}

func main() {
	// Load configuration from file.
	config, err := loadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize logger with the level specified in configuration.
	utils.InitLogger(config.Logging.Level)

	// Set up the route for our analysis endpoint.
	http.HandleFunc("/analyze", handlers.AnalyzeHandler)

	// Determine the server port:
	// Priority: environment variable PORT over YAML configuration.
	port := os.Getenv("PORT")
	if port == "" {
		port = config.Server.Port
	}
	log.Printf("Server is running on port %s...", port)

	// Start the HTTP server.
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
