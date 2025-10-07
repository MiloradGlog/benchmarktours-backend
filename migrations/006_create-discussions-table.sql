-- Migration: Create discussions and messages tables for interactive discussions
-- Phase 6: Interactive Discussions and Post-Tour Access

-- Create discussion threads table
CREATE TABLE IF NOT EXISTS discussions (
    id SERIAL PRIMARY KEY,
    tour_id INTEGER NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
    activity_id INTEGER REFERENCES activities(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create discussion messages table
CREATE TABLE IF NOT EXISTS discussion_messages (
    id SERIAL PRIMARY KEY,
    discussion_id INTEGER NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_message_id INTEGER REFERENCES discussion_messages(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_edited BOOLEAN NOT NULL DEFAULT false,
    edited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create table for tracking read status
CREATE TABLE IF NOT EXISTS discussion_read_status (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    discussion_id INTEGER NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, discussion_id)
);

-- Create table for message reactions
CREATE TABLE IF NOT EXISTS message_reactions (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES discussion_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, user_id, reaction)
);

-- Update tours table to add post-tour access settings
ALTER TABLE tours ADD COLUMN IF NOT EXISTS post_tour_access_days INTEGER DEFAULT 30;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS enable_discussions BOOLEAN DEFAULT true;

-- Create indexes for performance
CREATE INDEX idx_discussions_tour_id ON discussions(tour_id);
CREATE INDEX idx_discussions_activity_id ON discussions(activity_id);
CREATE INDEX idx_discussions_created_by ON discussions(created_by);
CREATE INDEX idx_discussions_created_at ON discussions(created_at);
CREATE INDEX idx_discussions_is_pinned ON discussions(is_pinned);

CREATE INDEX idx_discussion_messages_discussion_id ON discussion_messages(discussion_id);
CREATE INDEX idx_discussion_messages_user_id ON discussion_messages(user_id);
CREATE INDEX idx_discussion_messages_parent_message_id ON discussion_messages(parent_message_id);
CREATE INDEX idx_discussion_messages_created_at ON discussion_messages(created_at);

CREATE INDEX idx_discussion_read_status_user_discussion ON discussion_read_status(user_id, discussion_id);
CREATE INDEX idx_message_reactions_message_user ON message_reactions(message_id, user_id);

-- Add updated_at trigger for discussions
CREATE OR REPLACE FUNCTION update_discussions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_discussions_updated_at
    BEFORE UPDATE ON discussions
    FOR EACH ROW
    EXECUTE FUNCTION update_discussions_updated_at();