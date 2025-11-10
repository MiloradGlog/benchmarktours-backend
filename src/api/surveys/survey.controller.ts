import { Request, Response } from 'express';
import * as surveyService from './survey.service';
import * as responseService from './surveyResponse.service';

// Survey CRUD Controllers
export const createSurvey = async (req: Request, res: Response) => {
  try {
    const surveyData = req.body;
    const createdBy = req.user?.id || 'system';
    
    const survey = await surveyService.createSurvey(surveyData, createdBy);
    res.status(201).json(survey);
  } catch (error) {
    console.error('Error creating survey:', error);
    res.status(500).json({ error: 'Failed to create survey' });
  }
};

export const getSurveyById = async (req: Request, res: Response) => {
  try {
    const surveyId = parseInt(req.params.id);
    const survey = await surveyService.getSurveyById(surveyId);
    
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }
    
    res.json(survey);
  } catch (error) {
    console.error('Error fetching survey:', error);
    res.status(500).json({ error: 'Failed to fetch survey' });
  }
};

export const getAllSurveys = async (req: Request, res: Response) => {
  try {
    const { type, status, tour_id, activity_id } = req.query;
    
    const filters: any = {};
    if (type) filters.type = type as string;
    if (status) filters.status = status as string;
    if (tour_id) filters.tour_id = parseInt(tour_id as string);
    if (activity_id) filters.activity_id = parseInt(activity_id as string);
    
    const surveys = await surveyService.getAllSurveys(filters);
    res.json(surveys);
  } catch (error) {
    console.error('Error fetching surveys:', error);
    res.status(500).json({ error: 'Failed to fetch surveys' });
  }
};

export const updateSurvey = async (req: Request, res: Response) => {
  try {
    const surveyId = parseInt(req.params.id);
    const updateData = req.body;
    
    const survey = await surveyService.updateSurvey(surveyId, updateData);
    
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }
    
    res.json(survey);
  } catch (error) {
    console.error('Error updating survey:', error);
    res.status(500).json({ error: 'Failed to update survey' });
  }
};

export const deleteSurvey = async (req: Request, res: Response) => {
  try {
    const surveyId = parseInt(req.params.id);
    const deleted = await surveyService.deleteSurvey(surveyId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Survey not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting survey:', error);
    res.status(500).json({ error: 'Failed to delete survey' });
  }
};

export const duplicateSurvey = async (req: Request, res: Response) => {
  try {
    const surveyId = parseInt(req.params.id);
    const { title } = req.body;
    const createdBy = req.user?.id || 'system';
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required for survey duplication' });
    }
    
    const duplicatedSurvey = await surveyService.duplicateSurvey(surveyId, title, createdBy);
    
    if (!duplicatedSurvey) {
      return res.status(404).json({ error: 'Survey not found' });
    }
    
    res.status(201).json(duplicatedSurvey);
  } catch (error) {
    console.error('Error duplicating survey:', error);
    res.status(500).json({ error: 'Failed to duplicate survey' });
  }
};

// Question Controllers
export const addQuestion = async (req: Request, res: Response) => {
  try {
    const surveyId = parseInt(req.params.id);
    const questionData = req.body;
    
    const question = await surveyService.addQuestionToSurvey(surveyId, questionData);
    res.status(201).json(question);
  } catch (error) {
    console.error('Error adding question:', error);
    res.status(500).json({ error: 'Failed to add question' });
  }
};

export const updateQuestion = async (req: Request, res: Response) => {
  try {
    const questionId = parseInt(req.params.questionId);
    const updateData = req.body;
    
    const question = await surveyService.updateQuestion(questionId, updateData);
    
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    
    res.json(question);
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({ error: 'Failed to update question' });
  }
};

