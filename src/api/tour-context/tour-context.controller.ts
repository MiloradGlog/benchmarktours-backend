import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import {
  getTourContext,
  getActivitiesByDate,
  bulkUpdateActivities,
} from './tour-context.service';
import { ActivityUpdateOperation } from './tour-context.types';

/**
 * GET /api/tour-context?tourId=X
 * Get tour context with boundaries and current date
 */
export const getTourContextController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
      return;
    }

    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const tourId = parseInt(req.query.tourId as string);
    if (isNaN(tourId)) {
      res.status(400).json({ error: 'Invalid tour ID' });
      return;
    }

    const tourContext = await getTourContext(tourId, userId);

    res.status(200).json(tourContext);
  } catch (error: any) {
    console.error('Get tour context error:', error);

    if (error.message === 'User does not have access to this tour') {
      res.status(403).json({ error: error.message });
      return;
    }

    if (error.message === 'Tour not found') {
      res.status(404).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/tour-context/activities?tourId=X&date=YYYY-MM-DD
 * Get activities by date(s) for a tour
 */
export const getActivitiesByDateController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
      return;
    }

    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const tourId = parseInt(req.query.tourId as string);
    if (isNaN(tourId)) {
      res.status(400).json({ error: 'Invalid tour ID' });
      return;
    }

    const dateInput = req.query.date as string | string[] | undefined;
    const includeMetadata = req.query.includeMetadata === 'true';

    const result = await getActivitiesByDate(tourId, userId, dateInput, includeMetadata);

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Get activities by date error:', error);

    if (error.message === 'User does not have access to this tour') {
      res.status(403).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PATCH /api/tour-context/activities/bulk-update
 * Bulk update activities with atomic transaction
 */
export const bulkUpdateActivitiesController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
      return;
    }

    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { tourId, activityIds, operation } = req.body;

    // Validate tourId
    if (!tourId || isNaN(parseInt(tourId))) {
      res.status(400).json({ error: 'Invalid or missing tour ID' });
      return;
    }

    // Validate activityIds
    if (!Array.isArray(activityIds) || activityIds.length === 0) {
      res.status(400).json({ error: 'Activity IDs must be a non-empty array' });
      return;
    }

    // Validate operation
    if (!operation || !operation.type) {
      res.status(400).json({ error: 'Invalid or missing operation' });
      return;
    }

    // Validate operation-specific fields
    switch (operation.type) {
      case 'shift_time':
        if (typeof operation.shiftMinutes !== 'number') {
          res.status(400).json({ error: 'shiftMinutes must be a number' });
          return;
        }
        break;

      case 'move_to_date':
        if (!operation.targetDate) {
          res.status(400).json({ error: 'targetDate is required for move_to_date operation' });
          return;
        }
        break;

      case 'reschedule':
        if (!operation.newStartTime) {
          res.status(400).json({ error: 'newStartTime is required for reschedule operation' });
          return;
        }
        break;

      default:
        res.status(400).json({ error: 'Invalid operation type' });
        return;
    }

    const result = await bulkUpdateActivities(
      parseInt(tourId),
      userId,
      activityIds,
      operation as ActivityUpdateOperation
    );

    // Return appropriate status code based on success
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error: any) {
    console.error('Bulk update activities error:', error);

    if (error.message === 'User does not have access to this tour') {
      res.status(403).json({ error: error.message });
      return;
    }

    if (error.message === 'Tour not found') {
      res.status(404).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Internal server error' });
  }
};
