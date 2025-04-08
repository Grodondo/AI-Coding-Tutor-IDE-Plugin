package services

import (
	"database/sql"
	"fmt"

	"github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin/backend/internal/models"
	_ "github.com/lib/pq" // PostgreSQL driver
)

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

// UpdateSettings inserts or updates settings for a specific service
func (s *DBService) UpdateSettings(service, configJSON string) error {
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
		"INSERT INTO queries (id, query, level, response, feedback) VALUES ($1, $2, $3, $4, $5)",
		q.ID, q.Query, q.Level, q.Response, q.Feedback,
	)
	return err
}

// UpdateFeedback updates the feedback for a given query ID
func (s *DBService) UpdateFeedback(id, feedback string) error {
	fmt.Printf("UpdateFeedback: id=%s, feedback=%s\n", id, feedback)
	_, err := s.db.Exec("UPDATE queries SET feedback = $1 WHERE id = $2", feedback, id)
	return err
}
