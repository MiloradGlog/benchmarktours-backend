import { Router } from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import { authenticateToken, requireAdmin } from '../../middleware/auth.middleware';
import {
  createTourController,
  getAllToursController,
  getTourByIdController,
  updateTourController,
  updateTourStatusController,
  deleteTourController,
  uploadTourLogoController,
  getUserTourStatsController,
  getRecentTourActivityController,
  getAllTourPhotosController
} from './tour.controller';
import activityRoutes from '../activities/activity.routes';
import participantRoutes from './participants.routes';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

// Validation middleware
const createTourValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Name must be between 2 and 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('start_date')
    .isISO8601()
    .toDate()
    .withMessage('Start date must be a valid date'),
  body('end_date')
    .isISO8601()
    .toDate()
    .withMessage('End date must be a valid date')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.start_date)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  body('theme_primary_color')
    .optional()
    .trim()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Theme primary color must be a valid hex color (e.g., #497CED)'),
  body('theme_logo_url')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Theme logo URL must be less than 500 characters')
];

const updateTourValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Name must be between 2 and 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('start_date')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Start date must be a valid date'),
  body('end_date')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('End date must be a valid date'),
  body('theme_primary_color')
    .optional()
    .trim()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Theme primary color must be a valid hex color (e.g., #497CED)'),
  body('theme_logo_url')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Theme logo URL must be less than 500 characters')
];

// Routes with admin-only access
router.post('/', authenticateToken, requireAdmin, createTourValidation, createTourController);
router.get('/', authenticateToken, requireAdmin, getAllToursController);
router.get('/:id', authenticateToken, requireAdmin, getTourByIdController);
router.put('/:id', authenticateToken, requireAdmin, updateTourValidation, updateTourController);
router.patch('/:id/status', authenticateToken, requireAdmin, updateTourStatusController);
router.delete('/:id', authenticateToken, requireAdmin, deleteTourController);
router.post('/:id/upload-logo', authenticateToken, requireAdmin, upload.single('logo'), uploadTourLogoController);

// User-accessible routes
router.get('/:id/stats', authenticateToken, getUserTourStatsController);
router.get('/:id/recent-activity', authenticateToken, getRecentTourActivityController);
router.get('/:id/photos', authenticateToken, getAllTourPhotosController);

// Nested routes - participants has its own auth control, activities need admin
router.use('/:tourId/activities', authenticateToken, requireAdmin, activityRoutes);
router.use('/:tourId/participants', participantRoutes); // Auth handled in participants.routes.ts

export default router;