import { Router } from 'express';
import { body } from 'express-validator';
import { authenticateToken, requireAdmin } from '../../middleware/auth.middleware';
import {
  createActivityController,
  getActivitiesByTourController,
  getActivityByIdController,
  updateActivityController,
  deleteActivityController
} from './activity.controller';

const router = Router({ mergeParams: true }); // To access parent route params (tourId)

// Validation middleware
const createActivityValidation = [
  body('type')
    .isIn(['CompanyVisit', 'Hotel', 'Restaurant', 'Travel', 'Discussion'])
    .withMessage('Type must be one of: CompanyVisit, Hotel, Restaurant, Travel, Discussion'),
  body('title')
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Title must be between 2 and 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('start_time')
    .isISO8601()
    .toDate()
    .withMessage('Start time must be a valid date'),
  body('end_time')
    .isISO8601()
    .toDate()
    .withMessage('End time must be a valid date')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.start_time)) {
        throw new Error('End time must be after start time');
      }
      return true;
    }),
  body('company_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Company ID must be a positive integer'),
  body('location_details')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Location details must be less than 500 characters'),
  body('linked_activity_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Linked activity ID must be a positive integer')
];

const updateActivityValidation = [
  body('type')
    .optional()
    .isIn(['CompanyVisit', 'Hotel', 'Restaurant', 'Travel', 'Discussion'])
    .withMessage('Type must be one of: CompanyVisit, Hotel, Restaurant, Travel, Discussion'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Title must be between 2 and 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('start_time')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Start time must be a valid date'),
  body('end_time')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('End time must be a valid date'),
  body('company_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Company ID must be a positive integer'),
  body('location_details')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Location details must be less than 500 characters'),
  body('linked_activity_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Linked activity ID must be a positive integer')
];

// Apply authentication and admin middleware to all routes
router.use(authenticateToken, requireAdmin);

// Routes - these will be mounted at /api/tours/:tourId/activities
router.post('/', createActivityValidation, createActivityController);
router.get('/', getActivitiesByTourController);
router.get('/:activityId', getActivityByIdController);
router.put('/:activityId', updateActivityValidation, updateActivityController);
router.delete('/:activityId', deleteActivityController);

export default router;