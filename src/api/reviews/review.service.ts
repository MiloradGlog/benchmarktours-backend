import { query } from '../../config/db';

export interface ActivityReview {
  id: number;
  user_id: string;
  activity_id: number;
  rating: number;
  review_text?: string;
  created_at: Date;
  updated_at: Date;
  user_name?: string;
}

export interface CreateReviewData {
  user_id: string;
  activity_id: number;
  rating: number;
  review_text?: string;
}

export interface UpdateReviewData {
  rating?: number;
  review_text?: string;
}

export interface ActivityReviewStats {
  activity_id: number;
  average_rating: number;
  total_reviews: number;
  rating_distribution: {
    [key: number]: number; // rating -> count
  };
}

export const createReview = async (reviewData: CreateReviewData): Promise<ActivityReview> => {
  const result = await query(`
    INSERT INTO activity_reviews (user_id, activity_id, rating, review_text)
    VALUES ($1, $2, $3, $4)
    RETURNING id, user_id, activity_id, rating, review_text, created_at, updated_at
  `, [reviewData.user_id, reviewData.activity_id, reviewData.rating, reviewData.review_text]);
  
  return result.rows[0];
};

export const updateReview = async (reviewId: number, userId: string, updateData: UpdateReviewData): Promise<ActivityReview | null> => {
  const fields = [];
  const values = [];
  let paramCount = 1;

  if (updateData.rating !== undefined) {
    fields.push(`rating = $${paramCount++}`);
    values.push(updateData.rating);
  }

  if (updateData.review_text !== undefined) {
    fields.push(`review_text = $${paramCount++}`);
    values.push(updateData.review_text);
  }

  if (fields.length === 0) {
    return null;
  }

  values.push(reviewId, userId);

  const result = await query(`
    UPDATE activity_reviews 
    SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $${paramCount++} AND user_id = $${paramCount++}
    RETURNING id, user_id, activity_id, rating, review_text, created_at, updated_at
  `, values);

  return result.rows[0] || null;
};

export const deleteReview = async (reviewId: number, userId: string): Promise<boolean> => {
  const result = await query(`
    DELETE FROM activity_reviews 
    WHERE id = $1 AND user_id = $2
  `, [reviewId, userId]);

  return result.rowCount > 0;
};

export const getReviewsByActivity = async (activityId: number): Promise<ActivityReview[]> => {
  const result = await query(`
    SELECT 
      ar.id, ar.user_id, ar.activity_id, ar.rating, ar.review_text, 
      ar.created_at, ar.updated_at, u.name as user_name
    FROM activity_reviews ar
    JOIN users u ON ar.user_id = u.id
    WHERE ar.activity_id = $1
    ORDER BY ar.created_at DESC
  `, [activityId]);
  
  return result.rows;
};

export const getReviewsByTour = async (tourId: number): Promise<ActivityReview[]> => {
  const result = await query(`
    SELECT 
      ar.id, ar.user_id, ar.activity_id, ar.rating, ar.review_text, 
      ar.created_at, ar.updated_at, 
      CONCAT(u.first_name, ' ', u.last_name) as user_name, 
      a.title as activity_title
    FROM activity_reviews ar
    JOIN users u ON ar.user_id = u.id
    JOIN activities a ON ar.activity_id = a.id
    WHERE a.tour_id = $1
    ORDER BY ar.created_at DESC
  `, [tourId]);
  
  return result.rows;
};;

export const getUserReviewForActivity = async (userId: string, activityId: number): Promise<ActivityReview | null> => {
  const result = await query(`
    SELECT 
      ar.id, ar.user_id, ar.activity_id, ar.rating, ar.review_text, 
      ar.created_at, ar.updated_at, u.name as user_name
    FROM activity_reviews ar
    JOIN users u ON ar.user_id = u.id
    WHERE ar.user_id = $1 AND ar.activity_id = $2
  `, [userId, activityId]);
  
  return result.rows[0] || null;
};

export const getActivityReviewStats = async (activityId: number): Promise<ActivityReviewStats> => {
  const result = await query(`
    SELECT 
      activity_id,
      AVG(rating)::numeric(3,2) as average_rating,
      COUNT(*)::integer as total_reviews,
      json_object_agg(rating, rating_count) as rating_distribution
    FROM (
      SELECT 
        activity_id,
        rating,
        COUNT(*)::integer as rating_count
      FROM activity_reviews 
      WHERE activity_id = $1
      GROUP BY activity_id, rating
    ) rating_counts
    GROUP BY activity_id
  `, [activityId]);
  
  if (result.rows.length === 0) {
    return {
      activity_id: activityId,
      average_rating: 0,
      total_reviews: 0,
      rating_distribution: {}
    };
  }

  return {
    activity_id: result.rows[0].activity_id,
    average_rating: parseFloat(result.rows[0].average_rating) || 0,
    total_reviews: result.rows[0].total_reviews,
    rating_distribution: result.rows[0].rating_distribution || {}
  };
};

export const getTourReviewStats = async (tourId: number): Promise<{ activities: ActivityReviewStats[], overall: { average_rating: number, total_reviews: number } }> => {
  const result = await query(`
    SELECT 
      a.id as activity_id,
      COALESCE(AVG(ar.rating), 0)::numeric(3,2) as average_rating,
      COUNT(ar.id)::integer as total_reviews,
      COALESCE(json_object_agg(ar.rating, rating_count) FILTER (WHERE ar.rating IS NOT NULL), '{}') as rating_distribution
    FROM activities a
    LEFT JOIN (
      SELECT 
        activity_id,
        rating,
        COUNT(*)::integer as rating_count
      FROM activity_reviews 
      GROUP BY activity_id, rating
    ) rating_counts ON a.id = rating_counts.activity_id
    LEFT JOIN activity_reviews ar ON a.id = ar.activity_id
    WHERE a.tour_id = $1
    GROUP BY a.id
    ORDER BY a.start_time ASC
  `, [tourId]);

  const activities: ActivityReviewStats[] = result.rows.map(row => ({
    activity_id: row.activity_id,
    average_rating: parseFloat(row.average_rating) || 0,
    total_reviews: row.total_reviews,
    rating_distribution: row.rating_distribution || {}
  }));

  const overall = activities.reduce((acc, activity) => ({
    average_rating: acc.total_reviews + activity.total_reviews > 0 ? 
      ((acc.average_rating * acc.total_reviews) + (activity.average_rating * activity.total_reviews)) / (acc.total_reviews + activity.total_reviews) : 0,
    total_reviews: acc.total_reviews + activity.total_reviews
  }), { average_rating: 0, total_reviews: 0 });

  return { activities, overall };
};