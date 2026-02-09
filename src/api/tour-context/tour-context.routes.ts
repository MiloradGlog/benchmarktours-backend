import express from 'express';
import { query, body } from 'express-validator';
import { authenticateToken } from '../../middleware/auth.middleware';
import {
  getTourContextController,
  getActivitiesByDateController,
  bulkUpdateActivitiesController,
} from './tour-context.controller';

const router = express.Router();

// Validation for getTourContext
const getTourContextValidation = [
  query('tourId')
    .notEmpty()
    .withMessage('Tour ID is required')
    .isInt({ min: 1 })
    .withMessage('Tour ID must be a positive integer'),
];

// Validation for getActivitiesByDate
const getActivitiesByDateValidation = [
  query('tourId')
    .notEmpty()
    .withMessage('Tour ID is required')
    .isInt({ min: 1 })
    .withMessage('Tour ID must be a positive integer'),
  query('date')
    .optional()
    .custom((value) => {
      if (value === 'today') return true;
      if (Array.isArray(value)) {
        return value.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
      }
      return /^\d{4}-\d{2}-\d{2}$/.test(value);
    })
    .withMessage('Date must be "today", YYYY-MM-DD format, or array of dates'),
  query('includeMetadata')
    .optional()
    .isBoolean()
    .withMessage('includeMetadata must be a boolean'),
];

// Validation for bulkUpdateActivities
const bulkUpdateActivation = [
  body('tourId')
    .notEmpty()
    .withMessage('Tour ID is required')
    .isInt({ min: 1 })
    .withMessage('Tour ID must be a positive integer'),
  body('activityIds')
    .isArray({ min: 1 })
    .withMessage('Activity IDs must be a non-empty array')
    .custom((ids) => ids.every((id: any) => Number.isInteger(id) && id > 0))
    .withMessage('All activity IDs must be positive integers'),
  body('operation')
    .notEmpty()
    .withMessage('Operation is required')
    .isObject()
    .withMessage('Operation must be an object'),
  body('operation.type')
    .notEmpty()
    .withMessage('Operation type is required')
    .isIn(['shift_time', 'move_to_date', 'reschedule'])
    .withMessage('Operation type must be shift_time, move_to_date, or reschedule'),
  body('operation.shiftMinutes')
    .if(body('operation.type').equals('shift_time'))
    .notEmpty()
    .withMessage('shiftMinutes is required for shift_time operation')
    .isInt()
    .withMessage('shiftMinutes must be an integer'),
  body('operation.targetDate')
    .if(body('operation.type').equals('move_to_date'))
    .notEmpty()
    .withMessage('targetDate is required for move_to_date operation')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('targetDate must be in YYYY-MM-DD format'),
  body('operation.targetTime')
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('targetTime must be in HH:MM format (24-hour)'),
  body('operation.newStartTime')
    .if(body('operation.type').equals('reschedule'))
    .notEmpty()
    .withMessage('newStartTime is required for reschedule operation')
    .isISO8601()
    .withMessage('newStartTime must be a valid ISO 8601 datetime'),
  body('operation.preserveDuration')
    .optional()
    .isBoolean()
    .withMessage('preserveDuration must be a boolean'),
];

// Routes - all require authentication
router.get('/', authenticateToken, getTourContextValidation, getTourContextController);

router.get(
  '/activities',
  authenticateToken,
  getActivitiesByDateValidation,
  getActivitiesByDateController
);

router.patch(
  '/activities/bulk-update',
  authenticateToken,
  bulkUpdateActivation,
  bulkUpdateActivitiesController
);

export default router;
