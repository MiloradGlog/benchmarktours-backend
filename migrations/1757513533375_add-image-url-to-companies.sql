-- Migration: Add image_url column to companies table
-- Up migration

ALTER TABLE companies ADD COLUMN image_url VARCHAR(500);

-- Create index for image URLs if needed for queries
CREATE INDEX idx_companies_image_url ON companies(image_url) WHERE image_url IS NOT NULL;