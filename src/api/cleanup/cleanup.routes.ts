import { Router } from 'express';
import { getCleanupStatsController, processCleanupController } from './cleanup.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();

// Get cleanup statistics (admin only)
router.get('/stats', authenticateToken, getCleanupStatsController);

// Manually trigger cleanup processing (admin only)
router.post('/process', authenticateToken, processCleanupController);

export default router;