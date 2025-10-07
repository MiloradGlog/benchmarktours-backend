-- Phase 7: Survey Integration
-- Add survey_url fields to tours and activities tables

-- Add survey_url column to tours table
ALTER TABLE tours ADD COLUMN IF NOT EXISTS survey_url VARCHAR(512);

-- Add survey_url column to activities table  
ALTER TABLE activities ADD COLUMN IF NOT EXISTS survey_url VARCHAR(512);

-- Add comments for documentation
COMMENT ON COLUMN tours.survey_url IS 'URL to external survey for overall tour feedback';
COMMENT ON COLUMN activities.survey_url IS 'URL to external survey for specific activity feedback';