-- Migration: Add status column to tours table
-- Up migration

-- Create ENUM type for tour status
CREATE TYPE tour_status AS ENUM ('Draft', 'Pending', 'Completed');

-- Add status column to tours table with default 'Draft'
ALTER TABLE tours 
ADD COLUMN status tour_status DEFAULT 'Draft' NOT NULL;

-- Create index for efficient filtering by status
CREATE INDEX idx_tours_status ON tours(status);

-- Create index for common query patterns (status + dates)
CREATE INDEX idx_tours_status_dates ON tours(status, start_date, end_date);

-- Set existing tours to 'Draft' status (they are already Draft by default)
-- This is just for clarity and future migrations
UPDATE tours SET status = 'Draft' WHERE status IS NULL;