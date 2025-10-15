import { query } from '../../config/db';
import { fileStorageService } from '../../services/FileStorageService';

export type TourStatus = 'Draft' | 'Pending' | 'Completed';

export interface Tour {
  id: number;
  name: string;
  description?: string;
  start_date: Date;
  end_date: Date;
  status: TourStatus;
  survey_url?: string;
  theme_primary_color?: string;
  theme_logo_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTourData {
  name: string;
  description?: string;
  start_date: Date;
  end_date: Date;
  status?: TourStatus;
  survey_url?: string;
  theme_primary_color?: string;
  theme_logo_url?: string;
}

export interface UpdateTourData {
  name?: string;
  description?: string;
  start_date?: Date;
  end_date?: Date;
  status?: TourStatus;
  survey_url?: string;
  theme_primary_color?: string;
  theme_logo_url?: string;
}

export const createTour = async (tourData: CreateTourData): Promise<Tour> => {
  const { name, description, start_date, end_date, status, survey_url, theme_primary_color, theme_logo_url } = tourData;

  const result = await query(`
    INSERT INTO tours (name, description, start_date, end_date, status, survey_url, theme_primary_color, theme_logo_url)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, name, description, start_date, end_date, status, survey_url, theme_primary_color, theme_logo_url, created_at, updated_at
  `, [name, description || null, start_date, end_date, status || 'Draft', survey_url || null, theme_primary_color || null, theme_logo_url || null]);

  return result.rows[0];
};

export const getAllTours = async (): Promise<Tour[]> => {
  const result = await query(`
    SELECT id, name, description, start_date, end_date, status, survey_url, theme_primary_color, theme_logo_url, created_at, updated_at
    FROM tours
    ORDER BY start_date DESC
  `);

  // Transform theme_logo_url fields from paths to fresh signed URLs
  return await fileStorageService.transformUrlFieldsInArray(result.rows, ['theme_logo_url']);
};;

export const getTourById = async (id: number): Promise<Tour | null> => {
  const result = await query(`
    SELECT id, name, description, start_date, end_date, status, survey_url, theme_primary_color, theme_logo_url, created_at, updated_at
    FROM tours
    WHERE id = $1
  `, [id]);

  const tour = result.rows[0] || null;
  if (!tour) return null;

  // Transform theme_logo_url field from path to fresh signed URL
  return await fileStorageService.transformUrlFields(tour, ['theme_logo_url']);
};;

export const updateTour = async (id: number, updateData: UpdateTourData): Promise<Tour | null> => {
  const { name, description, start_date, end_date, status, survey_url, theme_primary_color, theme_logo_url } = updateData;

  const result = await query(`
    UPDATE tours
    SET
      name = COALESCE($2, name),
      description = COALESCE($3, description),
      start_date = COALESCE($4, start_date),
      end_date = COALESCE($5, end_date),
      status = COALESCE($6, status),
      survey_url = COALESCE($7, survey_url),
      theme_primary_color = COALESCE($8, theme_primary_color),
      theme_logo_url = COALESCE($9, theme_logo_url),
      updated_at = NOW()
    WHERE id = $1
    RETURNING id, name, description, start_date, end_date, status, survey_url, theme_primary_color, theme_logo_url, created_at, updated_at
  `, [id, name, description, start_date, end_date, status, survey_url, theme_primary_color, theme_logo_url]);

  return result.rows[0] || null;
};

export const updateTourStatus = async (id: number, newStatus: TourStatus): Promise<Tour | null> => {
  // Validate state transitions
  const currentTour = await getTourById(id);
  if (!currentTour) {
    throw new Error('Tour not found');
  }

  const validTransitions: Record<TourStatus, TourStatus[]> = {
    'Draft': ['Pending'],
    'Pending': ['Completed'],
    'Completed': [] // No transitions from completed
  };

  if (!validTransitions[currentTour.status].includes(newStatus)) {
    throw new Error(`Invalid status transition from ${currentTour.status} to ${newStatus}`);
  }

  const result = await query(`
    UPDATE tours
    SET status = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING id, name, description, start_date, end_date, status, survey_url, theme_primary_color, theme_logo_url, created_at, updated_at
  `, [id, newStatus]);
  
  return result.rows[0] || null;
};

export const deleteTour = async (id: number): Promise<boolean> => {
  const result = await query('DELETE FROM tours WHERE id = $1', [id]);
  return result.rowCount > 0;
};