-- Migration: Add theme fields to tours table for tour-specific branding
-- This allows tours to have custom colors and logos

ALTER TABLE tours ADD COLUMN IF NOT EXISTS theme_primary_color VARCHAR(7) DEFAULT '#2563eb';
ALTER TABLE tours ADD COLUMN IF NOT EXISTS theme_logo_url VARCHAR(500);

-- Add comments to explain the theme system
COMMENT ON COLUMN tours.theme_primary_color IS 'Primary color for tour theme in hex format (e.g., #2563eb). Default: #2563eb';
COMMENT ON COLUMN tours.theme_logo_url IS 'URL to custom tour logo image for branded tours';