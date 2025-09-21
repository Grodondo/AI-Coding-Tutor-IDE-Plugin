# AI Coding Tutor IDE Plugin

This project is a comprehensive AI-powered coding assistant designed to help developers at different skill levels. It consists of several integrated components:

- **Backend**: A Go-based API service that handles AI interactions, user authentication, and database operations (`backend/` directory)
- **Frontend Web Application**: A React-based web application for user settings and management (`frontend/webpage/` directory)
- **VS Code Extension**: A TypeScript extension that integrates the AI tutor directly into VS Code (`frontend/extension/` directory)
- **Database**: A PostgreSQL database for storing user data, queries, settings, and feedback information

## Key Features

- Real-time code suggestions and analysis based on user's code
- User-selectable proficiency levels (novice, medium, expert) for personalized assistance
- Query-based interaction with AI for coding questions
- Feedback mechanism to improve AI responses
- Secure user authentication system
- Configurable AI provider settings (supports Groq and OpenAI)

## Prerequisites

Ensure you have the following installed before setting up the project:

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) (for containerized deployment)
- [Go](https://go.dev/doc/install) (version 1.21 or later) for backend development
- [Node.js](https://nodejs.org/) (version 18 or later) and [npm](https://www.npmjs.com/get-npm) for frontend development
- [VS Code](https://code.visualstudio.com/) for testing the extension
- [PostgreSQL](https://www.postgresql.org/download/) (optional, if running the database locally)

## Installation and Setup

### Step 1: Clone the repository

```bash
git clone https://github.com/yourusername/AI-Coding-Tutor-IDE-Plugin.git
cd AI-Coding-Tutor-IDE-Plugin
```

### Step 2: Environment Configuration

Create a `.env` file in the project root with the following environment variables:

```env
ENCRYPTION_KEY=your_32_character_encryption_key
```

The `ENCRYPTION_KEY` is used for encrypting sensitive data like API keys and must be exactly 32 characters long.

### Step 3: Run with Docker Compose (Recommended)

The easiest way to run the complete backend and database:

```bash
docker-compose up --build
```

This will:
- Build and start the Go backend server on port 8080
- Create and initialize a PostgreSQL database with required tables
- Connect the services together with proper networking

### Step 4: Frontend Web Application Setup

```bash
cd frontend/webpage
npm install
npm run dev
```

The web application will be available at http://localhost:5173 or http://localhost:3000 (depending on your configuration).

### Step 5: VS Code Extension Setup

To run the VS Code extension in development mode:

```bash
cd frontend/extension
npm install
code .
```

In VS Code:
1. Press F5 to start debugging
2. This will open a new VS Code window with the extension loaded
3. You'll see an "AI Coding Tutor" view in the sidebar
4. Use the commands from the Command Palette (Ctrl+Shift+P) with prefix "AI Coding Tutor:"

## Configuring the Extension

After installing the extension, you can configure it through:

1. VS Code settings (search for "AI Coding Tutor")
2. The extension view in the sidebar
3. The web application settings page

## API Documentation

The backend API documentation is available via Swagger UI when the backend is running:

```
http://localhost:8080/swagger/index.html
```

## Project Structure

- `backend/`: Go-based API server
  - `cmd/server/`: Main application entry point
  - `internal/`: Core implementation
    - `handlers/`: HTTP request handlers
    - `middleware/`: Authentication and request processing
    - `models/`: Data structures
    - `services/`: Business logic
    - `utils/`: Helper functions
  - `docs/`: Swagger API documentation
  - `config/`: Configuration management

- `frontend/`:
  - `webpage/`: React-based web application
    - `app/`: Application components and routes
  - `extension/`: VS Code extension
    - `src/`: TypeScript source code

- `initdb/`: Database initialization scripts

## Troubleshooting

- **Database connection issues**: Verify the database container is running and environment variables are correctly set
- **API key errors**: Ensure AI service API keys are properly configured in the settings
- **CORS errors**: Check that the frontend origin is allowed in the backend CORS configuration

## Security Notes

- The application uses encrypted storage for API keys
- Passwords are stored as bcrypt hashes, not plain text
- JWT tokens are used for authentication between components

## Development Guidelines

- Follow Go standards and idiomatic practices for backend code
- Use ESLint and TypeScript for frontend code quality
- Write unit tests for critical functionality
- Keep API documentation updated when adding new endpoints

## Videos showcasing the functionalities

# Extension
<video src="https://github.com/user-attachments/assets/a4e2b054-ea2a-42e1-b499-69fe393f0a3e" controls width="600"></video>

# Webpage
<video src="https://github.com/user-attachments/assets/3ef884e7-cb58-49d4-be8d-82b50f8438bd" controls width="600"></video>

