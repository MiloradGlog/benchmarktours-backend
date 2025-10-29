import { query } from '../../config/db';
import { fileStorageService } from '../../services/FileStorageService';

export type ActivityType = 'CompanyVisit' | 'Hotel' | 'Restaurant' | 'Travel' | 'Discussion';

export interface Activity {
  id: number;
  tour_id: number;
  company_id?: number;
  company_name?: string;
  type: ActivityType;
  title: string;
  description?: string;
  start_time: Date;
  end_time: Date;
  location_details?: string;
  survey_url?: string;
  image_url?: string;
  linked_activity_id?: number; // For linking discussions to other activities
  created_at: Date;
  updated_at: Date;
  // Rating fields
  average_rating?: number;
  total_reviews?: number;
}

export interface CreateActivityData {
  tour_id: number;
  company_id?: number;
  type: ActivityType;
  title: string;
  description?: string;
  start_time: Date;
  end_time: Date;
  location_details?: string;
  survey_url?: string;
  image_url?: string;
  linked_activity_id?: number;
}

export interface UpdateActivityData {
  company_id?: number;
  type?: ActivityType;
  title?: string;
  description?: string;
  start_time?: Date;
  end_time?: Date;
  location_details?: string;
  survey_url?: string;
  image_url?: string;
  linked_activity_id?: number;
}

export const createActivity = async (activityData: CreateActivityData): Promise<Activity> => {
  const { tour_id, company_id, type, title, description, start_time, end_time, location_details, survey_url, image_url, linked_activity_id } = activityData;

  const result = await query(`
    INSERT INTO activities (tour_id, company_id, type, title, description, start_time, end_time, location_details, survey_url, image_url, linked_activity_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id, tour_id, company_id, type, title, description, start_time, end_time, location_details, survey_url, image_url, linked_activity_id, created_at, updated_at
  `, [tour_id, company_id || null, type, title, description || null, start_time, end_time, location_details || null, survey_url || null, image_url || null, linked_activity_id || null]);

  return result.rows[0];
};

export const getActivitiesByTour = async (tourId: number): Promise<Activity[]> => {
  const result = await query(`
    SELECT
      a.id, a.tour_id, a.company_id, a.type, a.title, a.description,
      a.start_time, a.end_time, a.location_details, a.survey_url, a.image_url, a.linked_activity_id, a.created_at, a.updated_at,
      c.name as company_name,
      COALESCE(AVG(ar.rating), 0)::numeric(3,2) as average_rating,
      COUNT(ar.id)::integer as total_reviews
    FROM activities a
    LEFT JOIN companies c ON a.company_id = c.id
    LEFT JOIN activity_reviews ar ON a.id = ar.activity_id
    WHERE a.tour_id = $1
    GROUP BY a.id, c.name
    ORDER BY a.start_time ASC
  `, [tourId]);

  const activities = result.rows.map(row => ({
    ...row,
    average_rating: parseFloat(row.average_rating) || 0,
    total_reviews: row.total_reviews || 0
  }));

  // Transform image_url fields from paths to fresh signed URLs
  return await fileStorageService.transformUrlFieldsInArray(activities, ['image_url']);
};

export const getActivityById = async (id: number): Promise<Activity | null> => {
  const result = await query(`
    SELECT
      a.id, a.tour_id, a.company_id, a.type, a.title, a.description,
      a.start_time, a.end_time, a.location_details, a.survey_url, a.image_url, a.linked_activity_id, a.created_at, a.updated_at,
      c.name as company_name,
      COALESCE(AVG(ar.rating), 0)::numeric(3,2) as average_rating,
      COUNT(ar.id)::integer as total_reviews
    FROM activities a
    LEFT JOIN companies c ON a.company_id = c.id
    LEFT JOIN activity_reviews ar ON a.id = ar.activity_id
    WHERE a.id = $1
    GROUP BY a.id, c.name
  `, [id]);

  const activity = result.rows[0];
  if (!activity) return null;

  const processedActivity = {
    ...activity,
    average_rating: parseFloat(activity.average_rating) || 0,
    total_reviews: activity.total_reviews || 0
  };

  // Transform image_url field from path to fresh signed URL
  return await fileStorageService.transformUrlFields(processedActivity, ['image_url']);
};

export const updateActivity = async (id: number, updateData: UpdateActivityData): Promise<Activity | null> => {
  const { company_id, type, title, description, start_time, end_time, location_details, survey_url, image_url, linked_activity_id } = updateData;

  // Get current activity to check if we need to delete old image
  let oldImageUrl: string | null = null;
  if (image_url !== undefined) {
    const current = await getActivityById(id);
    if (current && current.image_url && current.image_url !== image_url) {
      oldImageUrl = current.image_url;
    }
  }

  const result = await query(`
    UPDATE activities
    SET
      company_id = COALESCE($2, company_id),
      type = COALESCE($3, type),
      title = COALESCE($4, title),
      description = COALESCE($5, description),
      start_time = COALESCE($6, start_time),
      end_time = COALESCE($7, end_time),
      location_details = COALESCE($8, location_details),
      survey_url = COALESCE($9, survey_url),
      image_url = COALESCE($10, image_url),
      linked_activity_id = COALESCE($11, linked_activity_id),
      updated_at = NOW()
    WHERE id = $1
    RETURNING id, tour_id, company_id, type, title, description, start_time, end_time, location_details, survey_url, image_url, linked_activity_id, created_at, updated_at
  `, [id, company_id, type, title, description, start_time, end_time, location_details, survey_url, image_url, linked_activity_id]);
  
  // If update was successful and we have an old image to delete
  if (result.rows[0] && oldImageUrl) {
    await fileStorageService.deleteFileByUrl(oldImageUrl);
  }
  
  return result.rows[0] || null;
};

export const deleteActivity = async (id: number): Promise<boolean> => {
  // Get activity first to retrieve image URL
  const activity = await getActivityById(id);
  
  const result = await query('DELETE FROM activities WHERE id = $1', [id]);
  
  // If deletion was successful and activity had an image, delete it from GCP
  if (result.rowCount > 0 && activity?.image_url) {
    await fileStorageService.deleteFileByUrl(activity.image_url);
  }
  
  return result.rowCount > 0;
};

export const getCurrentActivity = async (userId: string): Promise<Activity | null> => {
  const result = await query(`
    SELECT DISTINCT
      a.*,
      c.name as company_name,
      AVG(ar.rating) as average_rating,
      COUNT(DISTINCT ar.id) as total_reviews
    FROM activities a
    LEFT JOIN companies c ON a.company_id = c.id
    LEFT JOIN activity_reviews ar ON a.id = ar.activity_id
    INNER JOIN tour_participants tp ON a.tour_id = tp.tour_id
    WHERE tp.user_id = $1
    AND (NOW() AT TIME ZONE 'Asia/Tokyo') BETWEEN a.start_time AND a.end_time
    GROUP BY a.id, c.name
    ORDER BY a.start_time ASC
    LIMIT 1
  `, [userId]);

  if (result.rows.length > 0) {
    // Transform image_url field from path to fresh signed URL
    return await fileStorageService.transformUrlFields(result.rows[0], ['image_url']);
  }

  return null;
};
