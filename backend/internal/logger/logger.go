package logger

import (
	"io"
	"os"

	"github.com/sirupsen/logrus"
)

var (
	// Log is the global logger instance
	Log *logrus.Logger
)

// Init initializes the logger with the specified configuration
func Init(level string) {
	Log = logrus.New()

	// Set log format to JSON
	Log.SetFormatter(&logrus.JSONFormatter{
		TimestampFormat: "2006-01-02 15:04:05",
	})

	// Set output to stdout
	Log.SetOutput(os.Stdout)

	// Set log level based on env variable or parameter
	switch level {
	case "debug":
		Log.SetLevel(logrus.DebugLevel)
	case "info":
		Log.SetLevel(logrus.InfoLevel)
	case "warn":
		Log.SetLevel(logrus.WarnLevel)
	case "error":
		Log.SetLevel(logrus.ErrorLevel)
	default:
		Log.SetLevel(logrus.InfoLevel)
	}

	Log.Infof("Logger initialized with level: %s", level)
}

// SetOutput sets the logger output
func SetOutput(output io.Writer) {
	Log.SetOutput(output)
}

// SetLevel sets the logger level
func SetLevel(level string) {
	switch level {
	case "debug":
		Log.SetLevel(logrus.DebugLevel)
	case "info":
		Log.SetLevel(logrus.InfoLevel)
	case "warn":
		Log.SetLevel(logrus.WarnLevel)
	case "error":
		Log.SetLevel(logrus.ErrorLevel)
	default:
		Log.SetLevel(logrus.InfoLevel)
	}
	Log.Infof("Log level changed to: %s", level)
}
