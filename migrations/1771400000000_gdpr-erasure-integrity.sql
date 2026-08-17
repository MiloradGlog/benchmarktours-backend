-- GDPR erasure integrity:
--  1. Three FKs to users(id) had no ON DELETE action, so DELETE FROM users
--     threw for any account referenced by them (approved AI change, resolved
--     password reset, or performed a deletion) — the right to erasure failed.
--     Switch them to SET NULL so deletion always succeeds while preserving the
--     historical record with the actor de-linked.
--  2. Extend the file-cleanup trigger to tour_photos and shopping_item_images
--     so their storage blobs are queued for deletion when rows are removed
--     (incl. account-deletion cascades) — previously orphaned forever.

-- 1. FK constraints ---------------------------------------------------------

ALTER TABLE password_reset_requests
  DROP CONSTRAINT IF EXISTS password_reset_requests_resolved_by_fkey;
ALTER TABLE password_reset_requests
  ADD CONSTRAINT password_reset_requests_resolved_by_fkey
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE account_deletion_audit
  DROP CONSTRAINT IF EXISTS account_deletion_audit_deleted_by_fkey;
ALTER TABLE account_deletion_audit
  ADD CONSTRAINT account_deletion_audit_deleted_by_fkey
  FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE ai_proposed_changes
  DROP CONSTRAINT IF EXISTS ai_proposed_changes_approved_by_fkey;
ALTER TABLE ai_proposed_changes
  ADD CONSTRAINT ai_proposed_changes_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;

-- 2. Extend cleanup trigger to tour_photos + shopping_item_images ----------

CREATE OR REPLACE FUNCTION log_file_for_cleanup()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF TG_TABLE_NAME = 'companies' AND OLD.image_url IS NOT NULL THEN
            INSERT INTO file_cleanup_log (file_url, file_type) VALUES (OLD.image_url, 'company_image');
        ELSIF TG_TABLE_NAME = 'activities' AND OLD.image_url IS NOT NULL THEN
            INSERT INTO file_cleanup_log (file_url, file_type) VALUES (OLD.image_url, 'activity_image');
        ELSIF TG_TABLE_NAME = 'discussion_messages' THEN
            IF OLD.image_url IS NOT NULL THEN
                INSERT INTO file_cleanup_log (file_url, file_type) VALUES (OLD.image_url, 'discussion_image');
            END IF;
            IF OLD.voice_recording_url IS NOT NULL THEN
                INSERT INTO file_cleanup_log (file_url, file_type) VALUES (OLD.voice_recording_url, 'voice_recording');
            END IF;
        ELSIF TG_TABLE_NAME = 'tour_photos' AND OLD.image_url IS NOT NULL THEN
            INSERT INTO file_cleanup_log (file_url, file_type) VALUES (OLD.image_url, 'tour_photo');
        ELSIF TG_TABLE_NAME = 'shopping_item_images' AND OLD.image_url IS NOT NULL THEN
            INSERT INTO file_cleanup_log (file_url, file_type) VALUES (OLD.image_url, 'shopping_item_image');
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF TG_TABLE_NAME = 'companies' AND OLD.image_url IS DISTINCT FROM NEW.image_url AND OLD.image_url IS NOT NULL THEN
            INSERT INTO file_cleanup_log (file_url, file_type) VALUES (OLD.image_url, 'company_image');
        ELSIF TG_TABLE_NAME = 'activities' AND OLD.image_url IS DISTINCT FROM NEW.image_url AND OLD.image_url IS NOT NULL THEN
            INSERT INTO file_cleanup_log (file_url, file_type) VALUES (OLD.image_url, 'activity_image');
        ELSIF TG_TABLE_NAME = 'discussion_messages' THEN
            IF OLD.image_url IS DISTINCT FROM NEW.image_url AND OLD.image_url IS NOT NULL THEN
                INSERT INTO file_cleanup_log (file_url, file_type) VALUES (OLD.image_url, 'discussion_image');
            END IF;
            IF OLD.voice_recording_url IS DISTINCT FROM NEW.voice_recording_url AND OLD.voice_recording_url IS NOT NULL THEN
                INSERT INTO file_cleanup_log (file_url, file_type) VALUES (OLD.voice_recording_url, 'voice_recording');
            END IF;
        ELSIF TG_TABLE_NAME = 'tour_photos' AND OLD.image_url IS DISTINCT FROM NEW.image_url AND OLD.image_url IS NOT NULL THEN
            INSERT INTO file_cleanup_log (file_url, file_type) VALUES (OLD.image_url, 'tour_photo');
        ELSIF TG_TABLE_NAME = 'shopping_item_images' AND OLD.image_url IS DISTINCT FROM NEW.image_url AND OLD.image_url IS NOT NULL THEN
            INSERT INTO file_cleanup_log (file_url, file_type) VALUES (OLD.image_url, 'shopping_item_image');
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tour_photos_file_cleanup_trigger ON tour_photos;
CREATE TRIGGER tour_photos_file_cleanup_trigger
AFTER DELETE OR UPDATE ON tour_photos
FOR EACH ROW EXECUTE FUNCTION log_file_for_cleanup();

DROP TRIGGER IF EXISTS shopping_item_images_file_cleanup_trigger ON shopping_item_images;
CREATE TRIGGER shopping_item_images_file_cleanup_trigger
AFTER DELETE OR UPDATE ON shopping_item_images
FOR EACH ROW EXECUTE FUNCTION log_file_for_cleanup();

-- 3. Scrub deletion-request PII when the account is erased ------------------
-- account_deletion_requests.user_id is ON DELETE SET NULL, so its email/name/
-- reason would otherwise outlive the erased account indefinitely. Null those
-- fields for the user's requests just before the account row is deleted, so
-- every deletion path (self-service, admin, user-management) is covered.

CREATE OR REPLACE FUNCTION scrub_deletion_request_pii()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE account_deletion_requests
    SET user_email = '[erased]', user_name = NULL, reason = NULL
    WHERE user_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_scrub_deletion_request_pii ON users;
CREATE TRIGGER users_scrub_deletion_request_pii
BEFORE DELETE ON users
FOR EACH ROW EXECUTE FUNCTION scrub_deletion_request_pii();
