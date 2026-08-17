import { Request, Response, NextFunction } from 'express';
import { query } from '../config/db';

/**
 * Tour membership checks.
 * Admins may access all tours; everyone else must be a tour participant.
 */

const isTourParticipant = async (tourId: number, userId: string): Promise<boolean> => {
  const result = await query(
    'SELECT 1 FROM tour_participants WHERE tour_id = $1 AND user_id = $2',
    [tourId, userId]
  );
  return result.rows.length > 0;
};

const checkMembership = async (
  req: Request,
  res: Response,
  next: NextFunction,
  tourId: number | null
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (tourId === null || isNaN(tourId)) {
    res.status(400).json({ error: 'Invalid tour reference' });
    return;
  }

  if (req.user.role === 'Admin') {
    next();
    return;
  }

  const isMember = await isTourParticipant(tourId, req.user.id);
  if (!isMember) {
    res.status(403).json({ error: 'You are not a participant of this tour' });
    return;
  }

  next();
};

/**
 * For routes keyed by :tourId
 */
export const requireTourMembership = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await checkMembership(req, res, next, parseInt(req.params.tourId));
  } catch (error) {
    console.error('Error checking tour membership:', error);
    res.status(500).json({ error: 'Failed to verify tour membership' });
  }
};

/**
 * For routes where tour_id is provided in the request body (e.g. POST /discussions)
 */
export const requireTourMembershipByBody = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await checkMembership(req, res, next, parseInt(req.body?.tour_id));
  } catch (error) {
    console.error('Error checking tour membership:', error);
    res.status(500).json({ error: 'Failed to verify tour membership' });
  }
};

/**
 * For routes keyed by :discussionId — resolves the discussion's tour first
 */
export const requireTourMembershipByDiscussionId = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const discussionId = parseInt(req.params.discussionId);
    if (isNaN(discussionId)) {
      res.status(400).json({ error: 'Invalid discussion id' });
      return;
    }

    const result = await query('SELECT tour_id FROM discussions WHERE id = $1', [discussionId]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Discussion not found' });
      return;
    }

    await checkMembership(req, res, next, result.rows[0].tour_id);
  } catch (error) {
    console.error('Error checking tour membership:', error);
    res.status(500).json({ error: 'Failed to verify tour membership' });
  }
};

/**
 * For routes keyed by :messageId — resolves the message's tour first
 */
export const requireTourMembershipByMessageId = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const messageId = parseInt(req.params.messageId);
    if (isNaN(messageId)) {
      res.status(400).json({ error: 'Invalid message id' });
      return;
    }

    const result = await query(`
      SELECT d.tour_id
      FROM discussion_messages dm
      JOIN discussions d ON dm.discussion_id = d.id
      WHERE dm.id = $1
    `, [messageId]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    await checkMembership(req, res, next, result.rows[0].tour_id);
  } catch (error) {
    console.error('Error checking tour membership:', error);
    res.status(500).json({ error: 'Failed to verify tour membership' });
  }
};

/**
 * For routes keyed by :activityId — resolves the activity's tour first
 */
export const requireTourMembershipByActivityId = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Activity routes key the activity as :activityId or :id.
    const activityId = parseInt(req.params.activityId ?? req.params.id);
    if (isNaN(activityId)) {
      res.status(400).json({ error: 'Invalid activity id' });
      return;
    }

    const result = await query('SELECT tour_id FROM activities WHERE id = $1', [activityId]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Activity not found' });
      return;
    }

    await checkMembership(req, res, next, result.rows[0].tour_id);
  } catch (error) {
    console.error('Error checking tour membership:', error);
    res.status(500).json({ error: 'Failed to verify tour membership' });
  }
};

/**
 * For survey analytics routes keyed by :id (survey id). A survey is linked to
 * a tour directly, via an activity, or is standalone. Tour/activity-linked →
 * scope to that tour (admins bypass). Standalone (no tour) → admins only,
 * since there is no participant set to scope to.
 */
export const requireTourMembershipBySurveyId = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const surveyId = parseInt(req.params.id);
    if (isNaN(surveyId)) {
      res.status(400).json({ error: 'Invalid survey id' });
      return;
    }

    const result = await query(
      `SELECT s.tour_id, a.tour_id AS activity_tour_id
       FROM surveys s
       LEFT JOIN activities a ON a.id = s.activity_id
       WHERE s.id = $1`,
      [surveyId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Survey not found' });
      return;
    }

    const tourId: number | null = result.rows[0].tour_id ?? result.rows[0].activity_tour_id ?? null;

    // Standalone survey: no tour to scope to → admins only.
    if (tourId === null) {
      if (req.user.role === 'Admin') {
        next();
      } else {
        res.status(403).json({ error: 'Not authorized' });
      }
      return;
    }

    await checkMembership(req, res, next, tourId);
  } catch (error) {
    console.error('Error checking survey tour membership:', error);
    res.status(500).json({ error: 'Failed to verify access' });
  }
};

/**
 * Generic resolver for routes keyed by an item id that maps to a tour via one
 * SQL lookup. `sql` must SELECT a single `tour_id` column given the id as $1.
 */
const membershipByItem = async (
  req: Request,
  res: Response,
  next: NextFunction,
  paramName: string,
  sql: string,
  notFoundLabel: string
): Promise<void> => {
  try {
    const id = parseInt(req.params[paramName]);
    if (isNaN(id)) {
      res.status(400).json({ error: `Invalid ${notFoundLabel} id` });
      return;
    }
    const result = await query(sql, [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: `${notFoundLabel} not found` });
      return;
    }
    await checkMembership(req, res, next, result.rows[0].tour_id);
  } catch (error) {
    console.error('Error checking tour membership:', error);
    res.status(500).json({ error: 'Failed to verify tour membership' });
  }
};

// Note (:noteId) -> activity -> tour
export const requireTourMembershipByNoteId = (req: Request, res: Response, next: NextFunction) =>
  membershipByItem(req, res, next, 'noteId',
    'SELECT a.tour_id FROM notes n JOIN activities a ON a.id = n.activity_id WHERE n.id = $1', 'Note');

// Review (:reviewId) -> activity -> tour
export const requireTourMembershipByReviewId = (req: Request, res: Response, next: NextFunction) =>
  membershipByItem(req, res, next, 'reviewId',
    'SELECT a.tour_id FROM activity_reviews r JOIN activities a ON a.id = r.activity_id WHERE r.id = $1', 'Review');

// Shopping item (:itemId) -> tour (direct)
export const requireTourMembershipByShoppingItemId = (req: Request, res: Response, next: NextFunction) =>
  membershipByItem(req, res, next, 'itemId',
    'SELECT tour_id FROM shopping_items WHERE id = $1', 'Item');
