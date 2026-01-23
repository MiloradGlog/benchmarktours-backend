-- Migration: Remove Discussion Team Features
-- Date: 2024-01-22
-- Purpose: Simplify app by removing team management, keeping Discussion as simple itinerary item

-- Up Migration
-- ============

-- Step 1: Drop dependent tables first (due to foreign key constraints)
DROP TABLE IF EXISTS discussion_team_notes CASCADE;
DROP TABLE IF EXISTS discussion_team_members CASCADE;
DROP TABLE IF EXISTS discussion_teams CASCADE;
DROP TABLE IF EXISTS discussion_questions CASCADE;

-- Step 2: Drop related indexes
DROP INDEX IF EXISTS idx_discussion_teams_activity;
DROP INDEX IF EXISTS idx_discussion_team_members_team;
DROP INDEX IF EXISTS idx_discussion_team_members_user;
DROP INDEX IF EXISTS idx_discussion_questions_activity;
DROP INDEX IF EXISTS idx_discussion_team_notes_team;
DROP INDEX IF EXISTS idx_discussion_team_notes_question;
DROP INDEX IF EXISTS idx_discussion_team_notes_created_by;
DROP INDEX IF EXISTS idx_discussion_team_notes_attachments;

-- Step 3: Drop triggers
DROP TRIGGER IF EXISTS trigger_discussion_teams_updated_at ON discussion_teams;
DROP TRIGGER IF EXISTS trigger_discussion_questions_updated_at ON discussion_questions;
DROP TRIGGER IF EXISTS trigger_discussion_team_notes_updated_at ON discussion_team_notes;

-- Step 4: Drop trigger functions if they exist and are no longer used
DROP FUNCTION IF EXISTS update_discussion_updated_at();

-- Note: Discussion activities remain in the activities table as a simple type
-- Surveys attached to Discussion activities are preserved
-- This migration cannot be easily rolled back - ensure data is backed up before running

-- Down Migration
-- ==============
-- This migration is destructive and cannot be reversed without data loss.
-- To restore functionality, you would need to:
-- 1. Recreate tables from migration 1761364832232_add-discussion-activity-type.sql
-- 2. Restore data from backups
-- This is intentionally not provided to prevent accidental data corruption.