import express from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.middleware';
import * as surveyController from './survey.controller';
import * as publicSurveyController from './publicSurvey.controller';

const router = express.Router();

// Survey CRUD routes (admin only)
router.post('/surveys', authenticateToken, requireAdmin, surveyController.createSurvey);
router.get('/surveys', authenticateToken, surveyController.getAllSurveys);
router.get('/surveys/:id', authenticateToken, surveyController.getSurveyById);
router.put('/surveys/:id', authenticateToken, requireAdmin, surveyController.updateSurvey);
router.delete('/surveys/:id', authenticateToken, requireAdmin, surveyController.deleteSurvey);
router.post('/surveys/:id/duplicate', authenticateToken, requireAdmin, surveyController.duplicateSurvey);

// Question management (admin only)
router.post('/surveys/:id/questions', authenticateToken, requireAdmin, surveyController.addQuestion);
router.put('/questions/:questionId', authenticateToken, requireAdmin, surveyController.updateQuestion);
router.delete('/questions/:questionId', authenticateToken, requireAdmin, surveyController.deleteQuestion);

// Template routes
router.get('/survey-templates', authenticateToken, surveyController.getSurveyTemplates);
router.post('/survey-templates/create', authenticateToken, requireAdmin, surveyController.createSurveyFromTemplate);

// Response routes (users)
router.post('/surveys/:id/submit', authenticateToken, surveyController.submitResponse);
router.post('/surveys/:id/save-progress', authenticateToken, surveyController.saveProgress);
router.get('/surveys/:id/my-response', authenticateToken, surveyController.getUserResponse);

// Analytics routes (admin)
router.get('/surveys/:id/responses', authenticateToken, requireAdmin, surveyController.getSurveyResponses);
router.get('/surveys/:id/stats', authenticateToken, surveyController.getSurveyStats);
router.get('/surveys/:id/aggregated-responses', authenticateToken, surveyController.getAggregatedResponses);

// User available surveys
router.get('/my-surveys', authenticateToken, surveyController.getAvailableSurveys);

// Tour/Activity specific routes
router.get('/tours/:tourId/surveys', authenticateToken, surveyController.getTourSurveys);
router.get('/activities/:activityId/surveys', authenticateToken, surveyController.getActivitySurveys);

// Public access management (admin only)
router.post('/surveys/:id/generate-public-link', authenticateToken, requireAdmin, publicSurveyController.generatePublicAccessToken);
router.delete('/surveys/:id/revoke-public-link', authenticateToken, requireAdmin, publicSurveyController.revokePublicAccess);


export default router;