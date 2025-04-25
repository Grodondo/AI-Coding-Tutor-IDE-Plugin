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
INSERT INTO settings (service, config) VALUES
('query', '{
    "ai_provider": "groq",
    "ai_model": "llama-3.3-70b-versatile",
    "encrypted_api_key": "HpK9QczqoknJOk1T2Jk3oa8/mx6/0RrNBpU/Udfaqmafcj6bx3l/EAgVBbiZjeon3TOSriyGFbgDZ+FIxXR4v5XUvtdZoKbGEjGaqcivDOMFVC54",
    "prompts": {
        "novice": "Explain simply...",
        "medium": "Provide a detailed analysis...",
        "expert": "Give a technical breakdown..."
    }
}'),
('analyze', '{
    "ai_provider": "groq",
    "ai_model": "llama-3.3-70b-versatile",
    "encrypted_api_key": "HpK9QczqoknJOk1T2Jk3oa8/mx6/0RrNBpU/Udfaqmafcj6bx3l/EAgVBbiZjeon3TOSriyGFbgDZ+FIxXR4v5XUvtdZoKbGEjGaqcivDOMFVC54",
    "prompts": {
        "novice": "Explain simply...",
        "medium": "Provide a detailed analysis...",
        "expert": "Give a technical breakdown..."
    }
}');

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
