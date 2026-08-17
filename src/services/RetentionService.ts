import { query } from '../config/db';
import { cleanupService } from './CleanupService';

/**
 * Scheduled data-retention enforcement.
 *
 * Runs on plain intervals (no external scheduler): a daily purge of stale
 * personal data and an hourly sweep of orphaned uploaded files logged by the
 * cascade-cleanup trigger. All logging is counts/ids only — never content.
 *
 * Retention windows:
 *  - ai_proposed_changes: expired/rejected rows deleted after 30 days
 *  - ai_chat_sessions (cascades messages + proposals): deleted after 180 days
 *  - account_deletion_audit: deleted after 90 days (as promised in the
 *    privacy policy)
 *  - file_cleanup_log: cleaned entries pruned after 30 days
 */

const DAILY_MS = 24 * 60 * 60 * 1000;
const HOURLY_MS = 60 * 60 * 1000;

export const runRetentionPurge = async (): Promise<void> => {
  try {
    const proposals = await query(`
      DELETE FROM ai_proposed_changes
      WHERE status IN ('expired', 'rejected')
        AND created_at < NOW() - INTERVAL '30 days'
    `);

    const sessions = await query(`
      DELETE FROM ai_chat_sessions
      WHERE started_at < NOW() - INTERVAL '180 days'
    `);

    const audit = await query(`
      DELETE FROM account_deletion_audit
      WHERE deleted_at < NOW() - INTERVAL '90 days'
    `);

    // Resolved account-deletion requests past 90 days: the request has been
    // actioned, so the queued email/name/reason no longer needs keeping.
    const delRequests = await query(`
      DELETE FROM account_deletion_requests
      WHERE status IN ('completed', 'dismissed')
        AND updated_at < NOW() - INTERVAL '90 days'
    `);

    console.log(
      `Retention purge: ${proposals.rowCount ?? 0} stale AI proposals, ` +
      `${sessions.rowCount ?? 0} old AI sessions, ` +
      `${audit.rowCount ?? 0} expired deletion-audit rows, ` +
      `${delRequests.rowCount ?? 0} resolved deletion requests`
    );

    await cleanupService.cleanupOldLogEntries(30);
  } catch (error) {
    console.error('Retention purge failed:', error);
  }
};

export const startRetentionSchedule = (): void => {
  // Hourly: delete orphaned uploaded files flagged by the DB cleanup trigger
  // (covers media left behind by account-deletion cascades).
  setInterval(() => {
    cleanupService.processPendingCleanups().catch((error) =>
      console.error('File cleanup sweep failed:', error)
    );
  }, HOURLY_MS).unref();

  // Daily: purge data past its retention window. Also run once shortly after
  // boot so infrequently-restarted deploys still enforce retention.
  setInterval(() => {
    runRetentionPurge();
  }, DAILY_MS).unref();

  setTimeout(() => {
    runRetentionPurge();
    cleanupService.processPendingCleanups().catch((error) =>
      console.error('File cleanup sweep failed:', error)
    );
  }, 60 * 1000).unref();
};
