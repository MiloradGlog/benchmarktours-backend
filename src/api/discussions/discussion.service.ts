import { query } from '../../config/db';
import { fileStorageService } from '../../services/FileStorageService';

export interface Discussion {
  id: number;
  tour_id: number;
  activity_id?: number;
  created_by: string;
  title: string;
  description?: string;
  is_pinned: boolean;
  is_locked: boolean;
  created_at: Date;
  updated_at: Date;
  // Joined fields
  creator_name?: string;
  activity_title?: string;
  message_count?: number;
  last_message_at?: Date;
  unread_count?: number;
}

export interface DiscussionMessage {
  id: number;
  discussion_id: number;
  user_id: string;
  parent_message_id?: number;
  content: string;
  is_edited: boolean;
  edited_at?: Date;
  image_url?: string;
  voice_recording_url?: string;
  created_at: Date;
  // Joined fields
  user_name?: string;
  user_role?: string;
  reactions?: MessageReaction[];
  replies?: DiscussionMessage[];
}

export interface MessageReaction {
  reaction: string;
  count: number;
  user_reacted?: boolean;
}

export interface CreateDiscussionData {
  tour_id: number;
  activity_id?: number;
  created_by: string;
  title: string;
  description?: string;
}

export interface CreateMessageData {
  discussion_id: number;
  user_id: string;
  parent_message_id?: number;
  content: string;
  image_url?: string;
  voice_recording_url?: string;
}

// Discussion CRUD operations
export const createDiscussion = async (data: CreateDiscussionData): Promise<Discussion> => {
  const { tour_id, activity_id, created_by, title, description } = data;
  
  const result = await query(`
    INSERT INTO discussions (tour_id, activity_id, created_by, title, description)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [tour_id, activity_id || null, created_by, title, description || null]);

  return result.rows[0];
};

export const getDiscussionsByTour = async (tourId: number, userId: number): Promise<Discussion[]> => {
  const result = await query(`
    SELECT 
      d.*,
      CONCAT(u.first_name, ' ', u.last_name) as creator_name,
      a.title as activity_title,
      COUNT(DISTINCT dm.id) as message_count,
      MAX(dm.created_at) as last_message_at,
      COUNT(DISTINCT dm2.id) FILTER (
        WHERE dm2.created_at > COALESCE(drs.last_read_at, '1970-01-01')
      ) as unread_count
    FROM discussions d
    LEFT JOIN users u ON d.created_by = u.id
    LEFT JOIN activities a ON d.activity_id = a.id
    LEFT JOIN discussion_messages dm ON d.id = dm.discussion_id
    LEFT JOIN discussion_read_status drs ON d.id = drs.discussion_id AND drs.user_id = $2
    LEFT JOIN discussion_messages dm2 ON d.id = dm2.discussion_id
    WHERE d.tour_id = $1
    GROUP BY d.id, u.first_name, u.last_name, a.title, drs.last_read_at
    ORDER BY d.is_pinned DESC, COALESCE(MAX(dm.created_at), d.created_at) DESC
  `, [tourId, userId]);
  
  return result.rows;
};

export const getDiscussionById = async (id: number, userId: number): Promise<Discussion | null> => {
  const result = await query(`
    SELECT 
      d.*,
      CONCAT(u.first_name, ' ', u.last_name) as creator_name,
      a.title as activity_title,
      COUNT(DISTINCT dm.id) as message_count
    FROM discussions d
    LEFT JOIN users u ON d.created_by = u.id
    LEFT JOIN activities a ON d.activity_id = a.id
    LEFT JOIN discussion_messages dm ON d.id = dm.discussion_id
    WHERE d.id = $1
    GROUP BY d.id, u.first_name, u.last_name, a.title
  `, [id]);
  
  if (result.rows.length > 0) {
    // Mark as read for this user
    await markDiscussionAsRead(id, userId);
  }
  
  return result.rows[0] || null;
};

export const updateDiscussion = async (
  id: number, 
  updates: { title?: string; description?: string; is_pinned?: boolean; is_locked?: boolean }
): Promise<Discussion | null> => {
  const { title, description, is_pinned, is_locked } = updates;
  
  const result = await query(`
    UPDATE discussions 
    SET 
      title = COALESCE($2, title),
      description = COALESCE($3, description),
      is_pinned = COALESCE($4, is_pinned),
      is_locked = COALESCE($5, is_locked),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id, title, description, is_pinned, is_locked]);
  
  return result.rows[0] || null;
};

export const deleteDiscussion = async (id: number): Promise<boolean> => {
  const result = await query('DELETE FROM discussions WHERE id = $1', [id]);
  return result.rowCount > 0;
};

