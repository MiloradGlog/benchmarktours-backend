-- Migration: Create activities table
-- Up migration

CREATE TYPE activity_type AS ENUM ('CompanyVisit', 'Hotel', 'Restaurant', 'Travel');

CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    tour_id INTEGER NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    type activity_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    location_details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT activities_time_check CHECK (end_time >= start_time)
);

-- Create indexes for faster queries
CREATE INDEX idx_activities_tour_id ON activities(tour_id);
CREATE INDEX idx_activities_company_id ON activities(company_id);
CREATE INDEX idx_activities_start_time ON activities(start_time);
CREATE INDEX idx_activities_type ON activities(type);