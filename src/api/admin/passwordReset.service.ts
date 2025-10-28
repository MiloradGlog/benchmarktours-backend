/**
 * Password Reset Request Management Service (Admin)
 */

import { query } from '../../config/db';
import { generateSetupCode, getSetupCodeExpiration } from '../../utils/setupCode';

export interface PasswordResetRequest {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  user_role: string;
  requested_at: Date;
  status: 'pending' | 'completed' | 'dismissed';
  resolved_at?: Date;
  resolved_by?: string;
  resolver_name?: string;
  notes?: string;
}

/**
 * Get all password reset requests (optionally filter by status)
 */
export const getPasswordResetRequests = async (status?: 'pending' | 'completed' | 'dismissed'): Promise<PasswordResetRequest[]> => {
  let queryText = `
    SELECT
      prr.id,
      prr.user_id,
      u.email as user_email,
      CONCAT(u.first_name, ' ', u.last_name) as user_name,
      u.role as user_role,
      prr.requested_at,
      prr.status,
      prr.resolved_at,
      prr.resolved_by,
      CONCAT(resolver.first_name, ' ', resolver.last_name) as resolver_name,
      prr.notes
    FROM password_reset_requests prr
    INNER JOIN users u ON prr.user_id = u.id
    LEFT JOIN users resolver ON prr.resolved_by = resolver.id
  `;

  const params: any[] = [];

  if (status) {
    queryText += ' WHERE prr.status = $1';
    params.push(status);
  }

  queryText += ' ORDER BY prr.requested_at DESC';

  const result = await query(queryText, params);
  return result.rows;
};

/**
 * Complete a password reset request - generates new setup code for user
 */
export const completePasswordResetRequest = async (
  requestId: string,
  adminId: string,
  notes?: string
): Promise<{ setup_code: string }> => {
  // Get request details
  const requestResult = await query(`
    SELECT user_id, status
    FROM password_reset_requests
    WHERE id = $1
  `, [requestId]);

  if (requestResult.rows.length === 0) {
    throw new Error('Password reset request not found');
  }

  const request = requestResult.rows[0];

  if (request.status !== 'pending') {
    throw new Error('Password reset request has already been processed');
  }

  // Generate new setup code
  const setupCode = generateSetupCode();
  const expiresAt = getSetupCodeExpiration(7);

  // Insert setup code
  await query(`
    INSERT INTO user_setup_codes (user_id, setup_code, expires_at)
    VALUES ($1, $2, $3)
  `, [request.user_id, setupCode, expiresAt]);

  // Mark request as completed
  await query(`
    UPDATE password_reset_requests
    SET status = 'completed',
        resolved_at = NOW(),
        resolved_by = $1,
        notes = $2,
        updated_at = NOW()
    WHERE id = $3
  `, [adminId, notes || 'Password reset completed - new setup code generated', requestId]);

  return { setup_code: setupCode };
};

/**
 * Dismiss a password reset request
 */
export const dismissPasswordResetRequest = async (
  requestId: string,
  adminId: string,
  notes?: string
): Promise<void> => {
  const requestResult = await query(`
    SELECT status
    FROM password_reset_requests
    WHERE id = $1
  `, [requestId]);

  if (requestResult.rows.length === 0) {
    throw new Error('Password reset request not found');
  }

  const request = requestResult.rows[0];

  if (request.status !== 'pending') {
    throw new Error('Password reset request has already been processed');
  }

  await query(`
    UPDATE password_reset_requests
    SET status = 'dismissed',
        resolved_at = NOW(),
        resolved_by = $1,
        notes = $2,
        updated_at = NOW()
    WHERE id = $3
  `, [adminId, notes || 'Request dismissed by administrator', requestId]);
};

/**
 * Regenerate setup code for a user (admin function)
 */
export const regenerateSetupCode = async (userId: string): Promise<{ setup_code: string }> => {
  // Verify user exists
  const userResult = await query(`
    SELECT id
    FROM users
    WHERE id = $1
  `, [userId]);

  if (userResult.rows.length === 0) {
    throw new Error('User not found');
  }

  // Generate new setup code
  const setupCode = generateSetupCode();
  const expiresAt = getSetupCodeExpiration(7);

  // Insert setup code
  await query(`
    INSERT INTO user_setup_codes (user_id, setup_code, expires_at)
    VALUES ($1, $2, $3)
  `, [userId, setupCode, expiresAt]);

  return { setup_code: setupCode };
};
