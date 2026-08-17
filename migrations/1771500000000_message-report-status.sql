-- Give message reports a moderation lifecycle so admins can triage and act on
-- them (Apple UGC guideline 1.2 / DSA-style handling). Previously reports were
-- write-only with no status and no admin surface.

ALTER TABLE message_reports
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'resolved', 'dismissed'));
ALTER TABLE message_reports
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE message_reports
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_message_reports_status ON message_reports(status);
