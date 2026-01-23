import { query } from '../../config/db';

export interface TourPhoto {
  id: number;
  tour_id: number;
  user_id: number;
  image_url: string;
  caption?: string;
  photo_date: string; // ISO date string
  created_at: string;
  updated_at: string;
}

export interface CreateTourPhotoData {
  image_url: string;
  caption?: string;
  photo_date: string; // ISO date string (YYYY-MM-DD)
}

/**
 * Create a new tour photo
 */
export const createTourPhoto = async (
  tourId: number,
  userId: number,
  data: CreateTourPhotoData
): Promise<TourPhoto> => {
  const result = await query(
    `INSERT INTO tour_photos (tour_id, user_id, image_url, caption, photo_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [tourId, userId, data.image_url, data.caption, data.photo_date]
  );

  return result.rows[0];
};

/**
 * Delete a tour photo
 */
export const deleteTourPhoto = async (
  photoId: number,
  userId: number
): Promise<void> => {
  // Verify the user owns this photo or is admin
  const checkResult = await query(
    `SELECT user_id FROM tour_photos WHERE id = $1`,
    [photoId]
  );

  if (checkResult.rows.length === 0) {
    throw new Error('Photo not found');
  }

  if (checkResult.rows[0].user_id !== userId) {
    // Check if user is admin
    const userResult = await query(
      `SELECT role FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows[0]?.role !== 'admin') {
      throw new Error('Permission denied');
    }
  }

  await query(`DELETE FROM tour_photos WHERE id = $1`, [photoId]);
};
