import { query } from '../../config/db';
import { fileStorageService } from '../../services/FileStorageService';

export interface Note {
  id: number;
  user_id: string;
  activity_id: number;
  title?: string;
  content: string;
  is_private: boolean;
  tags: string[];
  attachments: any[];
  question_id?: number;
  question_text_snapshot?: string;
  created_at: Date;
  updated_at: Date;
  // Joined fields
  user_name?: string;
  activity_title?: string;
  question_text?: string;
}

export interface CreateNoteData {
  user_id: string;
  activity_id: number;
  title?: string;
  content: string;
  is_private?: boolean;
  tags?: string[];
  attachments?: any[];
  question_id?: number;
  question_text_snapshot?: string;
}

export interface UpdateNoteData {
  title?: string;
  content?: string;
  is_private?: boolean;
  tags?: string[];
  attachments?: any[];
}

/**
 * Transform attachment URLs in a single note from file paths to signed URLs
 */
async function transformNoteAttachments(note: Note): Promise<Note> {
  if (!note || !note.attachments || note.attachments.length === 0) {
    return note;
  }

  const transformedAttachments = await Promise.all(
    note.attachments.map(async (attachment: any) => {
      if (attachment && attachment.url) {
        const signedUrl = await fileStorageService.getSignedUrlFromPathOrUrl(attachment.url);
        return {
          ...attachment,
          url: signedUrl
        };
      }
      return attachment;
    })
  );

  return {
    ...note,
    attachments: transformedAttachments
  };
}

/**
 * Transform attachment URLs in an array of notes from file paths to signed URLs
 */
async function transformNotesAttachments(notes: Note[]): Promise<Note[]> {
  if (!notes || notes.length === 0) {
    return notes;
  }

  return Promise.all(notes.map(note => transformNoteAttachments(note)));
}

export const createNote = async (noteData: CreateNoteData): Promise<Note> => {
  const {
    user_id,
    activity_id,
    title,
    content,
    is_private = false,
    tags = [],
    attachments = [],
    question_id,
    question_text_snapshot
  } = noteData;
  
  // Check if the tour has ended (making it read-only)
  const tourCheck = await query(`
    SELECT t.end_date
    FROM activities a
    JOIN tours t ON a.tour_id = t.id
    WHERE a.id = $1
  `, [activity_id]);
  
  if (tourCheck.rows.length > 0) {
    const tourEndDate = new Date(tourCheck.rows[0].end_date);
    const now = new Date();

    if (now > tourEndDate) {
      throw new Error('This tour has ended and is now read-only');
    }
  }
  
  const result = await query(`
    INSERT INTO notes (user_id, activity_id, title, content, is_private, tags, attachments, question_id, question_text_snapshot)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, user_id, activity_id, title, content, is_private, tags, attachments, question_id, question_text_snapshot, created_at, updated_at
  `, [user_id, activity_id, title || null, content, is_private, tags, JSON.stringify(attachments), question_id || null, question_text_snapshot || null]);

  return transformNoteAttachments(result.rows[0]);
};

export const getNotesByActivity = async (activityId: number, userId?: number): Promise<Note[]> => {
  let queryText = `
    SELECT
      n.id, n.user_id, n.activity_id, n.title, n.content, n.is_private,
      n.tags, n.attachments, n.question_id, n.question_text_snapshot, n.created_at, n.updated_at,
      CONCAT(u.first_name, ' ', u.last_name) as user_name,
      a.title as activity_title,
      aq.question_text
    FROM notes n
    LEFT JOIN users u ON n.user_id = u.id
    LEFT JOIN activities a ON n.activity_id = a.id
    LEFT JOIN activity_questions aq ON n.question_id = aq.id
    WHERE n.activity_id = $1
  `;
  
  const params = [activityId];
  
  // If userId is provided, show all notes for that user and public notes from others
  if (userId) {
    queryText += ` AND (n.user_id = $2 OR n.is_private = false)`;
    params.push(userId);
  } else {
    // If no userId, only show public notes
    queryText += ` AND n.is_private = false`;
  }
  
  queryText += ` ORDER BY n.created_at DESC`;

  const result = await query(queryText, params);

  return transformNotesAttachments(result.rows);
};

