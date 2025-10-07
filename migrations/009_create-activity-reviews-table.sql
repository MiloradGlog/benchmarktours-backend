-- Migration to create activity_reviews table
-- This allows users to rate and review activities

CREATE TABLE IF NOT EXISTS activity_reviews (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, activity_id) -- One review per user per activity
);

-- Create indexes for faster queries
CREATE INDEX idx_activity_reviews_activity_id ON activity_reviews(activity_id);
CREATE INDEX idx_activity_reviews_user_id ON activity_reviews(user_id);
CREATE INDEX idx_activity_reviews_rating ON activity_reviews(rating);
CREATE INDEX idx_activity_reviews_created_at ON activity_reviews(created_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_activity_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER activity_reviews_updated_at_trigger
    BEFORE UPDATE ON activity_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_activity_reviews_updated_at();