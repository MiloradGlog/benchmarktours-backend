import express, { Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import questionService from './question.service';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = express.Router();

// Create a new question for an activity
router.post(
  '/activities/:id/questions',
  authenticateToken,
  [
    param('id').isInt().withMessage('Activity ID must be an integer'),
    body('question_text').notEmpty().withMessage('Question text is required')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const activityId = parseInt(req.params.id);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const question = await questionService.createQuestion(
        activityId,
        userId,
        { question_text: req.body.question_text }
      );

      res.status(201).json({ question });
    } catch (error) {
      console.error('Error creating question:', error);
      res.status(500).json({ error: 'Failed to create question' });
    }
  }
);

// Get all questions for an activity
router.get(
  '/activities/:id/questions',
  authenticateToken,
  [
    param('id').isInt().withMessage('Activity ID must be an integer')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const activityId = parseInt(req.params.id);
      const userId = req.query.user_only === 'true' ? req.user?.id : undefined;

      const questions = await questionService.getQuestionsByActivity(activityId, userId);
      res.json({ questions });
    } catch (error) {
      console.error('Error fetching questions:', error);
      res.status(500).json({ error: 'Failed to fetch questions' });
    }
  }
);

// Get unanswered questions for current user
router.get(
  '/activities/:id/questions/unanswered',
  authenticateToken,
  [
    param('id').isInt().withMessage('Activity ID must be an integer')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const activityId = parseInt(req.params.id);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const questions = await questionService.getUnansweredQuestions(activityId, userId);
      res.json({ questions });
    } catch (error) {
      console.error('Error fetching unanswered questions:', error);
      res.status(500).json({ error: 'Failed to fetch unanswered questions' });
    }
  }
);

// Delete a question
router.delete(
  '/activities/:activityId/questions/:questionId',
  authenticateToken,
  [
    param('activityId').isInt().withMessage('Activity ID must be an integer'),
    param('questionId').isInt().withMessage('Question ID must be an integer')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const questionId = parseInt(req.params.questionId);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const deleted = await questionService.deleteQuestion(questionId, userId);

      if (!deleted) {
        return res.status(404).json({ error: 'Question not found or unauthorized' });
      }

      res.json({ message: 'Question deleted successfully' });
    } catch (error) {
      console.error('Error deleting question:', error);
      res.status(500).json({ error: 'Failed to delete question' });
    }
  }
);

export default router;