// Message operations
export const createMessage = async (data: CreateMessageData): Promise<DiscussionMessage> => {
  const { discussion_id, user_id, parent_message_id, content, image_url, voice_recording_url } = data;
  
  // Check if discussion is locked
  const discussionCheck = await query(
    'SELECT is_locked FROM discussions WHERE id = $1',
    [discussion_id]
  );
  
  if (discussionCheck.rows[0]?.is_locked) {
    throw new Error('Discussion is locked');
  }
  
  const result = await query(`
    INSERT INTO discussion_messages (discussion_id, user_id, parent_message_id, content, image_url, voice_recording_url)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [discussion_id, user_id, parent_message_id || null, content, image_url || null, voice_recording_url || null]);

  // Update discussion's updated_at timestamp
  await query(
    'UPDATE discussions SET updated_at = NOW() WHERE id = $1',
    [discussion_id]
  );

  return result.rows[0];
};

export const getMessagesByDiscussion = async (discussionId: number, userId: number): Promise<DiscussionMessage[]> => {
  const result = await query(`
    WITH RECURSIVE message_tree AS (
      -- Base case: top-level messages
      SELECT 
        dm.*,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        u.role as user_role,
        0 as depth
      FROM discussion_messages dm
      LEFT JOIN users u ON dm.user_id = u.id
      WHERE dm.discussion_id = $1 AND dm.parent_message_id IS NULL
      
      UNION ALL
      
      -- Recursive case: replies
      SELECT 
        dm.*,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        u.role as user_role,
        mt.depth + 1
      FROM discussion_messages dm
      LEFT JOIN users u ON dm.user_id = u.id
      INNER JOIN message_tree mt ON dm.parent_message_id = mt.id
    )
    SELECT * FROM message_tree
    ORDER BY created_at ASC
  `, [discussionId]);
  
  // Get reactions for all messages
  const messageIds = result.rows.map(m => m.id);
  const reactions = await getMessageReactions(messageIds, userId);
  
  // Attach reactions to messages
  const messages = result.rows.map(message => ({
    ...message,
    reactions: reactions.filter(r => r.message_id === message.id)
  }));
  
  // Build tree structure
  return buildMessageTree(messages);
};

export const updateMessage = async (
  id: number, 
  userId: number, 
  updates: { content?: string; image_url?: string; voice_recording_url?: string }
): Promise<DiscussionMessage | null> => {
  const { content, image_url, voice_recording_url } = updates;
  
  // Get current message to check if we need to delete old media
  let oldImageUrl: string | null = null;
  let oldVoiceUrl: string | null = null;
  
  const currentResult = await query(
    'SELECT image_url, voice_recording_url FROM discussion_messages WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  
  if (currentResult.rows[0]) {
    const current = currentResult.rows[0];
    if (image_url !== undefined && current.image_url && current.image_url !== image_url) {
      oldImageUrl = current.image_url;
    }
    if (voice_recording_url !== undefined && current.voice_recording_url && current.voice_recording_url !== voice_recording_url) {
      oldVoiceUrl = current.voice_recording_url;
    }
  }
  
  const result = await query(`
    UPDATE discussion_messages 
    SET 
      content = COALESCE($3, content),
      image_url = COALESCE($4, image_url),
      voice_recording_url = COALESCE($5, voice_recording_url),
      is_edited = true,
      edited_at = NOW()
    WHERE id = $1 AND user_id = $2
    RETURNING *
  `, [id, userId, content, image_url, voice_recording_url]);
  
  // If update was successful and we have old media to delete
  if (result.rows[0]) {
    if (oldImageUrl) {
      await fileStorageService.deleteFileByUrl(oldImageUrl);
    }
    if (oldVoiceUrl) {
      await fileStorageService.deleteFileByUrl(oldVoiceUrl);
    }
  }
  
  return result.rows[0] || null;
};

export const deleteMessage = async (id: number, userId: number): Promise<boolean> => {
  // Get message first to retrieve media URLs
  const messageResult = await query(
    'SELECT image_url, voice_recording_url FROM discussion_messages WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  
  const message = messageResult.rows[0];
  
  const result = await query(
    'DELETE FROM discussion_messages WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  
  // If deletion was successful and message had media, delete from GCP
  if (result.rowCount > 0 && message) {
    if (message.image_url) {
      await fileStorageService.deleteFileByUrl(message.image_url);
    }
    if (message.voice_recording_url) {
      await fileStorageService.deleteFileByUrl(message.voice_recording_url);
    }
  }
  
  return result.rowCount > 0;
};

// Reaction operations
export const addReaction = async (
  messageId: number, 
  userId: number, 
  reaction: string
): Promise<void> => {
  await query(`
    INSERT INTO message_reactions (message_id, user_id, reaction)
    VALUES ($1, $2, $3)
    ON CONFLICT (message_id, user_id, reaction) DO NOTHING
  `, [messageId, userId, reaction]);
};

export const removeReaction = async (
  messageId: number, 
  userId: number, 
  reaction: string
): Promise<boolean> => {
  const result = await query(`
    DELETE FROM message_reactions 
    WHERE message_id = $1 AND user_id = $2 AND reaction = $3
  `, [messageId, userId, reaction]);
  return result.rowCount > 0;
};

export const getMessageReactions = async (
  messageIds: number[], 
  userId: number
): Promise<any[]> => {
  if (messageIds.length === 0) return [];
  
  const result = await query(`
    SELECT 
      message_id,
      reaction,
      COUNT(*) as count,
      BOOL_OR(user_id = $2) as user_reacted
    FROM message_reactions
    WHERE message_id = ANY($1::int[])
    GROUP BY message_id, reaction
  `, [messageIds, userId]);
  
  return result.rows;
};

// Read status operations
export const markDiscussionAsRead = async (
  discussionId: number, 
  userId: number
): Promise<void> => {
  await query(`
    INSERT INTO discussion_read_status (user_id, discussion_id, last_read_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (user_id, discussion_id) 
    DO UPDATE SET last_read_at = NOW()
  `, [userId, discussionId]);
};

// Post-tour access check
export const checkPostTourAccess = async (tourId: number): Promise<boolean> => {
  const result = await query(`
    SELECT 
      end_date,
      post_tour_access_days
    FROM tours
    WHERE id = $1
  `, [tourId]);
  
  if (!result.rows[0]) return false;
  
  const { end_date, post_tour_access_days } = result.rows[0];
  const tourEndDate = new Date(end_date);
  const accessEndDate = new Date(tourEndDate);
  accessEndDate.setDate(accessEndDate.getDate() + (post_tour_access_days || 30));

  const now = new Date();
  return now <= accessEndDate;
};

// Activity message operations (simplified for Phase 6)
export const createActivityMessage = async (activityId: number, data: any): Promise<DiscussionMessage> => {
  const { user_id, content, image_url, voice_recording_url } = data;
  
  // Get activity and tour information
  const activityCheck = await query(`
    SELECT a.title, a.tour_id, t.end_date
    FROM activities a
    JOIN tours t ON a.tour_id = t.id
    WHERE a.id = $1
  `, [activityId]);
  
  if (activityCheck.rows.length === 0) {
    throw new Error('Activity not found');
  }
  
  const { title: activityTitle, tour_id, end_date } = activityCheck.rows[0];
  
  // Check if the tour has ended (making it read-only)
  const tourEndDate = new Date(end_date);
  const now = new Date();

  if (now > tourEndDate) {
    throw new Error('This tour has ended and is now read-only');
  }
  
  // Check if a discussion already exists for this activity
  let discussionId;
  const existingDiscussion = await query(`
    SELECT id FROM discussions 
    WHERE activity_id = $1
  `, [activityId]);
  
  if (existingDiscussion.rows.length > 0) {
    discussionId = existingDiscussion.rows[0].id;
  } else {
    // Create a new discussion for this activity
    const discussionResult = await query(`
      INSERT INTO discussions (tour_id, activity_id, created_by, title, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [tour_id, activityId, user_id, `${activityTitle} Discussion`, `Discussion for activity: ${activityTitle}`]);
    
    discussionId = discussionResult.rows[0].id;
  }
  
  // Now create the message with the correct discussion_id
  const result = await query(`
    INSERT INTO discussion_messages (discussion_id, user_id, parent_message_id, content, image_url, voice_recording_url)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [discussionId, user_id, null, content, image_url || null, voice_recording_url || null]);

  return result.rows[0];
};

export const getActivityMessages = async (activityId: number): Promise<DiscussionMessage[]> => {
  // First, find the discussion for this activity
  const discussionResult = await query(`
    SELECT id FROM discussions 
    WHERE activity_id = $1
  `, [activityId]);
  
  // If no discussion exists yet, return empty array
  if (discussionResult.rows.length === 0) {
    return [];
  }
  
  const discussionId = discussionResult.rows[0].id;
  
  // Get messages for the discussion
  const result = await query(`
    SELECT 
      dm.*,
      CONCAT(u.first_name, ' ', u.last_name) as user_name,
      u.role as user_role
    FROM discussion_messages dm
    LEFT JOIN users u ON dm.user_id = u.id
    WHERE dm.discussion_id = $1
    ORDER BY dm.created_at ASC
  `, [discussionId]);
  
  return result.rows;
};

// Helper function to build message tree
function buildMessageTree(messages: any[]): any[] {
  const messageMap = new Map();
  const rootMessages: any[] = [];
  
  // First pass: create map
  messages.forEach(message => {
    messageMap.set(message.id, { ...message, replies: [] });
  });
  
  // Second pass: build tree
  messages.forEach(message => {
    if (message.parent_message_id) {
      const parent = messageMap.get(message.parent_message_id);
      if (parent) {
        parent.replies.push(messageMap.get(message.id));
      }
    } else {
      rootMessages.push(messageMap.get(message.id));
    }
  });
  
  return rootMessages;
}