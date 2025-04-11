package main

import (
	"fmt"
	"os"

	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/handlers"
	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/services"
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

func main() {
	fmt.Println("Starting server...")

	// Read environment variables
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")
	// aiAPIKey := os.Getenv("AI_API_KEY")
	// fmt.Printf("AI_API_KEY: %s\n", os.Getenv("AI_API_KEY"))

	// Construct DSN
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPassword, dbName)

	// Initialize services
	dbService, err := services.NewDBService(dsn)
	if err != nil {
		panic(err)
	}
	settingsService, err := services.NewSettingsService(dbService)
	if err != nil {
		panic(err)
	}
	aiService := services.NewAIService(settingsService)

	// Set up Gin router
	router := gin.Default()

	// Define routes
	router.POST("api/v1/query", handlers.QueryHandler(aiService, dbService, settingsService))
	router.POST("api/v1/analyze", handlers.AnalyzeHandler(aiService, dbService, settingsService))
	router.POST("api/v1/feedback", handlers.FeedbackHandler(dbService))
	router.POST("api/v1/login", handlers.LoginHandler(dbService))
	router.GET("api/v1/settings", handlers.UpdateSettingsHandler(dbService, settingsService))
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Run server
	router.Run(":8080")
}
