import { Router } from 'express';
import { authenticateToken } from '../../middleware/auth.middleware';
import { getCurrentActivityController, getAllActivitiesController } from './activity.controller';

const router = Router();

// Get all activities (for admin)
router.get('/activities', authenticateToken, getAllActivitiesController);

// Get current activity (activity in progress for the authenticated user)
router.get('/activities/current', authenticateToken, getCurrentActivityController);

export default router;