package models

type Query struct {
	ID       string
	Provider string
	Query    string
	Level    string
	Response string
	Feedback *string // Pointer to allow NULL in database
}
