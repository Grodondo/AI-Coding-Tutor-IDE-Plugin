# AI Coding Tutor IDE Plugin

This project is a full-stack application designed to assist developers with an AI-powered coding tutor. It comprises:

- **Backend**: A Go-based service handling API requests, AI interactions, and database operations, located in `backend/`.
- **Frontend**: A React-based webpage using React Router v7 for user interface and settings management, located in `frontend/web/`.
- **VS Code Extension**: A TypeScript-based extension integrating the AI tutor into VS Code, loacted in `frontend/extension/`.
- **Database**: A PostgreSQL database for storing user data, settings, and queries, initialized via scripts in `initdb`.

The AI Coding Tutor provides real-time code suggestions, code analysis, and query responses tailored to the user's proficiency level (novice, medium, expert), enhancing the coding experience within VS Code.

## Prerequisites

Ensure the following tools are installed before setting up the project:

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) for containerized deployment.
- [Go](https://golang.org/doc/install) (version 1.24.2 or later) for backend development.
- [Node.js](https://nodejs.org/en/download/) (version 18 or later) and [npm](https://www.npmjs.com/get-npm) for frontend and extension development.
- [VS Code](https://code.visualstudio.com/) for testing the extension.
- [PostgreSQL](https://www.postgresql.org/download/) (optional, if running the database locally without Docker).

You'll also need API keys for AI services (e.g., Groq or OpenAI) to enable AI functionalities.

## Installation and Setup

Follow these steps to set up the project locally:

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Grodondo/AI-Coding-Tutor-IDE-Plugin.git
   cd AI-Coding-Tutor-IDE-Plugin/frontend
   git clone https://github.com/Grodondo/AI-Coding-Tutor-Webpage.git web
   ```

2. **Set up environment variables:**

   Create a `.env` file in the `backend/` directory with the following:

   ```env
   DB_HOST=db
   DB_PORT=5432
   DB_USER=user
   DB_PASSWORD=password
   DB_NAME=mydb
   ENCRYPTION_KEY=your_secure_encryption_key
   ```

   Replace `your_secure_encryption_key` with a strong, unique key for data encryption that is **32 characters** long.

3. **Install backend dependencies:**

   Navigate to `backend/` and run:

   ```bash
   go mod download
   ```

4. **Install frontend dependencies:**

   Navigate to `frontend/web/` and run:

   ```bash
   npm install
   ```

5. **Install VS Code extension dependencies:**

   Navigate to `frontend/extension/` and run:

   ```bash
   npm install
   ```

## Running the Application

### Docker Compose Setup for Backend and Database

Run the entire application (backend and database) with Docker Compose:

1. From the project root, execute:

   ```bash
   docker-compose up --build
   ```

   This builds and starts the containers. The backend will be accessible at `http://localhost:8080`.

2. To stop the application:

   ```bash
   docker-compose down
   ```

   If you want to remove the database volume as well, use:

   ```bash
   docker-compose down -v
   ```

### Running Components Separately

3. **Run the frontend:**

   In `frontend/web/`, run:

   ```bash
   npm run dev
   ```

   The webpage typically starts at `http://localhost:3000` or `http://localhost:5173` (check your setup).

4. **Run the VS Code extension:**

   - Open `extension/` in VS Code.
   - Press `F5` to debug and launch the extension in a new VS Code window.

## Accessing Documentation

The backend API documentation is available via Swagger. With the backend running, visit:

```
http://localhost:8080/swagger/index.html
```

This provides detailed information on API endpoints and usage.

## Development Guidelines --> Not implemented yet.

- **Backend**: Manage dependencies with Go modules. Run `go test ./...` for tests. 
- **Frontend**: Use npm for dependency management. Run `npm test` for tests.
- **Extension**: Use npm for dependencies. Run `npm test` for tests.

Keep documentation and tests updated when contributing.

## Troubleshooting

- **Database connection issues**: Verify the database is running and `.env` settings match the database configuration.
- **API key errors**: Ensure AI API keys are correctly configured in the `settings` table.
- **CORS issues**: Check the allowed origins in the backend’s CORS configuration (`backend/main.go`).