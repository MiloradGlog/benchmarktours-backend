-- Migration: Add image_url column to activities table  
-- Up migration

ALTER TABLE activities ADD COLUMN image_url VARCHAR(500);

-- Create index for image URLs if needed for queries
CREATE INDEX idx_activities_image_url ON activities(image_url) WHERE image_url IS NOT NULL;