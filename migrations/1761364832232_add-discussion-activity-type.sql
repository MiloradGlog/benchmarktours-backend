-- Up Migration
-- Add Discussion activity type and related tables for structured discussion sessions

-- Step 1: Add 'Discussion' to the activity_type ENUM (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Discussion' AND enumtypid = 'activity_type'::regtype) THEN
        ALTER TYPE activity_type ADD VALUE 'Discussion';
    END IF;
END
$$;

-- Step 2: Add linked_activity_id to activities table
-- This allows discussions to reference other activities (e.g., Daily Discussion -> Company Visit)
-- NULL value indicates standalone discussions (Orientation, Wrap-up)
ALTER TABLE activities ADD COLUMN IF NOT EXISTS linked_activity_id INTEGER REFERENCES activities(id) ON DELETE SET NULL;

-- Step 3: Create discussion_teams table
-- Manages small teams within a Discussion activity
CREATE TABLE IF NOT EXISTS discussion_teams (
    id SERIAL PRIMARY KEY,
    discussion_activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g., "Team A", "Team 1", "Red Team"
    description TEXT,
    order_index INTEGER NOT NULL DEFAULT 0, -- For consistent ordering in UI
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT discussion_teams_unique_name UNIQUE(discussion_activity_id, name),
    CONSTRAINT discussion_teams_unique_order UNIQUE(discussion_activity_id, order_index)
);

-- Step 4: Create team_members table
-- Assigns participants to teams within a discussion
CREATE TABLE IF NOT EXISTS discussion_team_members (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES discussion_teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_presenter BOOLEAN DEFAULT FALSE, -- Designates team spokesperson
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

-- Step 5: Create discussion_questions table
-- Predefined questions for teams to answer (e.g., "What was good?", "What can we apply?")
CREATE TABLE IF NOT EXISTS discussion_questions (
    id SERIAL PRIMARY KEY,
    discussion_activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    is_required BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT discussion_questions_unique_order UNIQUE(discussion_activity_id, order_index)
);

-- Step 6: Create team_notes table
-- Digital capture of each team's findings (replaces whiteboard photos)
CREATE TABLE IF NOT EXISTS discussion_team_notes (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES discussion_teams(id) ON DELETE CASCADE,
    question_id INTEGER REFERENCES discussion_questions(id) ON DELETE SET NULL, -- NULL for general notes
    content TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 7: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_activities_linked_activity ON activities(linked_activity_id);
CREATE INDEX IF NOT EXISTS idx_discussion_teams_activity ON discussion_teams(discussion_activity_id);
CREATE INDEX IF NOT EXISTS idx_discussion_team_members_team ON discussion_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_discussion_team_members_user ON discussion_team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_discussion_questions_activity ON discussion_questions(discussion_activity_id);
CREATE INDEX IF NOT EXISTS idx_discussion_team_notes_team ON discussion_team_notes(team_id);
CREATE INDEX IF NOT EXISTS idx_discussion_team_notes_question ON discussion_team_notes(question_id);
CREATE INDEX IF NOT EXISTS idx_discussion_team_notes_created_by ON discussion_team_notes(created_by);

-- Step 8: Add triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_discussion_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_discussion_teams_updated_at ON discussion_teams;
CREATE TRIGGER trigger_discussion_teams_updated_at
    BEFORE UPDATE ON discussion_teams
    FOR EACH ROW
    EXECUTE FUNCTION update_discussion_updated_at();

DROP TRIGGER IF EXISTS trigger_discussion_questions_updated_at ON discussion_questions;
CREATE TRIGGER trigger_discussion_questions_updated_at
    BEFORE UPDATE ON discussion_questions
    FOR EACH ROW
    EXECUTE FUNCTION update_discussion_updated_at();

DROP TRIGGER IF EXISTS trigger_discussion_team_notes_updated_at ON discussion_team_notes;
CREATE TRIGGER trigger_discussion_team_notes_updated_at
    BEFORE UPDATE ON discussion_team_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_discussion_updated_at();

-- Down Migration
-- Note: This would be used to rollback the migration if needed
-- Uncomment and modify if rollback is required
