import { Request, Response } from 'express';
import * as surveyService from './survey.service';
import * as surveyResponseService from './surveyResponse.service';

// Get survey by public token
export const getPublicSurvey = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('🚀 PUBLIC SURVEY CONTROLLER CALLED - No auth required!');
    const { token } = req.params;

    if (!token) {
      res.status(400).json({ error: 'Survey token is required' });
      return;
    }

    const survey = await surveyService.getSurveyByPublicToken(token);

    if (!survey) {
      res.status(404).json({ error: 'Survey not found or access has expired' });
      return;
    }

    res.json({ survey });
  } catch (error) {
    console.error('Error fetching public survey:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Submit response to public survey
export const submitPublicSurveyResponse = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const responseData = req.body;

    if (!token) {
      res.status(400).json({ error: 'Survey token is required' });
      return;
    }

    // Validate required fields for anonymous responses
    if (!responseData.respondent_email) {
      res.status(400).json({ error: 'Email is required for anonymous survey responses' });
      return;
    }

    if (!responseData.responses || !Array.isArray(responseData.responses)) {
      res.status(400).json({ error: 'Responses array is required' });
      return;
    }

    responseData.survey_id = 0; // Will be set by the service
    responseData.is_anonymous = true;

    const response = await surveyResponseService.submitAnonymousResponse(token, responseData);

    if (!response) {
      res.status(400).json({ error: 'Failed to submit survey response' });
      return;
    }

    res.status(201).json({
      message: 'Survey response submitted successfully',
      response_id: response.id
    });
  } catch (error) {
    console.error('Error submitting public survey response:', error);

    if (error instanceof Error && error.message.includes('Invalid')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

// Save progress for public survey
export const savePublicSurveyProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const responseData = req.body;

    if (!token) {
      res.status(400).json({ error: 'Survey token is required' });
      return;
    }

    responseData.survey_id = 0; // Will be set by the service
    responseData.is_anonymous = true;

    const response = await surveyResponseService.saveAnonymousProgress(token, responseData);

    if (!response) {
      res.status(400).json({ error: 'Failed to save survey progress' });
      return;
    }

    res.json({
      message: 'Survey progress saved successfully',
      response_id: response.id
    });
  } catch (error) {
    console.error('Error saving public survey progress:', error);

    if (error instanceof Error && error.message.includes('Invalid')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

// Generate public access token for a survey (admin only)
export const generatePublicAccessToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const surveyId = parseInt(req.params.id);

    if (isNaN(surveyId)) {
      res.status(400).json({ error: 'Invalid survey ID' });
      return;
    }

    const token = await surveyService.generatePublicAccessToken(surveyId);

    if (!token) {
      res.status(404).json({ error: 'Survey not found' });
      return;
    }

    // Get the frontend URL from environment
    const frontendUrl = process.env.ADMIN_WEB_URL || 'http://localhost:3003';
    const publicUrl = `${frontendUrl}/public/survey/${token}`;

    res.json({
      message: 'Public access token generated successfully',
      token,
      public_url: publicUrl,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
    });
  } catch (error) {
    console.error('Error generating public access token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Revoke public access for a survey (admin only)
export const revokePublicAccess = async (req: Request, res: Response): Promise<void> => {
  try {
    const surveyId = parseInt(req.params.id);

    if (isNaN(surveyId)) {
      res.status(400).json({ error: 'Invalid survey ID' });
      return;
    }

    const success = await surveyService.revokePublicAccess(surveyId);

    if (!success) {
      res.status(404).json({ error: 'Survey not found' });
      return;
    }

    res.json({ message: 'Public access revoked successfully' });
  } catch (error) {
    console.error('Error revoking public access:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};