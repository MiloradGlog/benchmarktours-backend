-- Up Migration
-- Simplify Discussion Activity for Photo-Only Notes

-- Step 1: Add attachments support to team notes for photos
ALTER TABLE discussion_team_notes
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';

-- Step 2: Remove presenter feature (not needed)
ALTER TABLE discussion_team_members
DROP COLUMN IF EXISTS is_presenter;

-- Step 3: Create index for attachments performance
CREATE INDEX IF NOT EXISTS idx_discussion_team_notes_attachments
ON discussion_team_notes USING gin(attachments);

-- Down Migration
-- To rollback this migration if needed:
-- ALTER TABLE discussion_team_notes DROP COLUMN IF EXISTS attachments;
-- ALTER TABLE discussion_team_members ADD COLUMN IF NOT EXISTS is_presenter BOOLEAN DEFAULT FALSE;
-- DROP INDEX IF EXISTS idx_discussion_team_notes_attachments;