export const getNotesByUser = async (userId: number): Promise<Note[]> => {
  const result = await query(`
    SELECT
      n.id, n.user_id, n.activity_id, n.title, n.content, n.is_private,
      n.tags, n.attachments, n.question_id, n.question_text_snapshot, n.created_at, n.updated_at,
      CONCAT(u.first_name, ' ', u.last_name) as user_name,
      a.title as activity_title,
      aq.question_text
    FROM notes n
    LEFT JOIN users u ON n.user_id = u.id
    LEFT JOIN activities a ON n.activity_id = a.id
    LEFT JOIN activity_questions aq ON n.question_id = aq.id
    WHERE n.user_id = $1
    ORDER BY n.created_at DESC
  `, [userId]);

  return transformNotesAttachments(result.rows);
};

export const getNoteById = async (id: number, userId?: number): Promise<Note | null> => {
  let queryText = `
    SELECT
      n.id, n.user_id, n.activity_id, n.title, n.content, n.is_private,
      n.tags, n.attachments, n.question_id, n.question_text_snapshot, n.created_at, n.updated_at,
      CONCAT(u.first_name, ' ', u.last_name) as user_name,
      a.title as activity_title,
      aq.question_text
    FROM notes n
    LEFT JOIN users u ON n.user_id = u.id
    LEFT JOIN activities a ON n.activity_id = a.id
    LEFT JOIN activity_questions aq ON n.question_id = aq.id
    WHERE n.id = $1
  `;
  
  const params = [id];
  
  // Only show note if it's public or belongs to the user
  if (userId) {
    queryText += ` AND (n.user_id = $2 OR n.is_private = false)`;
    params.push(userId);
  } else {
    queryText += ` AND n.is_private = false`;
  }
  
  const result = await query(queryText, params);

  const note = result.rows[0] || null;
  return note ? transformNoteAttachments(note) : null;
};

export const updateNote = async (id: number, updateData: UpdateNoteData, userId: number): Promise<Note | null> => {
  const { title, content, is_private, tags, attachments } = updateData;
  
  const result = await query(`
    UPDATE notes
    SET
      title = COALESCE($2, title),
      content = COALESCE($3, content),
      is_private = COALESCE($4, is_private),
      tags = COALESCE($5, tags),
      attachments = COALESCE($6, attachments),
      updated_at = NOW()
    WHERE id = $1 AND user_id = $7
    RETURNING id, user_id, activity_id, title, content, is_private, tags, attachments, question_id, question_text_snapshot, created_at, updated_at
  `, [
    id,
    title,
    content,
    is_private,
    tags,
    attachments ? JSON.stringify(attachments) : null,
    userId
  ]);

  const note = result.rows[0] || null;
  return note ? transformNoteAttachments(note) : null;
};

export const deleteNote = async (id: number, userId: number): Promise<boolean> => {
  const result = await query('DELETE FROM notes WHERE id = $1 AND user_id = $2', [id, userId]);
  return result.rowCount > 0;
};

// Get notes for a specific tour (all activities in the tour)
export const getNotesByTour = async (tourId: number, userId?: number): Promise<Note[]> => {
  let queryText = `
    SELECT
      n.id, n.user_id, n.activity_id, n.title, n.content, n.is_private,
      n.tags, n.attachments, n.question_id, n.question_text_snapshot, n.created_at, n.updated_at,
      CONCAT(u.first_name, ' ', u.last_name) as user_name,
      a.title as activity_title,
      aq.question_text
    FROM notes n
    LEFT JOIN users u ON n.user_id = u.id
    LEFT JOIN activities a ON n.activity_id = a.id
    LEFT JOIN activity_questions aq ON n.question_id = aq.id
    WHERE a.tour_id = $1
  `;
  
  const params = [tourId];
  
  if (userId) {
    queryText += ` AND (n.user_id = $2 OR n.is_private = false)`;
    params.push(userId);
  } else {
    queryText += ` AND n.is_private = false`;
  }
  
  queryText += ` ORDER BY a.start_time ASC, n.created_at DESC`;

  const result = await query(queryText, params);

  return transformNotesAttachments(result.rows);
};