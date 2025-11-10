-- Migration: Add question_text_snapshot to notes table
-- Preserves question context when questions are deleted

ALTER TABLE notes ADD COLUMN IF NOT EXISTS question_text_snapshot TEXT;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_notes_question_text_snapshot ON notes(question_text_snapshot) WHERE question_text_snapshot IS NOT NULL;

-- Optionally populate existing answer notes with current question text
UPDATE notes n
SET question_text_snapshot = aq.question_text
FROM activity_questions aq
WHERE n.question_id = aq.id
  AND n.question_text_snapshot IS NULL;
