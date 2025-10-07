-- Migration: Create tour_participants table
-- Up migration

CREATE TABLE IF NOT EXISTS tour_participants (
    id SERIAL PRIMARY KEY,
    tour_id INTEGER NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tour_id, user_id)
);

-- Create indexes for faster queries
CREATE INDEX idx_tour_participants_tour_id ON tour_participants(tour_id);
CREATE INDEX idx_tour_participants_user_id ON tour_participants(user_id);