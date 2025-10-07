-- Migration: Add media URL columns to discussion_messages table
-- Up migration

ALTER TABLE discussion_messages ADD COLUMN image_url VARCHAR(500);
ALTER TABLE discussion_messages ADD COLUMN voice_recording_url VARCHAR(500);

-- Create indexes for media URLs
CREATE INDEX idx_discussion_messages_image_url ON discussion_messages(image_url) WHERE image_url IS NOT NULL;
CREATE INDEX idx_discussion_messages_voice_url ON discussion_messages(voice_recording_url) WHERE voice_recording_url IS NOT NULL;