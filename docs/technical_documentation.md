# AI Coding Tutor IDE Plugin: Technical Documentation

## Project Overview

The AI Coding Tutor IDE Plugin is a comprehensive full-stack solution designed to enhance the coding experience by providing context-aware AI assistance directly within the Visual Studio Code environment. This project represents the convergence of modern software engineering practices, artificial intelligence integration, and user-centric design to create a personalized coding companion that adapts to the user's skill level.

## Architecture

The application follows a modern microservices architecture with clear separation of concerns:

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│                 │      │                 │      │                 │
│  VS Code        │◄────►│  Go Backend     │◄────►│  PostgreSQL     │
│  Extension      │      │  API Server     │      │  Database       │
│                 │      │                 │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
        ▲                        ▲
        │                        │
        ▼                        ▼
┌─────────────────┐      ┌─────────────────┐
│                 │      │                 │
│  React Web      │◄────►│  AI Provider    │
│  Application    │      │  (Groq/OpenAI)  │
│                 │      │                 │
└─────────────────┘      └─────────────────┘
```

### Component Interaction

- **VS Code Extension**: Captures context from the user's code editor, sends queries to the backend, and displays AI suggestions inline with the code.
- **React Web Application**: Provides user management, settings configuration, and a history of past interactions.
- **Go Backend**: Processes requests, manages authentication, handles business logic, and communicates with the AI providers.
- **PostgreSQL Database**: Stores user data, interaction history, feedback, and configuration settings.
- **AI Providers**: External services (Groq, OpenAI) that power the AI functionality.

## Technologies and Tools

### Programming Languages

1. **Go (Golang) 1.21+**
   - Backend API server implementation
   - Chosen for its performance, strong typing, concurrency model, and efficient resource utilization
   - Standard library and third-party packages provide comprehensive HTTP server capabilities

2. **TypeScript 5.x**
   - VS Code extension development
   - Frontend web application
   - Provides static typing on top of JavaScript to improve code quality and developer experience

3. **SQL**
   - Database queries and schema definition
   - Used with PostgreSQL for data persistence

### Frameworks and Libraries

#### Backend (Go)

1. **Gin Web Framework**
   - High-performance HTTP routing and middleware support
   - Used for REST API implementation with minimal memory footprint

2. **GORM**
   - Object-Relational Mapping for Go
   - Simplifies database interactions with PostgreSQL

3. **JWT-Go**
   - JSON Web Token implementation for secure authentication

4. **Swagger**
   - API documentation generation
   - Interactive testing interface for REST endpoints

#### Frontend (TypeScript/React)

1. **React 18.x**
   - Component-based UI library for the web application
   - Declarative paradigm for efficient updates and rendering

2. **React Router v7**
   - URL-based routing for the single-page application
   - Enables bookmarkable and shareable application states

3. **Vite**
   - Modern build tool and development server
   - Provides fast hot module replacement for development

#### VS Code Extension

1. **VS Code Extension API**
   - Integration with the VS Code IDE
   - Provides access to editor context, UI components, and events

2. **Node.js**
   - Runtime environment for the extension
   - Enables asynchronous I/O operations and HTTP requests

### Database

**PostgreSQL 16.x**
   - ACID-compliant relational database
   - Strong data integrity and transaction support
   - JSON support for flexible schema needs
   - Chosen for reliability, feature richness, and ecosystem support

### Container and Deployment

1. **Docker**
   - Application containerization for consistent environments
   - Isolation of dependencies and services

2. **Docker Compose**
   - Multi-container orchestration
   - Development environment setup
   - Service coordination

### Security Components

1. **bcrypt**
   - Password hashing with salting
   - Protection against rainbow table attacks

2. **AES-256 Encryption**
   - Symmetric encryption for sensitive data
   - Protects API keys stored in the database

3. **JWT (JSON Web Tokens)**
   - Stateless authentication mechanism
   - Signed tokens for secure client-server communication

4. **CORS (Cross-Origin Resource Sharing)**
   - Controlled access to backend resources
   - Prevention of unauthorized cross-origin requests

## Database Schema

The PostgreSQL database consists of the following key tables:

### Users Table
Stores user authentication and profile information
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Queries Table
Records user interactions with the AI assistant and feedback
```sql
CREATE TABLE queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    provider_name VARCHAR(50) NOT NULL,
    level VARCHAR(10) NOT NULL CHECK (level IN ('novice', 'medium', 'expert')),
    response TEXT NOT NULL,
    feedback VARCHAR(10) CHECK (feedback IN ('positive', 'negative', NULL)),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Settings Table
Stores configurable application settings including AI provider credentials
```sql
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    service VARCHAR(50) NOT NULL,  -- e.g., 'query', 'analyze'
    config JSONB NOT NULL,         -- Stores provider, model, etc.
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(service)                -- One config per service
);
```

## API Endpoints

The backend exposes a RESTful API with the following key endpoints:

