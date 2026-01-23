/**
 * Combined Admin Routes
 */

import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.middleware';

// Password Reset Controllers
import {
  getPasswordResetRequestsController,
  completePasswordResetController,
  dismissPasswordResetController,
  regenerateSetupCodeController
} from './passwordReset.controller';

// Account Deletion Controllers
import {
  getAccountDeletionRequests,
  approveAccountDeletion,
  dismissAccountDeletion
} from './accountDeletion.controller';

const router = Router();

// All routes require admin authentication
router.use(authenticateToken, requireAdmin);

// Password reset request management
router.get('/password-resets', getPasswordResetRequestsController);
router.post('/password-resets/:id/complete', completePasswordResetController);
router.post('/password-resets/:id/dismiss', dismissPasswordResetController);

// User setup code regeneration
router.post('/users/:id/regenerate-setup-code', regenerateSetupCodeController);

// Account deletion request management
router.get('/account-deletion-requests', getAccountDeletionRequests);
router.post('/account-deletion-requests/:id/approve', approveAccountDeletion);
router.post('/account-deletion-requests/:id/dismiss', dismissAccountDeletion);

export default router;