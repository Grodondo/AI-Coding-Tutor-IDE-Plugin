package main

import (
	"fmt"
	"os"
	"time"

	_ "github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/docs"
	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/handlers"
	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/logger"
	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/middleware"
	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/services"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// @title           AI Coding Tutor API
// @version         1.0
// @description     API for the AI Coding Tutor IDE Plugin - A smart programming assistant
// @termsOfService  http://swagger.io/terms/

// @contact.name   API Support
// @contact.url    http://www.swagger.io/support
// @contact.email  support@swagger.io

// @license.name  Apache 2.0
// @license.url   http://www.apache.org/licenses/LICENSE-2.0.html

// @host      localhost:8080
// @BasePath  /api/v1

// @securityDefinitions.basic  BasicAuth
// @securityDefinitions.apikey ApiKeyAuth
// @in header
// @name Authorization

// @x-extension-openapi {"example": "value on a json format"}
func main() {

	// Initialize logger
	logLevel := os.Getenv("LOG_LEVEL")
	if logLevel == "" {
		logLevel = "info" // Default to info level
	}
	logger.Init(logLevel)

	// Environment variables
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")
	// aiAPIKey := os.Getenv("AI_API_KEY")
	// fmt.Printf("AI_API_KEY: %s\n", os.Getenv("AI_API_KEY"))

	// DSN
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPassword, dbName)

	logger.Log.Debugf("DSN: %s", dsn)

	// Services
	dbService, err := services.NewDBService(dsn)
	if err != nil {
		logger.Log.Fatal("Failed to initialize database service: ", err)
	}
	settingsService, err := services.NewSettingsService(dbService)
	if err != nil {
		logger.Log.Fatal("Failed to initialize settings service: ", err)
	}
	aiService := services.NewAIService(settingsService)

	// Gin router
	if logLevel != "debug" {
		gin.SetMode(gin.ReleaseMode)
	}
	router := gin.Default()

	// CORS middleware configuration
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length", "Set-Cookie"},
		AllowCredentials: true,
		MaxAge:           12 * 60 * 60, // 12 hours
	}))

	// Api routes
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
			"time":   time.Now().Format(time.RFC3339),
		})
	})
	router.GET("api/v1/verify-token", handlers.VerifyTokenHandler())
	router.GET("api/v1/settings", middleware.AuthMiddleware(), handlers.GetSettingsHandler(dbService, settingsService))
	router.POST("api/v1/settings", middleware.AuthMiddleware(), handlers.UpdateSettingsHandler(dbService, settingsService))
	router.DELETE("api/v1/settings/:service", middleware.AuthMiddleware(), handlers.DeleteSettingsHandler(dbService, settingsService))
	router.GET("api/v1/providers", handlers.GetSupportedProvidersHandler())
	router.GET("api/v1/profile", middleware.AuthMiddleware(), handlers.ProfileHandler(dbService))
	router.POST("api/v1/query", handlers.QueryHandler(aiService, dbService, settingsService))
	router.POST("api/v1/analyze", handlers.AnalyzeHandler(aiService, dbService, settingsService))
	router.POST("api/v1/feedback", handlers.FeedbackHandler(dbService))
	router.POST("api/v1/login", handlers.LoginHandler(dbService))
	router.POST("api/v1/register", handlers.RegisterHandler(dbService))

	// Admin routes
	router.GET("api/v1/admin/users", middleware.AdminMiddleware(dbService), handlers.GetAllUsersHandler(dbService))
	router.PUT("api/v1/admin/users/:id/role", middleware.AdminMiddleware(dbService), handlers.UpdateUserRoleHandler(dbService))
	router.DELETE("api/v1/admin/users/:id", middleware.AdminMiddleware(dbService), handlers.DeleteUserHandler(dbService))

	// Social auth routes
	/*
		router.GET("api/v1/auth/google", handlers.GoogleAuthHandler)
		router.GET("api/v1/auth/github", handlers.GithubAuthHandler)
		router.GET("api/v1/auth/google/callback", handlers.GoogleCallbackHandler)
		router.GET("api/v1/auth/github/callback", handlers.GithubCallbackHandler)
	*/

	// Swagger documentation
	url := ginSwagger.URL("/swagger/doc.json") // The url pointing to API definition
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler, url))

	// Run server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" // Default port
	}

	logger.Log.Infof("Server starting on port %s", port)
	router.Run(":" + port)
}
