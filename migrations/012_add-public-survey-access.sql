-- Migration to add public access functionality to surveys
-- This allows surveys (especially tour applications) to be completed by anyone with a public link

-- Add public access fields to surveys table
ALTER TABLE surveys
ADD COLUMN public_access_token UUID,
ADD COLUMN allow_public_access BOOLEAN DEFAULT FALSE,
ADD COLUMN public_access_created_at TIMESTAMPTZ,
ADD COLUMN public_access_expires_at TIMESTAMPTZ;

-- Make user_id nullable in survey_responses to support anonymous responses
ALTER TABLE survey_responses
ALTER COLUMN user_id DROP NOT NULL,
ADD COLUMN respondent_email VARCHAR(255),
ADD COLUMN respondent_name VARCHAR(255),
ADD COLUMN is_anonymous BOOLEAN DEFAULT FALSE;

-- Update the unique constraint to handle anonymous responses
-- Drop the existing constraint and create a new one that handles nulls properly
ALTER TABLE survey_responses DROP CONSTRAINT survey_responses_survey_id_user_id_key;

-- Add a new unique constraint that allows multiple anonymous responses per survey
-- but still prevents duplicate responses from authenticated users
CREATE UNIQUE INDEX survey_responses_unique_user
ON survey_responses (survey_id, user_id)
WHERE user_id IS NOT NULL;

-- Add indexes for performance
CREATE INDEX idx_surveys_public_access_token ON surveys(public_access_token)
WHERE public_access_token IS NOT NULL;

CREATE INDEX idx_survey_responses_email ON survey_responses(respondent_email)
WHERE respondent_email IS NOT NULL;

CREATE INDEX idx_surveys_public_access ON surveys(allow_public_access)
WHERE allow_public_access = TRUE;

-- Add constraint to ensure anonymous responses have email
ALTER TABLE survey_responses
ADD CONSTRAINT check_anonymous_response_email
CHECK (
  (is_anonymous = FALSE AND user_id IS NOT NULL) OR
  (is_anonymous = TRUE AND respondent_email IS NOT NULL AND user_id IS NULL)
);

-- Function to generate unique public access tokens
CREATE OR REPLACE FUNCTION generate_public_access_token(survey_id_param INTEGER)
RETURNS UUID AS $$
DECLARE
    new_token UUID;
BEGIN
    -- Generate a new UUID token
    new_token := gen_random_uuid();

    -- Update the survey with the new token and settings
    UPDATE surveys
    SET
        public_access_token = new_token,
        allow_public_access = TRUE,
        public_access_created_at = NOW(),
        public_access_expires_at = NOW() + INTERVAL '1 year'  -- Token expires in 1 year
    WHERE id = survey_id_param;

    RETURN new_token;
END;
$$ LANGUAGE plpgsql;

-- Function to revoke public access
CREATE OR REPLACE FUNCTION revoke_public_access(survey_id_param INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE surveys
    SET
        public_access_token = NULL,
        allow_public_access = FALSE,
        public_access_created_at = NULL,
        public_access_expires_at = NULL
    WHERE id = survey_id_param;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Add a comment explaining the public access system
COMMENT ON COLUMN surveys.public_access_token IS 'UUID token for public access to survey without authentication';
COMMENT ON COLUMN surveys.allow_public_access IS 'Whether this survey can be accessed publicly via token';
COMMENT ON COLUMN surveys.public_access_expires_at IS 'When the public access token expires';
COMMENT ON COLUMN survey_responses.respondent_email IS 'Email of anonymous respondent for public surveys';
COMMENT ON COLUMN survey_responses.respondent_name IS 'Name of anonymous respondent for public surveys';
COMMENT ON COLUMN survey_responses.is_anonymous IS 'Whether this response was submitted anonymously via public link';