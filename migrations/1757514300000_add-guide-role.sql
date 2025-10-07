-- Migration: Add Guide role to users table
-- Up migration

-- Alter the users table to include 'Guide' in the role check constraint
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('Admin', 'User', 'Guide'));