import { Router } from 'express';
import { authenticateToken } from '../../middleware/auth.middleware';
import {
  requireTourMembership,
  requireTourMembershipByBody,
  requireTourMembershipByDiscussionId,
  requireTourMembershipByMessageId,
  requireTourMembershipByActivityId
} from '../../middleware/tourMembership.middleware';
import * as discussionController from './discussion.controller';

const router = Router();

// All discussion routes require authentication + tour membership
router.use(authenticateToken);

// Discussion CRUD routes
router.post('/discussions', requireTourMembershipByBody, discussionController.createDiscussion);
router.get('/tours/:tourId/discussions', requireTourMembership, discussionController.getDiscussionsByTour);
router.get('/discussions/:discussionId', requireTourMembershipByDiscussionId, discussionController.getDiscussionById);
router.put('/discussions/:discussionId', requireTourMembershipByDiscussionId, discussionController.updateDiscussion);
router.delete('/discussions/:discussionId', requireTourMembershipByDiscussionId, discussionController.deleteDiscussion);

// Message routes
router.post('/discussions/:discussionId/messages', requireTourMembershipByDiscussionId, discussionController.createMessage);
router.get('/discussions/:discussionId/messages', requireTourMembershipByDiscussionId, discussionController.getMessagesByDiscussion);
router.put('/messages/:messageId', requireTourMembershipByMessageId, discussionController.updateMessage);
router.delete('/messages/:messageId', requireTourMembershipByMessageId, discussionController.deleteMessage);

// Activity message routes (simplified for Phase 6)
router.post('/activities/:activityId/messages', requireTourMembershipByActivityId, discussionController.createActivityMessage);
router.get('/activities/:activityId/messages', requireTourMembershipByActivityId, discussionController.getActivityMessages);

// Reaction routes
router.post('/messages/:messageId/reactions', requireTourMembershipByMessageId, discussionController.addReaction);
router.delete('/messages/:messageId/reactions/:reaction', requireTourMembershipByMessageId, discussionController.removeReaction);

// Read status route
router.post('/discussions/:discussionId/read', requireTourMembershipByDiscussionId, discussionController.markAsRead);

export default router;
