-- Migration: Increase image_url column length for signed URLs
-- Signed URLs from Google Cloud Storage can be very long (800+ chars)

-- Update companies table
ALTER TABLE companies ALTER COLUMN image_url TYPE VARCHAR(2048);

-- Update activities table
ALTER TABLE activities ALTER COLUMN image_url TYPE VARCHAR(2048);

-- Update discussion_messages table
ALTER TABLE discussion_messages ALTER COLUMN image_url TYPE VARCHAR(2048);

-- Update indexes (drop and recreate with new column size)
DROP INDEX IF EXISTS idx_companies_image_url;
DROP INDEX IF EXISTS idx_activities_image_url;
DROP INDEX IF EXISTS idx_discussion_messages_image_url;

CREATE INDEX idx_companies_image_url ON companies(image_url) WHERE image_url IS NOT NULL;
CREATE INDEX idx_activities_image_url ON activities(image_url) WHERE image_url IS NOT NULL;
CREATE INDEX idx_discussion_messages_image_url ON discussion_messages(image_url) WHERE image_url IS NOT NULL;
