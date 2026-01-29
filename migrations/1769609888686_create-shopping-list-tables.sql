-- Migration: Create Shopping List Tables
-- Purpose: Support team shopping list feature for tour participants

-- Create shopping_items table
CREATE TABLE shopping_items (
    id SERIAL PRIMARY KEY,
    tour_id INTEGER NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    value VARCHAR(255),
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    company_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create shopping_item_votes table
CREATE TABLE shopping_item_votes (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES shopping_items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(item_id, user_id) -- One vote per user per item
);

-- Create shopping_item_comments table
CREATE TABLE shopping_item_comments (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES shopping_items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create shopping_item_images table
CREATE TABLE shopping_item_images (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES shopping_items(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_shopping_items_tour_id ON shopping_items(tour_id);
CREATE INDEX idx_shopping_items_created_by ON shopping_items(created_by);
CREATE INDEX idx_shopping_items_company_id ON shopping_items(company_id);
CREATE INDEX idx_shopping_item_votes_item_id ON shopping_item_votes(item_id);
CREATE INDEX idx_shopping_item_votes_user_id ON shopping_item_votes(user_id);
CREATE INDEX idx_shopping_item_comments_item_id ON shopping_item_comments(item_id);
CREATE INDEX idx_shopping_item_images_item_id ON shopping_item_images(item_id);

-- Create trigger function to update updated_at
CREATE OR REPLACE FUNCTION update_shopping_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at
CREATE TRIGGER trigger_shopping_items_updated_at
  BEFORE UPDATE ON shopping_items
  FOR EACH ROW
  EXECUTE FUNCTION update_shopping_items_updated_at();

-- Down Migration (commented out, uncomment when needed)
-- DROP TABLE IF EXISTS shopping_item_images CASCADE;
-- DROP TABLE IF EXISTS shopping_item_comments CASCADE;
-- DROP TABLE IF EXISTS shopping_item_votes CASCADE;
-- DROP TABLE IF EXISTS shopping_items CASCADE;
-- DROP FUNCTION IF EXISTS update_shopping_items_updated_at();