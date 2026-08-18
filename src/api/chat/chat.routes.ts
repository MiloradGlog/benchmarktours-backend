import { Router } from 'express';
import { authenticateToken } from '../../middleware/auth.middleware';
import {
  requireTourMembership,
  requireTourMembershipByMessageId
} from '../../middleware/tourMembership.middleware';
import * as chatController from './chat.controller';

const router = Router();

// All chat routes require authentication
router.use(authenticateToken);

// Tour chat routes (tour-membership enforced)
router.get('/tours/:tourId/chat', requireTourMembership, chatController.getTourChat);
router.get('/tours/:tourId/chat/messages', requireTourMembership, chatController.getChatMessages);
router.post('/tours/:tourId/chat/messages', requireTourMembership, chatController.sendChatMessage);
router.get('/tours/:tourId/chat/unread', requireTourMembership, chatController.getChatUnreadCount);
router.post('/tours/:tourId/chat/read', requireTourMembership, chatController.markChatRead);

// Moderation routes
router.post('/messages/:messageId/report', requireTourMembershipByMessageId, chatController.reportMessage);
router.post('/users/:userId/block', chatController.blockUser);
router.delete('/users/:userId/block', chatController.unblockUser);

// Push token registration
router.post('/push/register', chatController.registerPushToken);
router.delete('/push/register', chatController.unregisterPushToken);

export default router;
