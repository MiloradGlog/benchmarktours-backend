-- Migration: Increase theme_logo_url column length for tours table
-- This fixes the "value too long for type character varying(500)" error
-- when uploading tour logos with long URLs from cloud storage providers

ALTER TABLE tours ALTER COLUMN theme_logo_url TYPE VARCHAR(2000);

-- Update comment to reflect the increased length
COMMENT ON COLUMN tours.theme_logo_url IS 'URL to custom tour logo image for branded tours (max 2000 characters)';