import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.middleware';
import * as moderationController from './moderation.controller';

const router = Router();

// Moderation queue for reported chat messages (admin only).
router.get('/admin/reports', authenticateToken, requireAdmin, moderationController.getReports);
router.post('/admin/reports/:reportId/resolve', authenticateToken, requireAdmin, moderationController.resolveReport);

export default router;
