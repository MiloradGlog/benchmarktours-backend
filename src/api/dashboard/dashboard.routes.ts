import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.middleware';
import * as dashboardController from './dashboard.controller';

const router = Router();

// Dashboard stats endpoint - available to all authenticated users
router.get('/stats', authenticateToken, dashboardController.getDashboardStatsController);

// Recent activity endpoint - Admin only (contains message content)
router.get('/activity', authenticateToken, requireAdmin, dashboardController.getRecentActivityController);

export default router;
