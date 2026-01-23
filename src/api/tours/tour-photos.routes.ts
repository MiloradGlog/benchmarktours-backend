import { Router } from 'express';
import { body } from 'express-validator';
import { authenticateToken } from '../../middleware/auth.middleware';
import {
  createTourPhoto,
  deleteTourPhoto
} from './tour-photos.controller';

const router = Router({ mergeParams: true }); // To access parent route params (tourId)

// Validation middleware
const createPhotoValidation = [
  body('image_url')
    .isString()
    .notEmpty()
    .withMessage('image_url is required'),
  body('photo_date')
    .isISO8601()
    .withMessage('photo_date must be a valid date (YYYY-MM-DD)')
];

// Routes - these will be mounted at /api/tours/:tourId/photos
// Note: GET for downloading all photos is handled by the old system at /api/tours/:id/photos
// which combines photos from both notes and tour_photos tables

// POST - Create a new tour photo
router.post('/', authenticateToken, createPhotoValidation, createTourPhoto);

// DELETE - Delete a tour photo (only owner or admin)
router.delete('/:photoId', authenticateToken, deleteTourPhoto);

export default router;
