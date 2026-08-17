import express from 'express';
import * as publicSurveyController from './publicSurvey.controller';
import { publicSurveyLimiter } from '../../middleware/rateLimit.middleware';

const router = express.Router();

// Public survey routes (no authentication required) — rate-limited to curb
// token enumeration and scripted PII collection.
router.get('/surveys/:token', publicSurveyLimiter, publicSurveyController.getPublicSurvey);
router.post('/surveys/:token/submit', publicSurveyLimiter, publicSurveyController.submitPublicSurveyResponse);
router.post('/surveys/:token/save-progress', publicSurveyLimiter, publicSurveyController.savePublicSurveyProgress);

export default router;