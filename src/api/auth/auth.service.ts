import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../../config/db';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'Admin' | 'User' | 'Guide';
  password_set_at?: Date | string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: 'Admin' | 'User' | 'Guide';
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthToken {
  token: string;
  user: Omit<User, 'created_at' | 'updated_at'>;
}

export const registerUser = async (userData: CreateUserData): Promise<User> => {
  const { email, password, first_name, last_name, role } = userData;

  // Check if user already exists
  const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existingUser.rows.length > 0) {
    throw new Error('User with this email already exists');
  }

  // Hash password
  const saltRounds = 12;
  const password_hash = await bcrypt.hash(password, saltRounds);

  // Insert new user
  const result = await query(`
    INSERT INTO users (email, password_hash, first_name, last_name, role)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, email, first_name, last_name, role, created_at, updated_at
  `, [email, password_hash, first_name, last_name, role]);

  return result.rows[0];
};

export const loginUser = async (loginData: LoginData): Promise<AuthToken> => {
  const { email, password } = loginData;

  // Find user by email
  const result = await query(`
    SELECT id, email, password_hash, first_name, last_name, role, password_set_at
    FROM users
    WHERE email = $1
  `, [email]);

  if (result.rows.length === 0) {
    throw new Error('Invalid credentials');
  }

  const user = result.rows[0];

  // Check if user has set a password
  if (!user.password_hash) {
    throw new Error('PASSWORD_NOT_SET');
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }

  // For legacy users: if they have a password but no password_set_at, set it now
  let passwordSetAt = user.password_set_at;
  if (!passwordSetAt) {
    await query(`
      UPDATE users
      SET password_set_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [user.id]);
    passwordSetAt = new Date().toISOString();
  }

  // Generate JWT token
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role
  };

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  const token = jwt.sign(payload, secret, { expiresIn: '7d' });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      password_set_at: passwordSetAt
    }
  };
};

/**
 * Setup account - validates setup code and sets password for first-time users
 */
export const setupAccount = async (email: string, setupCode: string, newPassword: string): Promise<AuthToken> => {
  // Normalize setup code for comparison
  const normalizedCode = setupCode.replace(/[\s-]/g, '').toUpperCase();
  const formattedCode = `${normalizedCode.slice(0, 4)}-${normalizedCode.slice(4)}`;

  // Validate setup code and get user
  const result = await query(`
    SELECT u.id, u.email, u.first_name, u.last_name, u.role
    FROM users u
    INNER JOIN user_setup_codes sc ON u.id = sc.user_id
    WHERE u.email = $1
      AND sc.setup_code = $2
      AND sc.used_at IS NULL
      AND sc.expires_at > NOW()
  `, [email, formattedCode]);

  if (result.rows.length === 0) {
    throw new Error('Invalid or expired setup code');
  }

  const user = result.rows[0];

  // Hash and set password
  const saltRounds = 12;
  const password_hash = await bcrypt.hash(newPassword, saltRounds);

  await query(`
    UPDATE users
    SET password_hash = $1, password_set_at = NOW(), updated_at = NOW()
    WHERE id = $2
  `, [password_hash, user.id]);

  // Mark setup code as used
  await query(`
    UPDATE user_setup_codes
    SET used_at = NOW()
    WHERE user_id = $1 AND setup_code = $2
  `, [user.id, formattedCode]);

  // Get the timestamp we just set
  const passwordSetAt = new Date().toISOString();

  // Generate JWT token
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role
  };

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  const token = jwt.sign(payload, secret, { expiresIn: '7d' });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      password_set_at: passwordSetAt
    }
  };
};

/**
 * Change password for authenticated user
 */
export const changePassword = async (userId: string, currentPassword: string, newPassword: string): Promise<void> => {
  // Get user with password_hash
  const result = await query(`
    SELECT id, password_hash
    FROM users
    WHERE id = $1
  `, [userId]);

  if (result.rows.length === 0) {
    throw new Error('User not found');
  }

  const user = result.rows[0];

  // Verify current password
  const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isPasswordValid) {
    throw new Error('Current password is incorrect');
  }

  // Hash and set new password
  const saltRounds = 12;
  const password_hash = await bcrypt.hash(newPassword, saltRounds);

  await query(`
    UPDATE users
    SET password_hash = $1, password_set_at = NOW(), updated_at = NOW()
    WHERE id = $2
  `, [password_hash, userId]);
};

/**
 * Create password reset request (user requests admin to reset password)
 */
export const createPasswordResetRequest = async (userId: string): Promise<void> => {
  // Check if user has a pending request
  const existingRequest = await query(`
    SELECT id
    FROM password_reset_requests
    WHERE user_id = $1 AND status = 'pending'
  `, [userId]);

  if (existingRequest.rows.length > 0) {
    throw new Error('You already have a pending password reset request');
  }

  await query(`
    INSERT INTO password_reset_requests (user_id)
    VALUES ($1)
  `, [userId]);
};

/**
 * Create password reset request by email (for unauthenticated users who forgot password)
 */
export const createPasswordResetRequestByEmail = async (email: string): Promise<void> => {
  // Look up user by email
  const userResult = await query(`
    SELECT id
    FROM users
    WHERE email = $1
  `, [email.toLowerCase().trim()]);

  if (userResult.rows.length === 0) {
    // Don't reveal if email exists or not (security best practice)
    // Return success anyway to prevent email enumeration
    return;
  }

  const userId = userResult.rows[0].id;

  // Check if user has a pending request
  const existingRequest = await query(`
    SELECT id
    FROM password_reset_requests
    WHERE user_id = $1 AND status = 'pending'
  `, [userId]);

  if (existingRequest.rows.length > 0) {
    // Don't reveal if request already exists (security best practice)
    // Return success anyway
    return;
  }

  await query(`
    INSERT INTO password_reset_requests (user_id)
    VALUES ($1)
  `, [userId]);
};