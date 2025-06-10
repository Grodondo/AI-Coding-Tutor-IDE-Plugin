package models

//Deprecated model

// ServiceType represents different AI service types
type ServiceType string

const (
	QueryService   ServiceType = "query"
	AnalyzeService ServiceType = "analyze"
	// Add more services as needed
)

// IsValid checks if the service type is valid
func (s ServiceType) IsValid() bool {
	switch s {
	case QueryService, AnalyzeService:
		return true
	default:
		return false
	}
}

// String returns the string representation of the service type
func (s ServiceType) String() string {
	return string(s)
}
