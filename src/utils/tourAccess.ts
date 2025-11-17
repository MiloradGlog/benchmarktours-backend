import { query } from '../config/db';

/**
 * Check if a tour is read-only (has ended)
 * Throws an error if the tour has ended
 * @param activityId - The activity ID to check the tour for
 * @throws Error if tour has ended with message 'This tour has ended and is now read-only'
 */
export const checkTourReadOnly = async (activityId: number): Promise<void> => {
  const result = await query(`
    SELECT t.end_date
    FROM activities a
    JOIN tours t ON a.tour_id = t.id
    WHERE a.id = $1
  `, [activityId]);

  if (result.rows.length === 0) {
    throw new Error('Activity not found');
  }

  const tourEndDate = new Date(result.rows[0].end_date);
  const now = new Date();

  if (now > tourEndDate) {
    throw new Error('This tour has ended and is now read-only');
  }
};

/**
 * Check if a tour is read-only by tour ID directly
 * Throws an error if the tour has ended
 * @param tourId - The tour ID to check
 * @throws Error if tour has ended with message 'This tour has ended and is now read-only'
 */
export const checkTourReadOnlyByTourId = async (tourId: number): Promise<void> => {
  const result = await query(`
    SELECT end_date
    FROM tours
    WHERE id = $1
  `, [tourId]);

  if (result.rows.length === 0) {
    throw new Error('Tour not found');
  }

  const tourEndDate = new Date(result.rows[0].end_date);
  const now = new Date();

  if (now > tourEndDate) {
    throw new Error('This tour has ended and is now read-only');
  }
};

/**
 * Check if a tour is read-only via discussion ID
 * Throws an error if the tour has ended
 * @param discussionId - The discussion ID to check the tour for
 * @throws Error if tour has ended with message 'This tour has ended and is now read-only'
 */
export const checkTourReadOnlyByDiscussionId = async (discussionId: number): Promise<void> => {
  const result = await query(`
    SELECT t.end_date
    FROM discussions d
    JOIN tours t ON d.tour_id = t.id
    WHERE d.id = $1
  `, [discussionId]);

  if (result.rows.length === 0) {
    throw new Error('Discussion not found');
  }

  const tourEndDate = new Date(result.rows[0].end_date);
  const now = new Date();

  if (now > tourEndDate) {
    throw new Error('This tour has ended and is now read-only');
  }
};

/**
 * Check if a tour is read-only via note ID
 * Throws an error if the tour has ended
 * @param noteId - The note ID to check the tour for
 * @throws Error if tour has ended with message 'This tour has ended and is now read-only'
 */
export const checkTourReadOnlyByNoteId = async (noteId: number): Promise<void> => {
  const result = await query(`
    SELECT t.end_date
    FROM notes n
    JOIN activities a ON n.activity_id = a.id
    JOIN tours t ON a.tour_id = t.id
    WHERE n.id = $1
  `, [noteId]);

  if (result.rows.length === 0) {
    throw new Error('Note not found');
  }

  const tourEndDate = new Date(result.rows[0].end_date);
  const now = new Date();

  if (now > tourEndDate) {
    throw new Error('This tour has ended and is now read-only');
  }
};

/**
 * Check if a tour is read-only via discussion team ID
 * Throws an error if the tour has ended
 * @param teamId - The team ID to check the tour for
 * @throws Error if tour has ended with message 'This tour has ended and is now read-only'
 */
export const checkTourReadOnlyByTeamId = async (teamId: number): Promise<void> => {
  const result = await query(`
    SELECT t.end_date
    FROM discussion_teams dt
    JOIN activities a ON dt.discussion_activity_id = a.id
    JOIN tours t ON a.tour_id = t.id
    WHERE dt.id = $1
  `, [teamId]);

  if (result.rows.length === 0) {
    throw new Error('Team not found');
  }

  const tourEndDate = new Date(result.rows[0].end_date);
  const now = new Date();

  if (now > tourEndDate) {
    throw new Error('This tour has ended and is now read-only');
  }
};

/**
 * Check if a tour is read-only via discussion team note ID
 * Throws an error if the tour has ended
 * @param noteId - The team note ID to check the tour for
 * @throws Error if tour has ended with message 'This tour has ended and is now read-only'
 */
export const checkTourReadOnlyByTeamNoteId = async (noteId: number): Promise<void> => {
  const result = await query(`
    SELECT t.end_date
    FROM discussion_team_notes dtn
    JOIN discussion_teams dt ON dtn.team_id = dt.id
    JOIN activities a ON dt.discussion_activity_id = a.id
    JOIN tours t ON a.tour_id = t.id
    WHERE dtn.id = $1
  `, [noteId]);

  if (result.rows.length === 0) {
    throw new Error('Team note not found');
  }

  const tourEndDate = new Date(result.rows[0].end_date);
  const now = new Date();

  if (now > tourEndDate) {
    throw new Error('This tour has ended and is now read-only');
  }
};

/**
 * Check if a tour is read-only via discussion message ID
 * Throws an error if the tour has ended
 * @param messageId - The message ID to check the tour for
 * @throws Error if tour has ended with message 'This tour has ended and is now read-only'
 */
export const checkTourReadOnlyByMessageId = async (messageId: number): Promise<void> => {
  const result = await query(`
    SELECT t.end_date
    FROM discussion_messages dm
    JOIN discussions d ON dm.discussion_id = d.id
    JOIN tours t ON d.tour_id = t.id
    WHERE dm.id = $1
  `, [messageId]);

  if (result.rows.length === 0) {
    throw new Error('Message not found');
  }

  const tourEndDate = new Date(result.rows[0].end_date);
  const now = new Date();

  if (now > tourEndDate) {
    throw new Error('This tour has ended and is now read-only');
  }
};

/**
 * Check if a tour is read-only via activity question ID
 * Throws an error if the tour has ended
 * @param questionId - The question ID to check the tour for
 * @throws Error if tour has ended with message 'This tour has ended and is now read-only'
 */
export const checkTourReadOnlyByQuestionId = async (questionId: number): Promise<void> => {
  const result = await query(`
    SELECT t.end_date
    FROM activity_questions aq
    JOIN activities a ON aq.activity_id = a.id
    JOIN tours t ON a.tour_id = t.id
    WHERE aq.id = $1
  `, [questionId]);

  if (result.rows.length === 0) {
    throw new Error('Question not found');
  }

  const tourEndDate = new Date(result.rows[0].end_date);
  const now = new Date();

  if (now > tourEndDate) {
    throw new Error('This tour has ended and is now read-only');
  }
};

/**
 * Check if a tour is read-only via discussion question ID
 * Throws an error if the tour has ended
 * @param questionId - The discussion question ID to check the tour for
 * @throws Error if tour has ended with message 'This tour has ended and is now read-only'
 */
export const checkTourReadOnlyByDiscussionQuestionId = async (questionId: number): Promise<void> => {
  const result = await query(`
    SELECT t.end_date
    FROM discussion_questions dq
    JOIN activities a ON dq.discussion_activity_id = a.id
    JOIN tours t ON a.tour_id = t.id
    WHERE dq.id = $1
  `, [questionId]);

  if (result.rows.length === 0) {
    throw new Error('Discussion question not found');
  }

  const tourEndDate = new Date(result.rows[0].end_date);
  const now = new Date();

  if (now > tourEndDate) {
    throw new Error('This tour has ended and is now read-only');
  }
};
