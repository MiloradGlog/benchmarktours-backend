import { query } from '../../config/db';
import bcrypt from 'bcryptjs';
import { generateSetupCode, getSetupCodeExpiration } from '../../utils/setupCode';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'Admin' | 'User' | 'Guide';
  created_at: Date;
  updated_at: Date;
  password_set_at?: Date | null;
}

export interface CreateUserData {
  email: string;
  password?: string; // Optional - if not provided, user must set via setup code
  first_name: string;
  last_name: string;
  role: 'Admin' | 'User' | 'Guide';
}

export interface SetupCodeInfo {
  setup_code: string;
  expires_at: Date;
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

export const createUser = async (userData: CreateUserData): Promise<{ user: User; setupCode?: string }> => {
  const { email, password, first_name, last_name, role } = userData;

  // Check if user already exists
  const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existingUser.rows.length > 0) {
    throw new Error('User with this email already exists');
  }

  let password_hash: string | null = null;
  let password_set_at: Date | null = null;

  // Hash password if provided
  if (password) {
    const saltRounds = 12;
    password_hash = await bcrypt.hash(password, saltRounds);
    password_set_at = new Date();
  }

  // Insert new user
  const result = await query(`
    INSERT INTO users (email, password_hash, password_set_at, first_name, last_name, role)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, email, first_name, last_name, role, created_at, updated_at, password_set_at
  `, [email, password_hash, password_set_at, first_name, last_name, role]);

  const user = result.rows[0];

  // If no password provided, generate setup code
  if (!password) {
    const setupCode = await createSetupCode(user.id);
    return { user, setupCode };
  }

