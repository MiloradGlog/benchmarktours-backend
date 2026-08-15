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
    const activityId = parseInt(req.params.activityId);
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
