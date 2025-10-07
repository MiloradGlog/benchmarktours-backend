import { Router } from 'express';
import { authenticateToken } from '../../middleware/auth.middleware';
import * as noteController from './note.controller';

const router = Router();

// All note routes require authentication
router.use(authenticateToken);

// Activity-specific note routes
router.post('/activities/:activityId/notes', noteController.createNote);
router.get('/activities/:activityId/notes', noteController.getNotesByActivity);

// Tour-specific note routes
router.get('/tours/:tourId/notes', noteController.getNotesByTour);

// Individual note routes
router.get('/notes/my', noteController.getUserNotes);
router.get('/notes/:noteId', noteController.getNoteById);
router.put('/notes/:noteId', noteController.updateNote);
router.delete('/notes/:noteId', noteController.deleteNote);

export default router;