  return { user };
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
    updateFields.push(`password_set_at = NOW()`);
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

// ============= GDPR Data Export (Art. 20) =============

export interface UserDataExport {
  generated_at: string;
  user: Pick<User, 'id' | 'email' | 'first_name' | 'last_name' | 'role' | 'created_at'>;
  tours: any[];
  chat_messages: any[];
  notes: any[];
  questions: any[];
  team_suggestions: any[];
  photos: any[];
  ai_chat_sessions: any[];
  survey_responses: any[];
  activity_reviews: any[];
  message_reactions: any[];
  shopping_comments: any[];
  shopping_votes: any[];
  device_push_tokens: any[];
  message_reports: any[];
  blocked_users: number;
}

/**
 * Collects all personal data stored for a user across the system.
 * Every query is scoped to the given user id.
 */
export const exportUserData = async (userId: string): Promise<UserDataExport | null> => {
  const userResult = await query(`
    SELECT id, email, first_name, last_name, role, created_at
    FROM users
    WHERE id = $1
  `, [userId]);

  const user = userResult.rows[0];
  if (!user) {
    return null;
  }

  const [
    toursResult,
    chatMessagesResult,
    notesResult,
    questionsResult,
    teamSuggestionsResult,
    photosResult,
    aiSessionsResult,
    aiMessagesResult,
    surveyResponsesResult,
    surveyQuestionResponsesResult,
    reviewsResult,
    reactionsResult,
    shoppingCommentsResult,
    shoppingVotesResult,
    pushTokensResult,
    reportsResult,
    blocksResult
  ] = await Promise.all([
    query(`
      SELECT t.id, t.name, t.start_date, t.end_date
      FROM tours t
      INNER JOIN tour_participants tp ON tp.tour_id = t.id
      WHERE tp.user_id = $1
      ORDER BY t.start_date ASC
    `, [userId]),
    query(`
      SELECT d.tour_id, d.title AS discussion_title, dm.content, dm.created_at
      FROM discussion_messages dm
      INNER JOIN discussions d ON d.id = dm.discussion_id
      WHERE dm.user_id = $1
      ORDER BY dm.created_at ASC
    `, [userId]),
    query(`
      SELECT n.activity_id, a.title AS activity_title, n.title, n.content,
             n.is_private, n.tags, n.question_id, n.created_at, n.updated_at
      FROM notes n
      LEFT JOIN activities a ON a.id = n.activity_id
      WHERE n.user_id = $1
      ORDER BY n.created_at ASC
    `, [userId]),
    query(`
      SELECT q.activity_id, a.title AS activity_title, q.question_text, q.created_at
      FROM activity_questions q
      LEFT JOIN activities a ON a.id = q.activity_id
      WHERE q.user_id = $1
      ORDER BY q.created_at ASC
    `, [userId]),
    query(`
      SELECT text, value, created_at, tour_id
      FROM shopping_items
      WHERE created_by = $1
      ORDER BY created_at ASC
    `, [userId]),
    query(`
      SELECT tour_id, created_at, image_url AS url
      FROM tour_photos
      WHERE user_id = $1
      ORDER BY created_at ASC
    `, [userId]),
    query(`
      SELECT id, tour_id, started_at
      FROM ai_chat_sessions
      WHERE user_id = $1
      ORDER BY started_at ASC
    `, [userId]),
    query(`
      SELECT m.session_id, m.role, m.content, m.created_at
      FROM ai_conversation_messages m
      INNER JOIN ai_chat_sessions s ON s.id = m.session_id
      WHERE s.user_id = $1 AND m.role != 'function'
      ORDER BY m.created_at ASC
    `, [userId]),
    // survey_responses authored by the user (own answers only)
    query(`
      SELECT sr.id, sr.survey_id, s.title AS survey_title,
             sr.started_at, sr.submitted_at, sr.is_complete
      FROM survey_responses sr
      LEFT JOIN surveys s ON s.id = sr.survey_id
      WHERE sr.user_id = $1
      ORDER BY sr.started_at ASC
    `, [userId]),
    // survey_question_responses for the user's own responses, with question text
    query(`
      SELECT sqr.response_id, sqr.question_id, sq.question_text,
             sqr.text_response, sqr.number_response, sqr.date_response,
             sqr.selected_option_ids, sqr.rating_response, sqr.created_at
      FROM survey_question_responses sqr
      INNER JOIN survey_responses sr ON sr.id = sqr.response_id
      LEFT JOIN survey_questions sq ON sq.id = sqr.question_id
      WHERE sr.user_id = $1
      ORDER BY sqr.response_id ASC, sqr.created_at ASC
    `, [userId]),
    // activity_reviews by the user
    query(`
      SELECT ar.activity_id, a.title AS activity_title, ar.rating, ar.review_text,
             ar.created_at, ar.updated_at
      FROM activity_reviews ar
      LEFT JOIN activities a ON a.id = ar.activity_id
      WHERE ar.user_id = $1
      ORDER BY ar.created_at ASC
    `, [userId]),
    // message_reactions by the user
    query(`
      SELECT message_id, reaction, created_at
      FROM message_reactions
      WHERE user_id = $1
      ORDER BY created_at ASC
    `, [userId]),
    // shopping_item_comments by the user
    query(`
      SELECT item_id, text, created_at
      FROM shopping_item_comments
      WHERE user_id = $1
      ORDER BY created_at ASC
    `, [userId]),
    // shopping_item_votes by the user
    query(`
      SELECT item_id, vote_type, created_at
      FROM shopping_item_votes
      WHERE user_id = $1
      ORDER BY created_at ASC
    `, [userId]),
    // device_push_tokens for the user
    query(`
      SELECT token, platform, updated_at
      FROM device_push_tokens
      WHERE user_id = $1
      ORDER BY updated_at ASC
    `, [userId]),
    // message_reports filed by the user — full rows (reason + message_id), not a count
    query(`
      SELECT message_id, reason, created_at
      FROM message_reports
      WHERE reporter_id = $1
      ORDER BY created_at ASC
    `, [userId]),
    query(`
      SELECT COUNT(*)::int AS count FROM user_blocks WHERE blocker_id = $1
    `, [userId])
    // NOTE: discussion_read_status is intentionally SKIPPED — low-value read-position
    // telemetry (last-read pointers), not personal content worth including in an Art.15 copy.
  ]);

  const messagesBySession: Record<string, any[]> = {};
  aiMessagesResult.rows.forEach(row => {
    const list = messagesBySession[row.session_id] || (messagesBySession[row.session_id] = []);
    list.push({ role: row.role, content: row.content, created_at: row.created_at });
  });

  const aiChatSessions = aiSessionsResult.rows.map(session => ({
    id: session.id,
    tour_id: session.tour_id,
    started_at: session.started_at,
    messages: messagesBySession[session.id] || []
  }));

  // Nest each individual question answer under its parent survey response
  const answersByResponse: Record<string, any[]> = {};
  surveyQuestionResponsesResult.rows.forEach(row => {
    const list = answersByResponse[row.response_id] || (answersByResponse[row.response_id] = []);
    list.push({
      question_id: row.question_id,
      question_text: row.question_text,
      text_response: row.text_response,
      number_response: row.number_response,
      date_response: row.date_response,
      selected_option_ids: row.selected_option_ids,
      rating_response: row.rating_response,
      created_at: row.created_at
    });
  });

  const surveyResponses = surveyResponsesResult.rows.map(response => ({
    id: response.id,
    survey_id: response.survey_id,
    survey_title: response.survey_title,
    started_at: response.started_at,
    submitted_at: response.submitted_at,
    is_complete: response.is_complete,
    answers: answersByResponse[response.id] || []
  }));

  return {
    generated_at: new Date().toISOString(),
    user,
    tours: toursResult.rows,
    chat_messages: chatMessagesResult.rows,
    notes: notesResult.rows,
    questions: questionsResult.rows,
    team_suggestions: teamSuggestionsResult.rows,
    photos: photosResult.rows,
    ai_chat_sessions: aiChatSessions,
    survey_responses: surveyResponses,
    activity_reviews: reviewsResult.rows,
    message_reactions: reactionsResult.rows,
    shopping_comments: shoppingCommentsResult.rows,
    shopping_votes: shoppingVotesResult.rows,
    device_push_tokens: pushTokensResult.rows,
    message_reports: reportsResult.rows,
    blocked_users: blocksResult.rows[0].count
  };
};

// ============= Setup Code Management =============

/**
 * Creates a setup code for a user (used when user created without password)
 */
export const createSetupCode = async (userId: string): Promise<string> => {
  const setupCode = generateSetupCode();
  const expiresAt = getSetupCodeExpiration(7); // 7 days validity

  await query(`
    INSERT INTO user_setup_codes (user_id, setup_code, expires_at)
    VALUES ($1, $2, $3)
  `, [userId, setupCode, expiresAt]);

  return setupCode;
};

/**
 * Gets valid (unused and not expired) setup code info for a user
 */
export const getValidSetupCode = async (userId: string): Promise<SetupCodeInfo | null> => {
  const result = await query(`
    SELECT setup_code, expires_at
    FROM user_setup_codes
    WHERE user_id = $1
      AND used_at IS NULL
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
  `, [userId]);

  return result.rows[0] || null;
};

/**
 * Validates setup code and returns user if valid
 */
export const validateSetupCode = async (email: string, setupCode: string): Promise<User | null> => {
  const result = await query(`
    SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.created_at, u.updated_at, u.password_set_at
    FROM users u
    INNER JOIN user_setup_codes sc ON u.id = sc.user_id
    WHERE u.email = $1
      AND sc.setup_code = $2
      AND sc.used_at IS NULL
      AND sc.expires_at > NOW()
  `, [email, setupCode]);

  return result.rows[0] || null;
};

/**
 * Marks setup code as used
 */
export const markSetupCodeAsUsed = async (userId: string, setupCode: string): Promise<void> => {
  await query(`
    UPDATE user_setup_codes
    SET used_at = NOW()
    WHERE user_id = $1 AND setup_code = $2
  `, [userId, setupCode]);
};

/**
 * Sets password for user (used during setup or password change)
 */
export const setUserPassword = async (userId: string, password: string): Promise<void> => {
  const saltRounds = 12;
  const password_hash = await bcrypt.hash(password, saltRounds);

  await query(`
    UPDATE users
    SET password_hash = $1, password_set_at = NOW(), updated_at = NOW()
    WHERE id = $2
  `, [password_hash, userId]);
};

/**
 * Checks if user has set their password
 */
export const hasUserSetPassword = async (userId: string): Promise<boolean> => {
  const result = await query(`
    SELECT password_hash
    FROM users
    WHERE id = $1
  `, [userId]);

  return result.rows[0]?.password_hash !== null;
};
// Self-service rectification of own name (Art. 16). Only first/last name; email
// and role are not user-editable. Returns the updated safe profile.
export const updateOwnProfile = async (
  userId: string,
  fields: { first_name?: string; last_name?: string }
): Promise<any> => {
  const sets: string[] = [];
  const values: any[] = [];
  let i = 1;
  if (fields.first_name !== undefined) { sets.push(`first_name = $${i++}`); values.push(fields.first_name); }
  if (fields.last_name !== undefined) { sets.push(`last_name = $${i++}`); values.push(fields.last_name); }
  if (sets.length === 0) {
    const cur = await query('SELECT id, email, first_name, last_name, role FROM users WHERE id = $1', [userId]);
    return cur.rows[0];
  }
  sets.push('updated_at = NOW()');
  values.push(userId);
  const result = await query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING id, email, first_name, last_name, role`,
    values
  );
  return result.rows[0];
};
