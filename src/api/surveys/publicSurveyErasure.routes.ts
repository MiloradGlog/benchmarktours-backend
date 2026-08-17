import express from 'express';
import * as controller from './publicSurveyErasure.controller';
import { authenticateToken, requireAdmin } from '../../middleware/auth.middleware';

const router = express.Router();

// Admin-only GDPR facility for anonymous / public survey respondents (keyed by
// respondent_email). Requests arrive via the controller/DPO who verifies identity
// out of band; access is restricted to admins.
router.get('/admin/public-survey-data', authenticateToken, requireAdmin, controller.getPublicSurveyData);
router.delete('/admin/public-survey-data', authenticateToken, requireAdmin, controller.deletePublicSurveyData);

export default router;