export const deleteQuestion = async (req: Request, res: Response) => {
  try {
    const questionId = parseInt(req.params.questionId);
    const deleted = await surveyService.deleteQuestion(questionId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Question not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
};

// Template Controllers
export const getSurveyTemplates = async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    const templates = await surveyService.getSurveyTemplates(type as any);
    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
};

export const createSurveyFromTemplate = async (req: Request, res: Response) => {
  try {
    const { templateId, title, tourId, activityId } = req.body;
    const createdBy = req.user?.id;
    
    const survey = await surveyService.createSurveyFromTemplate(
      templateId,
      title,
      tourId,
      activityId,
      createdBy
    );
    
    res.status(201).json(survey);
  } catch (error) {
    console.error('Error creating survey from template:', error);
    res.status(500).json({ error: 'Failed to create survey from template' });
  }
};

// Response Controllers
export const submitResponse = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const responseData = req.body;
    const response = await responseService.submitSurveyResponse(userId, responseData);
    res.status(201).json(response);
  } catch (error) {
    console.error('Error submitting response:', error);
    res.status(500).json({ error: 'Failed to submit response' });
  }
};

export const saveProgress = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const surveyId = parseInt(req.params.id);
    const { responses } = req.body;
    
    const response = await responseService.saveSurveyProgress(userId, surveyId, responses);
    res.json(response);
  } catch (error) {
    console.error('Error saving progress:', error);
    res.status(500).json({ error: 'Failed to save progress' });
  }
};

export const getUserResponse = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const surveyId = parseInt(req.params.id);
    const response = await responseService.getUserSurveyResponse(userId, surveyId);
    
    if (!response) {
      return res.status(404).json({ error: 'Response not found' });
    }
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching user response:', error);
    res.status(500).json({ error: 'Failed to fetch response' });
  }
};

export const getSurveyResponses = async (req: Request, res: Response) => {
  try {
    const surveyId = parseInt(req.params.id);
    const includeDetails = req.query.includeDetails === 'true';
    
    const responses = await responseService.getSurveyResponses(surveyId, includeDetails);
    res.json(responses);
  } catch (error) {
    console.error('Error fetching survey responses:', error);
    res.status(500).json({ error: 'Failed to fetch responses' });
  }
};

export const getSurveyStats = async (req: Request, res: Response) => {
  try {
    const surveyId = parseInt(req.params.id);
    const stats = await responseService.getSurveyResponseStats(surveyId);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching survey stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

export const getAvailableSurveys = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { tourId } = req.query;
    const surveys = await responseService.getAvailableSurveysForUser(
      userId,
      tourId ? parseInt(tourId as string) : undefined
    );
    
    res.json(surveys);
  } catch (error) {
    console.error('Error fetching available surveys:', error);
    res.status(500).json({ error: 'Failed to fetch available surveys' });
  }
};

// Tour/Activity specific endpoints
export const getTourSurveys = async (req: Request, res: Response) => {
  try {
    const tourId = parseInt(req.params.tourId);
    const userId = req.user?.id;
    const surveys = await surveyService.getSurveysForTour(tourId);

    // Add user completion status for each survey
    const surveysWithStatus = await Promise.all(
      surveys.map(async (survey) => {
        if (userId) {
          const userResponse = await responseService.getUserResponse(survey.id, userId);
          return {
            ...survey,
            user_has_completed: userResponse?.is_complete || false,
          };
        }
        return survey;
      })
    );

    res.json(surveysWithStatus);
  } catch (error) {
    console.error('Error fetching tour surveys:', error);
    res.status(500).json({ error: 'Failed to fetch tour surveys' });
  }
};

export const getActivitySurveys = async (req: Request, res: Response) => {
  try {
    const activityId = parseInt(req.params.activityId);
    const userId = req.user?.id;
    const surveys = await surveyService.getSurveysForActivity(activityId);

    // Add user completion status for each survey
    const surveysWithStatus = await Promise.all(
      surveys.map(async (survey) => {
        if (userId) {
          const userResponse = await responseService.getUserResponse(survey.id, userId);
          return {
            ...survey,
            user_has_completed: userResponse?.is_complete || false,
          };
        }
        return survey;
      })
    );

    res.json(surveysWithStatus);
  } catch (error) {
    console.error('Error fetching activity surveys:', error);
    res.status(500).json({ error: 'Failed to fetch activity surveys' });
  }
};

export const getAggregatedResponses = async (req: Request, res: Response) => {
  try {
    const surveyId = parseInt(req.params.id);
    const aggregated = await responseService.getAggregatedSurveyResponses(surveyId);
    res.json(aggregated);
  } catch (error) {
    console.error('Error fetching aggregated responses:', error);
    res.status(500).json({ error: 'Failed to fetch aggregated responses' });
  }
};