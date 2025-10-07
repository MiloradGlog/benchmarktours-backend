-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- This file will be run when the PostgreSQL container starts
-- Initial setup is complete - migrations will handle table creation