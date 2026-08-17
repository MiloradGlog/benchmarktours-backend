import { query } from '../../config/db';

export interface ReportRow {
  id: number;
  message_id: number;
  message_content: string | null;
  message_deleted: boolean;
  author_id: string | null;
  author_name: string | null;
  reporter_id: string;
  reporter_name: string | null;
  reason: string | null;
  status: string;
  tour_id: number | null;
  tour_name: string | null;
  created_at: string;
}

/**
 * List message reports for the moderation queue. Defaults to pending. Includes
 * the reported message's current content (null if already deleted), the author,
 * the reporter, and tour context.
 */
export const listReports = async (status: string = 'pending'): Promise<ReportRow[]> => {
  const result = await query(
    `SELECT
        r.id,
        r.message_id,
        dm.content            AS message_content,
        (dm.id IS NULL)       AS message_deleted,
        au.id                 AS author_id,
        CONCAT(au.first_name, ' ', au.last_name) AS author_name,
        r.reporter_id,
        CONCAT(ru.first_name, ' ', ru.last_name) AS reporter_name,
        r.reason,
        r.status,
        d.tour_id,
        t.name                AS tour_name,
        r.created_at
     FROM message_reports r
     LEFT JOIN discussion_messages dm ON dm.id = r.message_id
     LEFT JOIN users au ON au.id = dm.user_id
     LEFT JOIN users ru ON ru.id = r.reporter_id
     LEFT JOIN discussions d ON d.id = dm.discussion_id
     LEFT JOIN tours t ON t.id = d.tour_id
     WHERE r.status = $1
     ORDER BY r.created_at DESC`,
    [status]
  );
  return result.rows;
};

export const countPendingReports = async (): Promise<number> => {
  const result = await query(`SELECT COUNT(*)::int AS n FROM message_reports WHERE status = 'pending'`);
  return result.rows[0]?.n ?? 0;
};

/**
 * Resolve a report. action 'delete' removes the offending message (which
 * cascades its reports away); action 'dismiss' marks the report handled with
 * no deletion. Returns false if the report doesn't exist.
 */
export const resolveReport = async (
  reportId: number,
  action: 'delete' | 'dismiss',
  actorId: string
): Promise<boolean> => {
  const found = await query(`SELECT message_id FROM message_reports WHERE id = $1`, [reportId]);
  if (found.rows.length === 0) return false;

  if (action === 'delete') {
    const messageId = found.rows[0].message_id;
    // Deleting the message cascades and removes all its reports.
    await query(`DELETE FROM discussion_messages WHERE id = $1`, [messageId]);
    return true;
  }

  const upd = await query(
    `UPDATE message_reports
     SET status = 'dismissed', resolved_by = $2, resolved_at = NOW()
     WHERE id = $1`,
    [reportId, actorId]
  );
  return (upd.rowCount ?? 0) > 0;
};
