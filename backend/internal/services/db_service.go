package services

import (
	"database/sql"

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

// CreateQuery inserts a new query into the database
func (s *DBService) CreateQuery(q *models.Query) error {
	_, err := s.db.Exec(
		"INSERT INTO queries (id, query, level, response, feedback) VALUES ($1, $2, $3, $4, $5)",
		q.ID, q.Query, q.Level, q.Response, q.Feedback,
	)
	return err
}

// UpdateFeedback updates the feedback for a given query ID
func (s *DBService) UpdateFeedback(id, feedback string) error {
	_, err := s.db.Exec("UPDATE queries SET feedback = $1 WHERE id = $2", feedback, id)
	return err
}
