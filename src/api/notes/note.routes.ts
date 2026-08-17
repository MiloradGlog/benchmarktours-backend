import { Router } from 'express';
import { authenticateToken } from '../../middleware/auth.middleware';
import {
  requireTourMembership,
  requireTourMembershipByActivityId,
  requireTourMembershipByNoteId,
} from '../../middleware/tourMembership.middleware';
import * as noteController from './note.controller';

const router = Router();

// All note routes require authentication
router.use(authenticateToken);

// Activity-specific note routes (must be on the activity's tour)
router.post('/activities/:activityId/notes', requireTourMembershipByActivityId, noteController.createNote);
router.get('/activities/:activityId/notes', requireTourMembershipByActivityId, noteController.getNotesByActivity);

// Tour-specific note routes
router.get('/tours/:tourId/notes', requireTourMembership, noteController.getNotesByTour);

// Individual note routes ('/notes/my' returns only the caller's own notes)
router.get('/notes/my', noteController.getUserNotes);
router.get('/notes/:noteId', requireTourMembershipByNoteId, noteController.getNoteById);
router.put('/notes/:noteId', noteController.updateNote); // ownership enforced in SQL
router.delete('/notes/:noteId', noteController.deleteNote); // own-content erasure must never be blocked

export default router;