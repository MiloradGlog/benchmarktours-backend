import { Router } from 'express';
import { body } from 'express-validator';
import { authenticateToken, requireAdmin, requireGuideOrHigher } from '../../middleware/auth.middleware';
import {
  getAllUsersController,
  getTourParticipantsController,
  assignUserToTourController,
  unassignUserFromTourController
} from './participants.controller';

const router = Router({ mergeParams: true }); // To access parent route params (tourId)

// Validation middleware
const assignUserValidation = [
  body('userId')
    .isUUID()
    .withMessage('User ID must be a valid UUID')
];

// Routes - these will be mounted at /api/tours/:tourId/participants
// GET - Allow any authenticated user to view participants (access control is in controller)
router.get('/', authenticateToken, getTourParticipantsController);

// POST/DELETE - Keep Admin only for user management operations
router.post('/', authenticateToken, requireAdmin, assignUserValidation, assignUserToTourController);
router.delete('/:userId', authenticateToken, requireAdmin, unassignUserFromTourController);

export default router;