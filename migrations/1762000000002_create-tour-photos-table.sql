-- Migration: Create Tour Photos Table
-- Date: 2024-01-22
-- Purpose: Store photos at tour level with dates for flexible date-based linking to activities

-- Up Migration
-- ============

-- Create tour_photos table for daily photos
CREATE TABLE tour_photos (
  id SERIAL PRIMARY KEY,
  tour_id INTEGER NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  photo_date DATE NOT NULL, -- Date when photo was taken (for linking to activities by date)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient queries
CREATE INDEX idx_tour_photos_tour_id ON tour_photos(tour_id);
CREATE INDEX idx_tour_photos_user_id ON tour_photos(user_id);
CREATE INDEX idx_tour_photos_photo_date ON tour_photos(photo_date);
CREATE INDEX idx_tour_photos_tour_date ON tour_photos(tour_id, photo_date); -- For date-based queries

-- Create trigger function to update updated_at
CREATE OR REPLACE FUNCTION update_tour_photos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at
CREATE TRIGGER trigger_tour_photos_updated_at
  BEFORE UPDATE ON tour_photos
  FOR EACH ROW
  EXECUTE FUNCTION update_tour_photos_updated_at();

-- Down Migration
-- ==============
-- DROP TABLE IF EXISTS tour_photos CASCADE;
-- DROP FUNCTION IF EXISTS update_tour_photos_updated_at();
