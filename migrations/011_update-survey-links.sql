-- Migration to update existing survey_url fields and add new survey links
-- This migrates from the old URL-based system to the new integrated survey system

-- Add new columns to track linked surveys
ALTER TABLE tours ADD COLUMN IF NOT EXISTS application_survey_id INTEGER REFERENCES surveys(id) ON DELETE SET NULL;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS completion_survey_id INTEGER REFERENCES surveys(id) ON DELETE SET NULL;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS feedback_survey_id INTEGER REFERENCES surveys(id) ON DELETE SET NULL;

-- Add comments for documentation
COMMENT ON COLUMN tours.application_survey_id IS 'Survey for users to apply when tour status is Pending';
COMMENT ON COLUMN tours.completion_survey_id IS 'Survey for users to complete after tour is finished';
COMMENT ON COLUMN activities.feedback_survey_id IS 'Survey for users to provide feedback after activity';

-- Keep the old survey_url columns for backward compatibility (can be removed later)
COMMENT ON COLUMN tours.survey_url IS 'DEPRECATED: Use completion_survey_id instead';
COMMENT ON COLUMN activities.survey_url IS 'DEPRECATED: Use feedback_survey_id instead';

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_tours_application_survey_id ON tours(application_survey_id);
CREATE INDEX IF NOT EXISTS idx_tours_completion_survey_id ON tours(completion_survey_id);
CREATE INDEX IF NOT EXISTS idx_activities_feedback_survey_id ON activities(feedback_survey_id);