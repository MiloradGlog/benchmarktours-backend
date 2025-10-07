-- Migration: Create tours table
-- Up migration

CREATE TABLE IF NOT EXISTS tours (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tours_date_check CHECK (end_date >= start_date)
);

-- Create index for faster date-based queries
CREATE INDEX idx_tours_dates ON tours(start_date, end_date);
CREATE INDEX idx_tours_name ON tours(name);