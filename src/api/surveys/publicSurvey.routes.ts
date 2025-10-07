import express from 'express';
import * as publicSurveyController from './publicSurvey.controller';

const router = express.Router();

// Public survey routes (no authentication required)
router.get('/surveys/:token', publicSurveyController.getPublicSurvey);
router.post('/surveys/:token/submit', publicSurveyController.submitPublicSurveyResponse);
router.post('/surveys/:token/save-progress', publicSurveyController.savePublicSurveyProgress);

export default router;