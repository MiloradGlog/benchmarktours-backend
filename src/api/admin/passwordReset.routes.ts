/**
 * Password Reset Request Management Routes (Admin)
 */

import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.middleware';
import {
  getPasswordResetRequestsController,
  completePasswordResetController,
  dismissPasswordResetController,
  regenerateSetupCodeController
} from './passwordReset.controller';

const router = Router();

// All routes require admin authentication
router.use(authenticateToken, requireAdmin);

// Password reset request management
router.get('/password-resets', getPasswordResetRequestsController);
router.post('/password-resets/:id/complete', completePasswordResetController);
router.post('/password-resets/:id/dismiss', dismissPasswordResetController);

// User setup code regeneration
router.post('/users/:id/regenerate-setup-code', regenerateSetupCodeController);

export default router;
