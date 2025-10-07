import { Router } from 'express';
import { authenticateToken } from '../../middleware/auth.middleware';
import * as discussionController from './discussion.controller';

const router = Router();

// All discussion routes require authentication
router.use(authenticateToken);

// Discussion CRUD routes
router.post('/discussions', discussionController.createDiscussion);
router.get('/tours/:tourId/discussions', discussionController.getDiscussionsByTour);
router.get('/discussions/:discussionId', discussionController.getDiscussionById);
router.put('/discussions/:discussionId', discussionController.updateDiscussion);
router.delete('/discussions/:discussionId', discussionController.deleteDiscussion);

// Message routes
router.post('/discussions/:discussionId/messages', discussionController.createMessage);
router.get('/discussions/:discussionId/messages', discussionController.getMessagesByDiscussion);
router.put('/messages/:messageId', discussionController.updateMessage);
router.delete('/messages/:messageId', discussionController.deleteMessage);

// Activity message routes (simplified for Phase 6)
router.post('/activities/:activityId/messages', discussionController.createActivityMessage);
router.get('/activities/:activityId/messages', discussionController.getActivityMessages);

// Reaction routes
router.post('/messages/:messageId/reactions', discussionController.addReaction);
router.delete('/messages/:messageId/reactions/:reaction', discussionController.removeReaction);

// Read status route
router.post('/discussions/:discussionId/read', discussionController.markAsRead);

export default router;