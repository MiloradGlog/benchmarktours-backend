import { query } from '../../config/db';
import bcrypt from 'bcryptjs';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'Admin' | 'User' | 'Guide';
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

export const createUser = async (userData: CreateUserData): Promise<User> => {
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