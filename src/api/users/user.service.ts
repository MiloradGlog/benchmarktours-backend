import { query } from '../../config/db';
import bcrypt from 'bcryptjs';
import { generateSetupCode, getSetupCodeExpiration } from '../../utils/setupCode';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'Admin' | 'User' | 'Guide';
  created_at: Date;
  updated_at: Date;
  password_set_at?: Date | null;
}

export interface CreateUserData {
  email: string;
  password?: string; // Optional - if not provided, user must set via setup code
  first_name: string;
  last_name: string;
  role: 'Admin' | 'User' | 'Guide';
}

export interface SetupCodeInfo {
  setup_code: string;
  expires_at: Date;
}

export interface UpdateUserData {
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: 'Admin' | 'User' | 'Guide';
  password?: string;
}

export const getAllUsers = async (): Promise<User[]> => {
  const result = await query(`
    SELECT id, email, first_name, last_name, role, created_at, updated_at
    FROM users
    ORDER BY created_at DESC
  `);
  
  return result.rows;
};

export const getUserById = async (id: string): Promise<User | null> => {
  const result = await query(`
    SELECT id, email, first_name, last_name, role, created_at, updated_at
    FROM users
    WHERE id = $1
  `, [id]);
  
  return result.rows[0] || null;
};

export const createUser = async (userData: CreateUserData): Promise<{ user: User; setupCode?: string }> => {
  const { email, password, first_name, last_name, role } = userData;

  // Check if user already exists
  const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existingUser.rows.length > 0) {
    throw new Error('User with this email already exists');
  }

  let password_hash: string | null = null;
  let password_set_at: Date | null = null;

  // Hash password if provided
  if (password) {
    const saltRounds = 12;
    password_hash = await bcrypt.hash(password, saltRounds);
    password_set_at = new Date();
  }

  // Insert new user
  const result = await query(`
    INSERT INTO users (email, password_hash, password_set_at, first_name, last_name, role)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, email, first_name, last_name, role, created_at, updated_at, password_set_at
  `, [email, password_hash, password_set_at, first_name, last_name, role]);

  const user = result.rows[0];

  // If no password provided, generate setup code
  if (!password) {
    const setupCode = await createSetupCode(user.id);
    return { user, setupCode };
  }

  return { user };
};

export const updateUser = async (id: string, updateData: UpdateUserData): Promise<User | null> => {
  const { email, first_name, last_name, role, password } = updateData;

  // Check if email is being changed and if it's already taken by another user
  if (email) {
    const existingUser = await query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, id]);
    if (existingUser.rows.length > 0) {
      throw new Error('Email is already taken by another user');
    }
  }

  // Build dynamic update query
  const updateFields: string[] = [];
  const updateValues: any[] = [];
  let paramIndex = 2;

  if (email !== undefined) {
    updateFields.push(`email = $${paramIndex}`);
    updateValues.push(email);
    paramIndex++;
  }
  if (first_name !== undefined) {
    updateFields.push(`first_name = $${paramIndex}`);
    updateValues.push(first_name);
    paramIndex++;
  }
  if (last_name !== undefined) {
    updateFields.push(`last_name = $${paramIndex}`);
    updateValues.push(last_name);
    paramIndex++;
  }
  if (role !== undefined) {
    updateFields.push(`role = $${paramIndex}`);
    updateValues.push(role);
    paramIndex++;
  }
  if (password !== undefined) {
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);
    updateFields.push(`password_hash = $${paramIndex}`);
    updateValues.push(password_hash);
    paramIndex++;
    updateFields.push(`password_set_at = NOW()`);
  }

  if (updateFields.length === 0) {
    // No fields to update, just return current user
    return getUserById(id);
  }

  updateFields.push('updated_at = NOW()');

  const result = await query(`
    UPDATE users 
    SET ${updateFields.join(', ')}
    WHERE id = $1
    RETURNING id, email, first_name, last_name, role, created_at, updated_at
  `, [id, ...updateValues]);

  return result.rows[0] || null;
};

