-- Add 'Leisure' to the activity_type ENUM.
--
-- Leisure covers non-work outings on a tour: sightseeing, temples, museums,
-- shopping, theme parks, free evenings. It behaves exactly like Restaurant —
-- a standalone place activity with optional location_details and website, no
-- linked company, no notes/questions tabs.
--
-- Forward-only: Postgres cannot drop a value from an enum. Idempotent so a
-- retried deploy is safe (the boot-time runner in src/config/migrate.ts runs
-- every unrecorded file).
--
-- NOTE: ALTER TYPE ... ADD VALUE may not be *used* in the same transaction
-- that adds it, so this migration only adds the label and does nothing else.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'Leisure' AND enumtypid = 'activity_type'::regtype
    ) THEN
        ALTER TYPE activity_type ADD VALUE 'Leisure';
    END IF;
END
$$;
