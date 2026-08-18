-- Add a website URL to activities (used by Restaurant/Hotel activities;
-- CompanyVisit activities keep using the company's own website).
ALTER TABLE activities ADD COLUMN IF NOT EXISTS website VARCHAR(500);
