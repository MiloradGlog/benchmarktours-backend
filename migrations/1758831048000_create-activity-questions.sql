-- Migration: Create activity_questions table and extend notes table
-- Allows users to create questions for upcoming activities and link answers to questions

CREATE TABLE IF NOT EXISTS activity_questions (
    id SERIAL PRIMARY KEY,
    activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_activity_questions_activity_id ON activity_questions(activity_id);
CREATE INDEX idx_activity_questions_user_id ON activity_questions(user_id);
CREATE INDEX idx_activity_questions_created_at ON activity_questions(created_at);

-- Extend notes table to link answers to questions
ALTER TABLE notes ADD COLUMN IF NOT EXISTS question_id INTEGER REFERENCES activity_questions(id) ON DELETE SET NULL;

-- Create index for question_id lookups
CREATE INDEX idx_notes_question_id ON notes(question_id);