export const deleteUser = async (id: string): Promise<boolean> => {
  // Check if user exists
  const userExists = await getUserById(id);
  if (!userExists) {
    return false;
  }

  // Delete user (this will cascade delete related records due to foreign key constraints)
  const result = await query('DELETE FROM users WHERE id = $1', [id]);
  return result.rowCount > 0;
};

export const getUsersCount = async (): Promise<{ total: number; byRole: Record<string, number> }> => {
  const totalResult = await query('SELECT COUNT(*) as total FROM users');
  const roleResult = await query(`
    SELECT role, COUNT(*) as count 
    FROM users 
    GROUP BY role
  `);

  const byRole: Record<string, number> = {};
  roleResult.rows.forEach(row => {
    byRole[row.role] = parseInt(row.count);
  });

  return {
    total: parseInt(totalResult.rows[0].total),
    byRole
  };
};

// Search users by name or email
export const searchUsers = async (searchTerm: string): Promise<User[]> => {
  const result = await query(`
    SELECT id, email, first_name, last_name, role, created_at, updated_at
    FROM users
    WHERE 
      email ILIKE $1 OR 
      CONCAT(first_name, ' ', last_name) ILIKE $1 OR
      first_name ILIKE $1 OR
      last_name ILIKE $1
    ORDER BY first_name, last_name
  `, [`%${searchTerm}%`]);
  
  return result.rows;
};

// Get users by role
export const getUsersByRole = async (role: 'Admin' | 'User' | 'Guide'): Promise<User[]> => {
  const result = await query(`
    SELECT id, email, first_name, last_name, role, created_at, updated_at
    FROM users
    WHERE role = $1
    ORDER BY first_name, last_name
  `, [role]);

  return result.rows;
};

// ============= Setup Code Management =============

/**
 * Creates a setup code for a user (used when user created without password)
 */
export const createSetupCode = async (userId: string): Promise<string> => {
  const setupCode = generateSetupCode();
  const expiresAt = getSetupCodeExpiration(7); // 7 days validity

  await query(`
    INSERT INTO user_setup_codes (user_id, setup_code, expires_at)
    VALUES ($1, $2, $3)
  `, [userId, setupCode, expiresAt]);

  return setupCode;
};

/**
 * Gets valid (unused and not expired) setup code info for a user
 */
export const getValidSetupCode = async (userId: string): Promise<SetupCodeInfo | null> => {
  const result = await query(`
    SELECT setup_code, expires_at
    FROM user_setup_codes
    WHERE user_id = $1
      AND used_at IS NULL
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
  `, [userId]);

  return result.rows[0] || null;
};

/**
 * Validates setup code and returns user if valid
 */
export const validateSetupCode = async (email: string, setupCode: string): Promise<User | null> => {
  const result = await query(`
    SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.created_at, u.updated_at, u.password_set_at
    FROM users u
    INNER JOIN user_setup_codes sc ON u.id = sc.user_id
    WHERE u.email = $1
      AND sc.setup_code = $2
      AND sc.used_at IS NULL
      AND sc.expires_at > NOW()
  `, [email, setupCode]);

  return result.rows[0] || null;
};

/**
 * Marks setup code as used
 */
export const markSetupCodeAsUsed = async (userId: string, setupCode: string): Promise<void> => {
  await query(`
    UPDATE user_setup_codes
    SET used_at = NOW()
    WHERE user_id = $1 AND setup_code = $2
  `, [userId, setupCode]);
};

/**
 * Sets password for user (used during setup or password change)
 */
export const setUserPassword = async (userId: string, password: string): Promise<void> => {
  const saltRounds = 12;
  const password_hash = await bcrypt.hash(password, saltRounds);

  await query(`
    UPDATE users
    SET password_hash = $1, password_set_at = NOW(), updated_at = NOW()
    WHERE id = $2
  `, [password_hash, userId]);
};

/**
 * Checks if user has set their password
 */
export const hasUserSetPassword = async (userId: string): Promise<boolean> => {
  const result = await query(`
    SELECT password_hash
    FROM users
    WHERE id = $1
  `, [userId]);

  return result.rows[0]?.password_hash !== null;
};