import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { registerUser, loginUser, setupAccount, changePassword, createPasswordResetRequest, createPasswordResetRequestByEmail, CreateUserData, LoginData } from './auth.service';
import { query } from '../../config/db';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const userData: CreateUserData = req.body;
    const user = await registerUser(userData);

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    
    if (error.message === 'User with this email already exists') {
      res.status(409).json({ error: error.message });
      return;
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const loginData: LoginData = req.body;
    const authResult = await loginUser(loginData);

    res.status(200).json({
      message: 'Login successful',
      token: authResult.token,
      user: authResult.user
    });
  } catch (error: any) {
    console.error('Login error:', error);

    if (error.message === 'PASSWORD_NOT_SET') {
      res.status(403).json({
        error: 'PASSWORD_NOT_SET',
        message: 'Please complete your account setup using the setup code provided by your administrator'
      });
      return;
    }

    if (error.message === 'Invalid credentials') {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Setup account - First-time password setup with setup code
 */
export const setupAccountController = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const { email, setup_code, password } = req.body;
    const authResult = await setupAccount(email, setup_code, password);

    res.status(200).json({
      message: 'Account setup successful',
      token: authResult.token,
      user: authResult.user
    });
  } catch (error: any) {
    console.error('Setup account error:', error);

    if (error.message === 'Invalid or expired setup code') {
      res.status(400).json({ error: 'Invalid or expired setup code' });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Change password - Requires current password
 */
export const changePasswordController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const { current_password, new_password } = req.body;
    await changePassword(req.user.id, current_password, new_password);

    res.status(200).json({
      message: 'Password changed successfully'
    });
  } catch (error: any) {
    console.error('Change password error:', error);

    if (error.message === 'Current password is incorrect') {
      res.status(400).json({ error: 'Current password is incorrect' });
      return;
    }

    if (error.message === 'User not found') {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Request password reset - User requests admin to reset password (authenticated)
 */
export const requestPasswordResetController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    await createPasswordResetRequest(req.user.id);

    res.status(201).json({
      message: 'Password reset request submitted. An administrator will process your request shortly.'
    });
  } catch (error: any) {
    console.error('Request password reset error:', error);

    if (error.message === 'You already have a pending password reset request') {
      res.status(409).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Request password reset by email - For unauthenticated users who forgot password
 */
export const requestPasswordResetByEmailController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    await createPasswordResetRequestByEmail(email);

    // Always return success message (don't reveal if email exists)
    res.status(201).json({
      message: 'If an account exists with this email, a password reset request has been submitted. An administrator will contact you shortly.'
    });
  } catch (error: any) {
    console.error('Request password reset by email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete account - User deletes their own account
 */
export const deleteAccountController = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { reason } = req.body;
    const userId = req.user.id;

    // Get user info before deletion for audit
    const userResult = await query(`
      SELECT email, first_name, last_name, role
      FROM users
      WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = userResult.rows[0];

    // Insert audit record
    await query(`
      INSERT INTO account_deletion_audit (user_id, user_email, user_name, user_role, deletion_type, reason)
      VALUES ($1, $2, $3, $4, 'self', $5)
    `, [
      userId,
      user.email,
      `${user.first_name} ${user.last_name}`,
      user.role,
      reason || 'User requested account deletion'
    ]);

    // Delete user (cascade will delete all related records)
    await query('DELETE FROM users WHERE id = $1', [userId]);

    res.status(200).json({
      message: 'Account deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};