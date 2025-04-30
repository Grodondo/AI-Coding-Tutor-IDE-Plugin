package services

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/models"
	_ "github.com/lib/pq" // PostgreSQL driver
)

// User represents a user in the system
type User struct {
	FirstName    string
	LastName     string
	Email        string
	Username     string
	PasswordHash string
	Role         string
	CreatedAt    time.Time
}

// DBService holds the database connection
type DBService struct {
	db *sql.DB
}

// NewDBService creates a new database service instance
func NewDBService(dsn string) (*DBService, error) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}
	if err = db.Ping(); err != nil {
		return nil, err
	}
	return &DBService{db: db}, nil
}

// EmailExists checks if an email is already registered
func (s *DBService) EmailExists(email string) (bool, error) {
	var exists bool
	err := s.db.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", email).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check email existence: %v", err)
	}
	return exists, nil
}

// CreateUser creates a new user in the database
func (s *DBService) CreateUser(user User) error {
	_, err := s.db.Exec(`
		INSERT INTO users (first_name, last_name, email, username, password_hash, role)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		user.FirstName, user.LastName, user.Email, user.Username, user.PasswordHash, user.Role)
	if err != nil {
		return fmt.Errorf("failed to create user: %v", err)
	}
	return nil
}

// DeleteSettings deletes settings for a specific service
func (s *DBService) DeleteSettings(service string) error {
	_, err := s.db.Exec("DELETE FROM settings WHERE service = $1", service)
	if err != nil {
		return fmt.Errorf("failed to delete settings: %v", err)
	}
	return nil
}

// GetAllUniqueServices retrieves all unique services from the database (settings table)
func (s *DBService) GetAllUniqueServices() ([]string, error) {
	rows, err := s.db.Query("SELECT DISTINCT service FROM settings")
	if err != nil {
		return nil, fmt.Errorf("failed to get unique services: %v", err)
	}
	defer rows.Close()

	var services []string
	for rows.Next() {
		var service string
		if err := rows.Scan(&service); err != nil {
			return nil, fmt.Errorf("failed to scan service: %v", err)
		}
		services = append(services, service)
	}
	return services, nil
}

// UpdateSettings inserts or updates settings for a specific service
func (s *DBService) UpdateOrInsertSettings(service, configJSON string) error {
	// Use UPSERT to update if exists, insert if not
	_, err := s.db.Exec(`
        INSERT INTO settings (service, config) 
        VALUES ($1, $2) 
        ON CONFLICT (service) 
        DO UPDATE SET config = $2, updated_at = CURRENT_TIMESTAMP
    `, service, configJSON)
	if err != nil {
		return fmt.Errorf("failed to update settings: %v", err)
	}
	return nil
}

// GetSettings retrieves settings for a specific service
func (s *DBService) GetSettingsFromService(service string) (string, error) {
	var configJSON string
	err := s.db.QueryRow("SELECT config FROM settings WHERE service = $1", service).Scan(&configJSON)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", fmt.Errorf("settings not found for service: %s", service)
		}
		return "", fmt.Errorf("failed to get settings: %v", err)
	}
	return configJSON, nil
}

// GetUserCredentials retrieves the password hash and role for a given username
func (s *DBService) GetUserCredentials(username string) (passwordHash, role string, err error) {
	err = s.db.QueryRow("SELECT password_hash, role FROM users WHERE username = $1", username).
		Scan(&passwordHash, &role)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", "", fmt.Errorf("user not found")
		}
		return "", "", fmt.Errorf("database error: %v", err)
	}
	return passwordHash, role, nil
}

// CreateQuery inserts a new query into the database
func (s *DBService) CreateQuery(q *models.Query) error {
	fmt.Printf("CreateQuery: q=%v\n", q)
	_, err := s.db.Exec(
		"INSERT INTO queries (id, query, provider_name, level, response, feedback) VALUES ($1, $2, $3, $4, $5, $6)",
		q.ID, q.Query, q.Provider, q.Level, q.Response, q.Feedback,
	)
	return err
}

// UpdateFeedback updates the feedback for a given query ID
func (s *DBService) UpdateFeedback(id, feedback string) error {
	fmt.Printf("UpdateFeedback: id=%s, feedback=%s\n", id, feedback)
	_, err := s.db.Exec("UPDATE queries SET feedback = $1 WHERE id = $2", feedback, id)
	return err
}

// GetUserProfile retrieves the user's profile information
func (s *DBService) GetUserProfile(username string) (*User, error) {
	var user User
	err := s.db.QueryRow(`
		SELECT first_name, last_name, email, username, role, created_at
		FROM users
		WHERE username = $1
	`, username).Scan(
		&user.FirstName,
		&user.LastName,
		&user.Email,
		&user.Username,
		&user.Role,
		&user.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("user not found")
		}
		return nil, fmt.Errorf("failed to get user profile: %v", err)
	}

	return &user, nil
}
