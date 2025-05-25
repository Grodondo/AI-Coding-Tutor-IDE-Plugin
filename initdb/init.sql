CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Queries table to store user queries and AI responses aswell as feedback
CREATE TABLE queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    provider_name VARCHAR(50) NOT NULL,
    level VARCHAR(10) NOT NULL CHECK (level IN ('novice', 'medium', 'expert')),
    response TEXT NOT NULL,
    feedback VARCHAR(10) CHECK (feedback IN ('positive', 'negative', NULL)),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settings table for AI configuration
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    service VARCHAR(50) NOT NULL,  -- e.g., 'query', 'analyze'
    config JSONB NOT NULL,         -- Stores provider, model, etc.
    is_default BOOLEAN DEFAULT FALSE, -- Mark default services that cannot be deleted
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(service)                -- One config per service
);

-- Users table for authentication
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

-- Insert initial settings
INSERT INTO settings (service, config, is_default) VALUES
('query', '{
    "ai_provider": "groq",
    "ai_model": "llama-3.3-70b-versatile",
    "encrypted_api_key": "HpK9QczqoknJOk1T2Jk3oa8/mx6/0RrNBpU/Udfaqmafcj6bx3l/EAgVBbiZjeon3TOSriyGFbgDZ+FIxXR4v5XUvtdZoKbGEjGaqcivDOMFVC54",
    "temperature": 0.7,
    "prompts": {
        "novice": "You are a friendly coding tutor helping beginners. Explain programming concepts in simple terms, use examples, and encourage learning. Keep explanations clear and easy to understand.",
        "medium": "You are an experienced coding mentor. Provide detailed explanations with code examples, best practices, and potential pitfalls to avoid. Balance depth with clarity.",
        "expert": "You are a senior software engineer. Give technical, in-depth analysis with advanced concepts, performance considerations, and architectural insights. Assume deep programming knowledge."
    }
}', true),
('analyze', '{
    "ai_provider": "groq",
    "ai_model": "llama-3.3-70b-versatile",
    "encrypted_api_key": "HpK9QczqoknJOk1T2Jk3oa8/mx6/0RrNBpU/Udfaqmafcj6bx3l/EAgVBbiZjeon3TOSriyGFbgDZ+FIxXR4v5XUvtdZoKbGEjGaqcivDOMFVC54",
    "temperature": 0.5,
    "prompts": {
        "novice": "You are a code analysis assistant for beginners. Review the code and explain what it does in simple terms, point out any issues, and suggest improvements with clear explanations.",
        "medium": "You are a code reviewer with expertise in multiple languages. Analyze the code for functionality, efficiency, readability, and potential bugs. Provide constructive feedback and improvement suggestions.",
        "expert": "You are a senior code architect. Perform a comprehensive code analysis covering architecture, performance, security, maintainability, and scalability. Provide detailed technical recommendations."
    }
}', true);

INSERT INTO users (first_name, last_name, email, username, password_hash, role) 
VALUES (
    'John',
    'Doe',
    'grodondo@example.com',
    'admin',
    '$2a$10$MQoGOfXKw5Ond78KbiwmoO3exudMI8j3IurJoJuRGWRkjVEvo3pmW',  
    'admin'
),(
    'Jane',
    'Smith',
    'jane.smith@example.com',
    'user',
    '$2a$10$tLF0pvZVv.oiqN5eXkEkLOaTLKDlxxBF2k3xETkETSEjWJwerLDpi',  
    'user'
);
