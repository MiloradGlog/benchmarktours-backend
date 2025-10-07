-- Migration: Add trigger for cascade cleanup of GCP files
-- This ensures that when related records are deleted or updated, we track what needs cleanup

-- Create a table to track files that need cleanup (audit/cleanup queue)
CREATE TABLE IF NOT EXISTS file_cleanup_log (
    id SERIAL PRIMARY KEY,
    file_url VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'company_image', 'activity_image', 'discussion_image', 'voice_recording'
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cleaned BOOLEAN DEFAULT FALSE,
    cleanup_attempted_at TIMESTAMPTZ,
    error_message TEXT
);

-- Create index for cleanup queries
CREATE INDEX idx_file_cleanup_log_cleaned ON file_cleanup_log(cleaned) WHERE cleaned = FALSE;
CREATE INDEX idx_file_cleanup_log_deleted_at ON file_cleanup_log(deleted_at);

-- Function to log files for cleanup
CREATE OR REPLACE FUNCTION log_file_for_cleanup()
RETURNS TRIGGER AS $$
BEGIN
    -- For DELETE operations
    IF TG_OP = 'DELETE' THEN
        -- Check which table and which columns have URLs
        IF TG_TABLE_NAME = 'companies' AND OLD.image_url IS NOT NULL THEN
            INSERT INTO file_cleanup_log (file_url, file_type)
            VALUES (OLD.image_url, 'company_image');
        ELSIF TG_TABLE_NAME = 'activities' AND OLD.image_url IS NOT NULL THEN
            INSERT INTO file_cleanup_log (file_url, file_type)
            VALUES (OLD.image_url, 'activity_image');
        ELSIF TG_TABLE_NAME = 'discussion_messages' THEN
            IF OLD.image_url IS NOT NULL THEN
                INSERT INTO file_cleanup_log (file_url, file_type)
                VALUES (OLD.image_url, 'discussion_image');
            END IF;
            IF OLD.voice_recording_url IS NOT NULL THEN
                INSERT INTO file_cleanup_log (file_url, file_type)
                VALUES (OLD.voice_recording_url, 'voice_recording');
            END IF;
        END IF;
    -- For UPDATE operations (when URLs change)
    ELSIF TG_OP = 'UPDATE' THEN
        IF TG_TABLE_NAME = 'companies' AND OLD.image_url IS DISTINCT FROM NEW.image_url AND OLD.image_url IS NOT NULL THEN
            INSERT INTO file_cleanup_log (file_url, file_type)
            VALUES (OLD.image_url, 'company_image');
        ELSIF TG_TABLE_NAME = 'activities' AND OLD.image_url IS DISTINCT FROM NEW.image_url AND OLD.image_url IS NOT NULL THEN
            INSERT INTO file_cleanup_log (file_url, file_type)
            VALUES (OLD.image_url, 'activity_image');
        ELSIF TG_TABLE_NAME = 'discussion_messages' THEN
            IF OLD.image_url IS DISTINCT FROM NEW.image_url AND OLD.image_url IS NOT NULL THEN
                INSERT INTO file_cleanup_log (file_url, file_type)
                VALUES (OLD.image_url, 'discussion_image');
            END IF;
            IF OLD.voice_recording_url IS DISTINCT FROM NEW.voice_recording_url AND OLD.voice_recording_url IS NOT NULL THEN
                INSERT INTO file_cleanup_log (file_url, file_type)
                VALUES (OLD.voice_recording_url, 'voice_recording');
            END IF;
        END IF;
    END IF;
    
    RETURN NULL; -- Trigger returns NULL for AFTER triggers
END;
$$ LANGUAGE plpgsql;

-- Create triggers for each table with file URLs
DROP TRIGGER IF EXISTS companies_file_cleanup_trigger ON companies;
CREATE TRIGGER companies_file_cleanup_trigger
AFTER DELETE OR UPDATE ON companies
FOR EACH ROW
EXECUTE FUNCTION log_file_for_cleanup();

DROP TRIGGER IF EXISTS activities_file_cleanup_trigger ON activities;
CREATE TRIGGER activities_file_cleanup_trigger
AFTER DELETE OR UPDATE ON activities
FOR EACH ROW
EXECUTE FUNCTION log_file_for_cleanup();

DROP TRIGGER IF EXISTS discussion_messages_file_cleanup_trigger ON discussion_messages;
CREATE TRIGGER discussion_messages_file_cleanup_trigger
AFTER DELETE OR UPDATE ON discussion_messages
FOR EACH ROW
EXECUTE FUNCTION log_file_for_cleanup();

-- Add comment explaining the cleanup strategy
COMMENT ON TABLE file_cleanup_log IS 'Tracks files that need to be cleaned up from GCP storage. A background job should periodically process uncleaned records.';