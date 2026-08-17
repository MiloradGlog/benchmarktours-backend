-- Migration: Tour group chat support
-- One canonical group chat discussion per tour + push tokens, message reports, user blocks

-- Flag marking a discussion as the canonical tour chat (lazily created)
ALTER TABLE discussions ADD COLUMN IF NOT EXISTS is_tour_chat BOOLEAN NOT NULL DEFAULT FALSE;

-- One tour chat per tour
CREATE UNIQUE INDEX IF NOT EXISTS idx_discussions_tour_chat_unique
    ON discussions(tour_id) WHERE is_tour_chat;

-- Expo push tokens per device
CREATE TABLE IF NOT EXISTS device_push_tokens (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    platform TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user_id ON device_push_tokens(user_id);

-- Message reports (idempotent per reporter)
CREATE TABLE IF NOT EXISTS message_reports (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES discussion_messages(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_message_reports_message_id ON message_reports(message_id);

-- User blocks (client-side filter + server record)
CREATE TABLE IF NOT EXISTS user_blocks (
    id SERIAL PRIMARY KEY,
    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker_id ON user_blocks(blocker_id);
