/**
 * Password Reset Request Management Controller (Admin)
 */

import { Request, Response } from 'express';
import {
  getPasswordResetRequests,
  completePasswordResetRequest,
  dismissPasswordResetRequest,
  regenerateSetupCode
} from './passwordReset.service';

/**
 * Get all password reset requests (GET /api/admin/password-resets)
 */
export const getPasswordResetRequestsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const validStatus = status && ['pending', 'completed', 'dismissed'].includes(status as string)
      ? (status as 'pending' | 'completed' | 'dismissed')
      : undefined;

    const requests = await getPasswordResetRequests(validStatus);

    res.status(200).json({
      success: true,
      requests
    });
  } catch (error) {
    console.error('Get password reset requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Complete password reset request - generates new setup code
 * (POST /api/admin/password-resets/:id/complete)
 */
export const completePasswordResetController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { notes } = req.body;

    const result = await completePasswordResetRequest(id, req.user.id, notes);

    res.status(200).json({
      success: true,
      message: 'Password reset completed. Share the setup code with the user.',
      setup_code: result.setup_code,
      setup_instructions: 'Share this code with the user. They will use it along with their email to set a new password.'
    });
  } catch (error: any) {
    console.error('Complete password reset error:', error);

    if (error.message === 'Password reset request not found') {
      res.status(404).json({ error: error.message });
      return;
    }

    if (error.message === 'Password reset request has already been processed') {
      res.status(409).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Dismiss password reset request
 * (POST /api/admin/password-resets/:id/dismiss)
 */
export const dismissPasswordResetController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { notes } = req.body;

    await dismissPasswordResetRequest(id, req.user.id, notes);

    res.status(200).json({
      success: true,
      message: 'Password reset request dismissed'
    });
  } catch (error: any) {
    console.error('Dismiss password reset error:', error);

    if (error.message === 'Password reset request not found') {
      res.status(404).json({ error: error.message });
      return;
    }

    if (error.message === 'Password reset request has already been processed') {
      res.status(409).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Regenerate setup code for a user
 * (POST /api/admin/users/:id/regenerate-setup-code)
 */
export const regenerateSetupCodeController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await regenerateSetupCode(id);

    res.status(200).json({
      success: true,
      message: 'New setup code generated',
      setup_code: result.setup_code,
      setup_instructions: 'Share this code with the user. They will use it along with their email to set their password.'
    });
  } catch (error: any) {
    console.error('Regenerate setup code error:', error);

    if (error.message === 'User not found') {
      res.status(404).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
};
