import { query } from '../../config/db';

export interface TourParticipant {
  id: number;
  tour_id: number;
  user_id: string;
  assigned_at: Date;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: 'Admin' | 'User' | 'Guide';
  };
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'Admin' | 'User' | 'Guide';
}

export const getAllUsers = async (): Promise<User[]> => {
  const result = await query(`
    SELECT id, email, first_name, last_name, role
    FROM users
    WHERE role IN ('User', 'Guide')
    ORDER BY first_name, last_name
  `);
  
  return result.rows;
};;

export const getTourParticipants = async (tourId: number): Promise<TourParticipant[]> => {
  const result = await query(`
    SELECT 
      tp.id, tp.tour_id, tp.user_id, tp.assigned_at,
      u.id as user_id, u.email, u.first_name, u.last_name, u.role
    FROM tour_participants tp
    JOIN users u ON tp.user_id = u.id
    WHERE tp.tour_id = $1
    ORDER BY 
      CASE WHEN u.role = 'Guide' THEN 0 ELSE 1 END,
      u.first_name, u.last_name
  `, [tourId]);
  
  return result.rows.map(row => ({
    id: row.id,
    tour_id: row.tour_id,
    user_id: row.user_id,
    assigned_at: row.assigned_at,
    user: {
      id: row.user_id,
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name,
      role: row.role
    }
  }));
};

export const assignUserToTour = async (tourId: number, userId: string): Promise<TourParticipant> => {
  // Check if user is already assigned
  const existing = await query(
    'SELECT id FROM tour_participants WHERE tour_id = $1 AND user_id = $2',
    [tourId, userId]
  );
  
  if (existing.rows.length > 0) {
    throw new Error('User is already assigned to this tour');
  }
  
  // Assign user to tour
  const result = await query(`
    INSERT INTO tour_participants (tour_id, user_id)
    VALUES ($1, $2)
    RETURNING id, tour_id, user_id, assigned_at
  `, [tourId, userId]);
  
  // Get user details
  const userResult = await query(
    'SELECT id, email, first_name, last_name, role FROM users WHERE id = $1',
    [userId]
  );
  
  const participant = result.rows[0];
  const user = userResult.rows[0];
  
  return {
    ...participant,
    user
  };
};

export const unassignUserFromTour = async (tourId: number, userId: string): Promise<boolean> => {
  const result = await query(
    'DELETE FROM tour_participants WHERE tour_id = $1 AND user_id = $2',
    [tourId, userId]
  );
  
  return result.rowCount > 0;
};

export const getUserTours = async (userId: string): Promise<any[]> => {
  const result = await query(`
    SELECT 
      t.id, t.name, t.description, t.start_date, t.end_date, t.status,
      tp.assigned_at
    FROM tours t
    JOIN tour_participants tp ON t.id = tp.tour_id
    WHERE tp.user_id = $1 AND t.status = 'Completed'
    ORDER BY t.start_date DESC
  `, [userId]);
  
  return result.rows;
};

export const getUserTourById = async (userId: string, tourId: number): Promise<any | null> => {
  const result = await query(`
    SELECT 
      t.id, t.name, t.description, t.start_date, t.end_date, t.status, t.survey_url, t.created_at, t.updated_at,
      tp.assigned_at
    FROM tours t
    JOIN tour_participants tp ON t.id = tp.tour_id
    WHERE tp.user_id = $1 AND t.id = $2 AND t.status = 'Completed'
  `, [userId, tourId]);
  
  return result.rows.length > 0 ? result.rows[0] : null;
};

export const getUserTourActivities = async (userId: string, tourId: number): Promise<any[] | null> => {
  // First check if user is assigned to this tour
  const tourCheck = await query(`
    SELECT id FROM tour_participants 
    WHERE user_id = $1 AND tour_id = $2
  `, [userId, tourId]);
  
  if (tourCheck.rows.length === 0) {
    return null; // User not assigned to this tour
  }
  
  // Get activities for the tour with company information
  const result = await query(`
    SELECT 
      a.id, a.tour_id, a.company_id, a.type, a.title, a.description, 
      a.start_time, a.end_time, a.location_details, a.survey_url, a.image_url, a.created_at, a.updated_at,
      c.name as company_name
    FROM activities a
    LEFT JOIN companies c ON a.company_id = c.id
    WHERE a.tour_id = $1
    ORDER BY a.start_time ASC
  `, [tourId]);
  
  return result.rows;
};