### Authentication
- `POST /api/v1/login` - User authentication and token generation
- `POST /api/v1/register` - New user registration
- `GET /api/v1/verify-token` - Validate authentication token

### AI Interactions
- `POST /api/v1/query` - Submit a natural language query to the AI
- `POST /api/v1/analyze` - Request code analysis for a code snippet
- `POST /api/v1/feedback` - Submit feedback on AI responses

### Settings Management
- `GET /api/v1/settings` - Retrieve application settings
- `POST /api/v1/settings` - Update application settings
- `DELETE /api/v1/settings/:service` - Delete a specific service setting

### User Profile
- `GET /api/v1/profile` - Get the current user's profile information

## VS Code Extension Features

The extension integrates with VS Code to provide:

1. **Context-Aware Code Suggestions**
   - Analyzes the current code context
   - Provides relevant suggestions based on the user's skill level

2. **Code Analysis**
   - Detects potential issues and anti-patterns
   - Recommends improvements with explanation

3. **Interactive Query System**
   - Natural language queries about coding problems
   - Skill-level-appropriate responses

4. **Feedback Collection**
   - Tracks usefulness of suggestions
   - Improves future recommendations

5. **Extension Side Panel**
   - Displays extension status
   - Allows configuration of skill level

## AI Integration

### Supported AI Models

1. **Groq LLama 3.3 70B Versatile**
   - High-performance large language model
   - Fast response times with low latency
   - Strong code understanding capabilities

2. **OpenAI Models (Extensible)**
   - Compatible with various OpenAI models
   - Configurable through the settings interface

### Prompt Engineering

The system uses tailored prompts based on the user's selected skill level:

- **Novice**: Simplified explanations focusing on fundamentals and readability
- **Medium**: Balanced explanations with practical implementation details
- **Expert**: In-depth technical details, performance considerations, and advanced patterns

### Security Considerations

1. **API Key Encryption**
   - All third-party API keys are encrypted at rest
   - AES-256 encryption with a secure key

2. **Code Privacy**
   - Only selected code portions are sent to AI providers
   - No persistent storage of complete code files

## Development Methodology

The project follows industry-standard development practices:

1. **Modular Architecture**
   - Clear separation of concerns
   - Well-defined interfaces between components

2. **Code Organization**
   - Domain-driven design principles
   - Consistent file and directory structure

3. **Error Handling**
   - Comprehensive error management
   - Graceful degradation when services are unavailable

4. **Logging and Monitoring**
   - Structured logging for troubleshooting
   - Performance metrics collection

## Future Development

1. **Integration with Additional IDEs**
   - IntelliJ IDEA plugin
   - Eclipse extension
   - Sublime Text package

2. **Enhanced AI Capabilities**
   - Code generation from natural language descriptions
   - Unit test generation
   - Automated documentation

3. **Collaborative Features**
   - Team-based settings and permissions
   - Shared query history
   - Knowledge repository integration

4. **Learning Analytics**
   - Progress tracking for novice users
   - Skill development recommendations
   - Performance metrics for code improvements

## Requirements Specification

### Functional Requirements

1. **User Authentication and Authorization**
   - The system must support user registration and login
   - Different permission levels for regular users and administrators
   - Secure password management

2. **AI-Powered Code Assistance**
   - Real-time code suggestions as users type
   - Code analysis with detailed explanations
   - Question answering based on code context

3. **User Skill Level Adaptation**
   - Configurable proficiency levels (novice, medium, expert)
   - Tailored AI responses based on selected level
   - Progressive explanation complexity

4. **Settings Management**
   - AI provider configuration
   - Model selection and customization
   - Extension behavior preferences

5. **Feedback Collection**
   - User ratings for AI responses
   - Historical query tracking
   - Continuous improvement mechanisms

### Non-Functional Requirements

1. **Performance**
   - Response time under 2 seconds for queries
   - Extension startup time under 1 second
   - Minimal impact on editor responsiveness

2. **Security**
   - Encrypted storage of sensitive information
   - Secure communication between components
   - Protection against common vulnerabilities

3. **Reliability**
   - Graceful handling of service unavailability
   - Data persistence for user preferences
   - Consistent behavior across sessions

4. **Usability**
   - Intuitive interface with minimal learning curve
   - Clear indication of AI processing status
   - Seamless integration with VS Code workflow

5. **Scalability**
   - Support for multiple concurrent users
   - Efficient resource utilization
   - Horizontal scaling capability for backend services

## Conclusion

The AI Coding Tutor IDE Plugin represents a sophisticated integration of modern web technologies, artificial intelligence, and software development tools. By leveraging state-of-the-art language models and providing a context-aware coding assistant, the application enhances developer productivity while providing educational value appropriate to the user's skill level.

The modular architecture ensures maintainability and extensibility, while the comprehensive security measures protect user data and maintain privacy. The containerized deployment model simplifies environment setup and ensures consistent behavior across different systems.

This documentation provides a comprehensive technical overview suitable for academic evaluation and serves as a foundation for future development and enhancement of the system. 