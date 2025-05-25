# AI Coding Tutor Web Application

This is the web application component of the AI Coding Tutor IDE Plugin project. It provides a user interface for managing settings, viewing query history, and configuring the AI coding assistant.

## Features

- 🔐 User authentication and account management
- ⚙️ AI provider configuration (Groq, OpenAI)
- 📊 Query history and feedback tracking
- 🎛️ Proficiency level selection and settings
- 🌓 Dark/light theme support
- 📱 Responsive design for all devices

## Technology Stack

- **React 18** - UI component library
- **React Router v7** - Client-side routing
- **TypeScript** - Type-safe JavaScript
- **TailwindCSS** - Utility-first CSS framework
- **Vite** - Fast build tool and development server

## Getting Started

### Prerequisites

Make sure you have the following installed:

- Node.js (v18 or later)
- npm (v9 or later)
- Backend server running (see main project README)

### Installation

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the root directory with the following:

```
VITE_API_URL=http://localhost:8080
```

### Development

Start the development server with hot reloading:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

## Building for Production

Create a production build:

```bash
npm run build
```

## Routes and Components Structure

The application uses React Router for navigation and is organized as follows:

- `/` - Home page with project overview
- `/login` - User authentication
- `/register` - New user registration
- `/dashboard` - Main user dashboard
- `/settings` - Configure AI providers and preferences
- `/history` - View past queries and responses
- `/profile` - User profile management

## API Integration

The web application communicates with the backend server via RESTful API calls:

- Authentication endpoints for user management
- Settings endpoints for AI configuration
- Query endpoints for history and feedback

## Docker Deployment

To build and run using Docker:

```bash
docker build -t ai-coding-tutor-web .

# Run the container
docker run -p 5173:80 ai-coding-tutor-web
```

The Dockerfile in this directory is configured for production deployment with an Nginx server.

## Integration with VS Code Extension

This web application serves as the configuration hub for the VS Code extension. Settings configured here are used by the extension when making AI queries.

## Contributing

To contribute to this component:

1. Ensure you understand the project architecture
2. Make your changes following the established coding patterns
3. Test locally against the backend
4. Submit a pull request with a clear description of changes

## Related Components

- Backend API: Go-based server handling AI interaction
- VS Code Extension: Integrates AI functions into VS Code
- PostgreSQL Database: Stores user data and settings

## License

This project is licensed under the MIT License - see the LICENSE file in the root directory for details.
