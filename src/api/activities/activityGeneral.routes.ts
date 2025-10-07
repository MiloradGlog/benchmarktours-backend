import { Router } from 'express';
import { authenticateToken } from '../../middleware/auth.middleware';
import { getCurrentActivityController } from './activity.controller';

const router = Router();

// Get current activity (activity in progress for the authenticated user)
router.get('/activities/current', authenticateToken, getCurrentActivityController);

export default router;