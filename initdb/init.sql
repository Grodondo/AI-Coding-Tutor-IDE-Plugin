CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    level VARCHAR(10) NOT NULL CHECK (level IN ('novice', 'medium', 'expert')),
    response TEXT NOT NULL,
    feedback VARCHAR(10) CHECK (feedback IN ('positive', 'negative', NULL)),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);