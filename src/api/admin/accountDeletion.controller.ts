import { Request, Response } from 'express';
import { query } from '../../config/db';

/**
 * Get all account deletion requests
 */
export const getAccountDeletionRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.query;

    let sql = `
      SELECT
        adr.*,
        u.first_name || ' ' || u.last_name as resolved_by_name
      FROM account_deletion_requests adr
      LEFT JOIN users u ON adr.resolved_by = u.id
    `;

    const params: any[] = [];
    if (status) {
      sql += ' WHERE adr.status = $1';
      params.push(status);
    }

    sql += ' ORDER BY adr.created_at DESC';

    const result = await query(sql, params);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Get account deletion requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Approve an account deletion request and delete the user
 */
export const approveAccountDeletion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { admin_notes } = req.body;
    const adminId = req.user?.id;

    // Get the deletion request
    const requestResult = await query(`
      SELECT * FROM account_deletion_requests
      WHERE id = $1 AND status = 'pending'
    `, [id]);

    if (requestResult.rows.length === 0) {
      res.status(404).json({ error: 'Request not found or already processed' });
      return;
    }

    const request = requestResult.rows[0];

    // Start transaction
    await query('BEGIN');

    try {
      // If user_id exists, delete the user (cascade will handle related records)
      if (request.user_id) {
        // Insert audit record before deletion
        await query(`
          INSERT INTO account_deletion_audit (user_id, user_email, user_name, user_role, deletion_type, reason, deleted_by)
          SELECT
            u.id,
            u.email,
            u.first_name || ' ' || u.last_name,
            u.role,
            'admin',
            $2,
            $3
          FROM users u
          WHERE u.id = $1
        `, [request.user_id, request.reason || 'User requested deletion', adminId]);

        // Delete the user
        await query('DELETE FROM users WHERE id = $1', [request.user_id]);
      }

      // Update the request status
      await query(`
        UPDATE account_deletion_requests
        SET
          status = 'completed',
          admin_notes = $2,
          resolved_by = $3,
          resolved_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `, [id, admin_notes, adminId]);

      await query('COMMIT');

      res.status(200).json({
        message: 'Account deletion approved and processed successfully'
      });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Approve account deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Dismiss an account deletion request
 */
export const dismissAccountDeletion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { admin_notes } = req.body;
    const adminId = req.user?.id;

    const result = await query(`
      UPDATE account_deletion_requests
      SET
        status = 'dismissed',
        admin_notes = $2,
        resolved_by = $3,
        resolved_at = NOW(),
        updated_at = NOW()
      WHERE id = $1 AND status = 'pending'
      RETURNING *
    `, [id, admin_notes || 'Dismissed by admin', adminId]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Request not found or already processed' });
      return;
    }

    res.status(200).json({
      message: 'Account deletion request dismissed successfully'
    });
  } catch (error) {
    console.error('Dismiss account deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};