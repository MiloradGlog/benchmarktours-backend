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


export interface UserTourStats {
  total_questions_asked: number;
  total_questions_answered: number;
  total_notes: number;
}

export const getUserTourStats = async (tourId: number, userId: string): Promise<UserTourStats> => {
  const result = await query(`
    SELECT
      (
        SELECT COUNT(*)
        FROM activity_questions aq
        JOIN activities a ON aq.activity_id = a.id
        WHERE a.tour_id = $1 AND aq.user_id = $2
      ) as total_questions_asked,
      (
        SELECT COUNT(*)
        FROM notes n
        JOIN activities a ON n.activity_id = a.id
        WHERE a.tour_id = $1 AND n.user_id = $2 AND n.question_id IS NOT NULL
      ) as total_questions_answered,
      (
        SELECT COUNT(*)
        FROM notes n
        JOIN activities a ON n.activity_id = a.id
        WHERE a.tour_id = $1 AND n.user_id = $2
      ) as total_notes
  `, [tourId, userId]);

  return result.rows[0];
};


export interface RecentActivity {
  id: number;
  type: 'note' | 'question';
  user_id: string;
  user_name: string;
  content: string;
  activity_id: number;
  activity_title: string;
  created_at: Date;
  is_own: boolean;
}

export const getRecentTourActivity = async (tourId: number, userId: string): Promise<RecentActivity[]> => {
  const result = await query(`
    SELECT * FROM (
      -- User's notes
      SELECT 
        n.id,
        'note' as type,
        n.user_id,
        u.first_name || ' ' || u.last_name as user_name,
        n.content,
        a.id as activity_id,
        a.title as activity_title,
        n.created_at,
        true as is_own
      FROM notes n
      JOIN activities a ON n.activity_id = a.id
      JOIN users u ON n.user_id = u.id
      WHERE a.tour_id = $1 AND n.user_id = $2
      
      UNION ALL
      
      -- User's questions
      SELECT 
        aq.id,
        'question' as type,
        aq.user_id,
        u.first_name || ' ' || u.last_name as user_name,
        aq.question_text as content,
        a.id as activity_id,
        a.title as activity_title,
        aq.created_at,
        true as is_own
      FROM activity_questions aq
      JOIN activities a ON aq.activity_id = a.id
      JOIN users u ON aq.user_id = u.id
      WHERE a.tour_id = $1 AND aq.user_id = $2
      
      UNION ALL
      
      -- Other users' public notes
      SELECT 
        n.id,
        'note' as type,
        n.user_id,
        u.first_name || ' ' || u.last_name as user_name,
        n.content,
        a.id as activity_id,
        a.title as activity_title,
        n.created_at,
        false as is_own
      FROM notes n
      JOIN activities a ON n.activity_id = a.id
      JOIN users u ON n.user_id = u.id
      WHERE a.tour_id = $1 AND n.user_id != $2 AND n.is_private = false
    ) combined_activity
    ORDER BY created_at DESC
    LIMIT 3
  `, [tourId, userId]);

  return result.rows;
};

export interface Attachment {
  url: string;
  type: 'image' | 'audio' | 'video';
  timestamp?: string;
}

export interface TourPhoto {
  url: string;
  source: 'note' | 'discussion';
  source_name: string; // Activity title or Team name
  created_at: Date;
  created_by?: string;
  author_name?: string;
}

export const getAllTourPhotos = async (tourId: number, userId: string): Promise<TourPhoto[]> => {
  // Verify user is a participant of this tour
  const participantCheck = await query(`
    SELECT 1 FROM tour_participants
    WHERE tour_id = $1 AND user_id = $2
  `, [tourId, userId]);

  if (participantCheck.rows.length === 0) {
    throw new Error('Access denied - user is not a participant of this tour');
  }

  // Get photos from activity notes (user's private notes + all public notes with photos)
  // LIMIT to 500 notes for safety
  const notePhotosResult = await query(`
    SELECT
      n.attachments,
      a.title as activity_title,
      n.created_at,
      n.user_id as created_by,
      u.first_name || ' ' || u.last_name as author_name
    FROM notes n
    JOIN activities a ON n.activity_id = a.id
    JOIN users u ON n.user_id = u.id
    WHERE a.tour_id = $1
      AND (n.user_id = $2 OR n.is_private = false)
      AND n.attachments IS NOT NULL
      AND jsonb_array_length(n.attachments) > 0
    ORDER BY n.created_at DESC
    LIMIT 500
  `, [tourId, userId]);

  // Get photos from discussion team notes (all teams)
  // LIMIT to 500 notes for safety
  const discussionPhotosResult = await query(`
    SELECT
      dtn.attachments,
      dt.name as team_name,
      dtn.created_at,
      dtn.created_by,
      u.first_name || ' ' || u.last_name as author_name
    FROM discussion_team_notes dtn
    JOIN discussion_teams dt ON dtn.team_id = dt.id
    JOIN activities a ON dt.discussion_activity_id = a.id
    JOIN users u ON dtn.created_by = u.id
    WHERE a.tour_id = $1
      AND dtn.attachments IS NOT NULL
      AND jsonb_array_length(dtn.attachments) > 0
    ORDER BY dtn.created_at DESC
    LIMIT 500
  `, [tourId]);

  // Phase 1: Collect all photo metadata and URLs to sign
  interface PhotoMetadata {
    url: string;
    source: 'note' | 'discussion';
    source_name: string;
    created_at: Date;
    created_by?: string;
    author_name?: string;
  }

  const photoMetadata: PhotoMetadata[] = [];
  const urlsToSign: string[] = [];

  // Process note photos
  for (const row of notePhotosResult.rows) {
    const attachments = row.attachments as Attachment[];
    if (Array.isArray(attachments)) {
      for (const attachment of attachments) {
        // Only include image attachments, skip voice notes and other types
        if (attachment?.url && attachment?.type === 'image') {
          photoMetadata.push({
            url: attachment.url, // Store original URL temporarily
            source: 'note',
            source_name: row.activity_title || 'Unknown Activity',
            created_at: row.created_at,
            created_by: row.created_by || undefined,
            author_name: row.author_name || undefined
          });
          urlsToSign.push(attachment.url);
        }
      }
    }
  }

  // Process discussion photos
  for (const row of discussionPhotosResult.rows) {
    const attachments = row.attachments as Attachment[];
    if (Array.isArray(attachments)) {
      for (const attachment of attachments) {
        // Only include image attachments
        if (attachment?.url && attachment?.type === 'image') {
          photoMetadata.push({
            url: attachment.url, // Store original URL temporarily
            source: 'discussion',
            source_name: row.team_name || 'Unknown Team',
            created_at: row.created_at,
            created_by: row.created_by || undefined,
            author_name: row.author_name || undefined
          });
          urlsToSign.push(attachment.url);
        }
      }
    }
  }

  // Phase 2: Batch sign all URLs in parallel for performance
  const signedUrls = await Promise.all(
    urlsToSign.map(url => fileStorageService.getSignedUrlFromPathOrUrl(url))
  );

  // Phase 3: Construct final photo objects with signed URLs
  const photos: TourPhoto[] = [];
  for (let i = 0; i < photoMetadata.length; i++) {
    const signedUrl = signedUrls[i];
    if (signedUrl) {
      photos.push({
        ...photoMetadata[i],
        url: signedUrl
      });
    }
  }

  // Sort all photos by created_at descending
  photos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return photos;
};
