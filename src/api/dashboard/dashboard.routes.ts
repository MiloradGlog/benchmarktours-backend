import { Router } from 'express';
import { authenticateToken } from '../../middleware/auth.middleware';
import * as dashboardController from './dashboard.controller';

const router = Router();

// Dashboard stats endpoint - available to all authenticated users
router.get('/stats', authenticateToken, dashboardController.getDashboardStatsController);

// Recent activity endpoint - available to all authenticated users
router.get('/activity', authenticateToken, dashboardController.getRecentActivityController);

export default router;
