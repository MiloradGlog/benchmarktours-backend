import { query } from '../../config/db';
import { Discussion, DiscussionMessage, markDiscussionAsRead } from '../discussions/discussion.service';

export interface ChatMessage extends DiscussionMessage {
  user_first_name?: string;
}

export interface GetChatMessagesOptions {
  after?: number;
  before?: number;
  limit?: number;
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

// In-memory rate limit: 10 messages per minute per user
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const rateLimitBuckets = new Map<string, number[]>();

export const checkSendRateLimit = (userId: string): boolean => {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (rateLimitBuckets.get(userId) || []).filter(t => t > windowStart);

  if (timestamps.length >= RATE_LIMIT_MAX) {
    rateLimitBuckets.set(userId, timestamps);
    return false;
  }

  timestamps.push(now);
  rateLimitBuckets.set(userId, timestamps);
  return true;
};

/**
 * Get or lazily create the canonical tour chat discussion for a tour.
 */
export const getOrCreateTourChat = async (
  tourId: number,
  userId: string
): Promise<{ discussion: Discussion; unread_count: number }> => {
  let discussion = await getTourChatDiscussion(tourId);

  if (!discussion) {
    const tourResult = await query('SELECT name FROM tours WHERE id = $1', [tourId]);
    if (tourResult.rows.length === 0) {
      throw new Error('Tour not found');
    }

    // Race-safe against concurrent get-or-create thanks to the partial unique index
    await query(`
      INSERT INTO discussions (tour_id, created_by, title, is_tour_chat)
      VALUES ($1, $2, $3, TRUE)
      ON CONFLICT (tour_id) WHERE is_tour_chat DO NOTHING
    `, [tourId, userId, `${tourResult.rows[0].name} Chat`]);

    discussion = await getTourChatDiscussion(tourId);
    if (!discussion) {
      throw new Error('Failed to create tour chat');
    }
  }

  const unreadCount = await getUnreadCount(discussion.id, userId);

  return { discussion, unread_count: unreadCount };
};

const getTourChatDiscussion = async (tourId: number): Promise<Discussion | null> => {
  const result = await query(`
    SELECT d.*, CONCAT(u.first_name, ' ', u.last_name) as creator_name
    FROM discussions d
    LEFT JOIN users u ON d.created_by = u.id
    WHERE d.tour_id = $1 AND d.is_tour_chat
  `, [tourId]);

  return result.rows[0] || null;
};

const getUnreadCount = async (discussionId: number, userId: string): Promise<number> => {
  const result = await query(`
    SELECT COUNT(*)::int as unread_count
    FROM discussion_messages dm
    WHERE dm.discussion_id = $1
      AND dm.created_at > COALESCE(
        (SELECT last_read_at FROM discussion_read_status WHERE discussion_id = $1 AND user_id = $2),
        '1970-01-01'
      )
      AND dm.user_id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = $2)
  `, [discussionId, userId]);

  return result.rows[0]?.unread_count || 0;
};

/**
 * Fetch chat messages with cursor pagination.
 * - `after`: incremental poll — ascending order (cheap catch-up).
 * - `before`: history page — descending order.
 * - neither: latest page, descending order.
 * Excludes messages from users the caller has blocked. Limit capped at 100.
 */
export const getChatMessages = async (
  discussionId: number,
  userId: string,
  options: GetChatMessagesOptions
): Promise<ChatMessage[]> => {
  const limit = Math.min(Math.max(options.limit || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const params: any[] = [discussionId, userId];
  let cursorClause = '';
  let orderClause = 'ORDER BY dm.id DESC';

  if (options.after !== undefined) {
    params.push(options.after);
    cursorClause = `AND dm.id > $${params.length}`;
    orderClause = 'ORDER BY dm.id ASC';
  } else if (options.before !== undefined) {
    params.push(options.before);
    cursorClause = `AND dm.id < $${params.length}`;
  }

  params.push(limit);

  const result = await query(`
    SELECT
      dm.*,
      CONCAT(u.first_name, ' ', u.last_name) as user_name,
      u.first_name as user_first_name,
      u.role as user_role
    FROM discussion_messages dm
    LEFT JOIN users u ON dm.user_id = u.id
    WHERE dm.discussion_id = $1
      AND dm.user_id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = $2)
      ${cursorClause}
    ${orderClause}
    LIMIT $${params.length}
  `, params);

  return result.rows;
};

/**
 * Create a chat message, mark the sender as read.
 * Returns the created message (joined with author info) and the tour name for push.
 */
export const createChatMessage = async (
  tourId: number,
  discussionId: number,
  userId: string,
  content: string
): Promise<{ message: ChatMessage; tourName: string }> => {
  // Keep read-only enforcement for sends (own deletion is the only exemption)
  const { checkTourReadOnlyByTourId } = await import('../../utils/tourAccess');
  await checkTourReadOnlyByTourId(tourId);

  const lockCheck = await query('SELECT is_locked FROM discussions WHERE id = $1', [discussionId]);
  if (lockCheck.rows[0]?.is_locked) {
    throw new Error('Discussion is locked');
  }

  const insertResult = await query(`
    INSERT INTO discussion_messages (discussion_id, user_id, content)
    VALUES ($1, $2, $3)
    RETURNING id
  `, [discussionId, userId, content]);

  const messageId = insertResult.rows[0].id;

  await query('UPDATE discussions SET updated_at = NOW() WHERE id = $1', [discussionId]);

  // Sender has obviously read their own message
  await markDiscussionAsRead(discussionId, userId);

  const messageResult = await query(`
    SELECT
      dm.*,
      CONCAT(u.first_name, ' ', u.last_name) as user_name,
      u.first_name as user_first_name,
      u.role as user_role
    FROM discussion_messages dm
    LEFT JOIN users u ON dm.user_id = u.id
    WHERE dm.id = $1
  `, [messageId]);

  const tourResult = await query('SELECT name FROM tours WHERE id = $1', [tourId]);

  return {
    message: messageResult.rows[0],
    tourName: tourResult.rows[0]?.name || ''
  };
};

/**
 * Mark the tour chat as read for a user (read watermark).
 */
export const markTourChatRead = async (tourId: number, userId: string): Promise<boolean> => {
  const discussion = await getTourChatDiscussion(tourId);
  if (!discussion) {
    return false;
  }

  await markDiscussionAsRead(discussion.id, userId);
  return true;
};

/**
 * Report a message. Idempotent per reporter.
 * Returns false if the message does not exist.
 */
export const reportMessage = async (
  messageId: number,
  reporterId: string,
  reason?: string
): Promise<boolean> => {
  const messageCheck = await query('SELECT id FROM discussion_messages WHERE id = $1', [messageId]);
  if (messageCheck.rows.length === 0) {
    return false;
  }

  await query(`
    INSERT INTO message_reports (message_id, reporter_id, reason)
    VALUES ($1, $2, $3)
    ON CONFLICT (message_id, reporter_id) DO NOTHING
  `, [messageId, reporterId, reason || null]);

  return true;
};

/**
 * Block a user. Idempotent. Returns false if the target user does not exist.
 */
export const blockUser = async (blockerId: string, blockedId: string): Promise<boolean> => {
  const userCheck = await query('SELECT id FROM users WHERE id = $1', [blockedId]);
  if (userCheck.rows.length === 0) {
    return false;
  }

  await query(`
    INSERT INTO user_blocks (blocker_id, blocked_id)
    VALUES ($1, $2)
    ON CONFLICT (blocker_id, blocked_id) DO NOTHING
  `, [blockerId, blockedId]);

  return true;
};

/**
 * Unblock a user. Returns false if the target user does not exist.
 */
export const unblockUser = async (blockerId: string, blockedId: string): Promise<boolean> => {
  const userCheck = await query('SELECT id FROM users WHERE id = $1', [blockedId]);
  if (userCheck.rows.length === 0) {
    return false;
  }

  await query(
    'DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2',
    [blockerId, blockedId]
  );

  return true;
};

/**
 * Upsert an Expo push token (keyed by token).
 */
export const registerPushToken = async (
  userId: string,
  token: string,
  platform?: string
): Promise<void> => {
  await query(`
    INSERT INTO device_push_tokens (user_id, token, platform, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (token)
    DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, updated_at = NOW()
  `, [userId, token, platform || null]);
};

// Remove a device's push token (consent withdrawal / sign-out). Scoped to the
// caller so one user can't unregister another's device.
export const unregisterPushToken = async (userId: string, token: string): Promise<boolean> => {
  const result = await query(
    `DELETE FROM device_push_tokens WHERE token = $1 AND user_id = $2`,
    [token, userId]
  );
  return (result.rowCount ?? 0) > 0;
};
