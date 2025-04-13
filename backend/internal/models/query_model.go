package models

type Query struct {
	ID       string
	Query    string
	Provider string
	Level    string
	Response string
	Feedback *string // Pointer to allow NULL in database
}
