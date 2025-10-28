-- Migration: Add password management with setup code system
-- Description: Make passwords optional, add setup codes, password reset requests, and account deletion audit

-- Make password_hash nullable for users who haven't set their password yet
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Add timestamp for when password was last set
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ;

-- Update existing users to have password_set_at as their created_at
UPDATE users SET password_set_at = created_at WHERE password_hash IS NOT NULL;

-- Create user setup codes table (for first-time password setup)
CREATE TABLE IF NOT EXISTS user_setup_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    setup_code VARCHAR(9) NOT NULL UNIQUE, -- Format: XXXX-XXXX (8 chars + dash)
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_setup_codes_user_id ON user_setup_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_setup_codes_setup_code ON user_setup_codes(setup_code);
CREATE INDEX IF NOT EXISTS idx_user_setup_codes_expires_at ON user_setup_codes(expires_at);

-- Create password reset requests table
CREATE TABLE IF NOT EXISTS password_reset_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'dismissed')),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_user_id ON password_reset_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status ON password_reset_requests(status);

-- Create account deletion audit table (for GDPR/App Store compliance)
CREATE TABLE IF NOT EXISTS account_deletion_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    user_role VARCHAR(20) NOT NULL,
    deleted_by UUID REFERENCES users(id),
    deletion_type VARCHAR(20) NOT NULL CHECK (deletion_type IN ('self', 'admin')),
    reason TEXT,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_audit_deleted_at ON account_deletion_audit(deleted_at);
CREATE INDEX IF NOT EXISTS idx_account_deletion_audit_user_email ON account_deletion_audit(user_email);
