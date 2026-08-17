import { Request, Response } from 'express';
import * as chatService from './chat.service';
import { sendChatPush } from '../../services/PushService';

const MAX_CONTENT_LENGTH = 4000;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /tours/:tourId/chat — get-or-create the tour chat
export const getTourChat = async (req: Request, res: Response): Promise<Response> => {
  try {
    const tourId = parseInt(req.params.tourId);
    const userId = req.user!.id;

    const { discussion, unread_count } = await chatService.getOrCreateTourChat(tourId, userId);

    return res.json({
      success: true,
      discussion,
      unread_count
    });
  } catch (error) {
    console.error('Error fetching tour chat:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch tour chat';
    if (errorMessage === 'Tour not found') {
      return res.status(404).json({ error: errorMessage });
    }
    return res.status(500).json({ error: 'Failed to fetch tour chat' });
  }
};

// GET /tours/:tourId/chat/messages?after=<id>|before=<id>&limit=50
export const getChatMessages = async (req: Request, res: Response): Promise<Response> => {
  try {
    const tourId = parseInt(req.params.tourId);
    const userId = req.user!.id;

    const after = req.query.after !== undefined ? parseInt(req.query.after as string) : undefined;
    const before = req.query.before !== undefined ? parseInt(req.query.before as string) : undefined;
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit as string) : undefined;

    if ((after !== undefined && isNaN(after)) ||
        (before !== undefined && isNaN(before)) ||
        (limit !== undefined && isNaN(limit))) {
      return res.status(400).json({ error: 'after, before and limit must be numbers' });
    }

    const { discussion } = await chatService.getOrCreateTourChat(tourId, userId);
    const messages = await chatService.getChatMessages(discussion.id, userId, { after, before, limit });

    return res.json({
      success: true,
      messages
    });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch chat messages';
    if (errorMessage === 'Tour not found') {
      return res.status(404).json({ error: errorMessage });
    }
    return res.status(500).json({ error: 'Failed to fetch chat messages' });
  }
};

// POST /tours/:tourId/chat/messages — body { content }
export const sendChatMessage = async (req: Request, res: Response): Promise<Response> => {
  try {
    const tourId = parseInt(req.params.tourId);
    const userId = req.user!.id;
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';

    if (content.length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({ error: `Message content must be at most ${MAX_CONTENT_LENGTH} characters` });
    }

    if (!chatService.checkSendRateLimit(userId)) {
      return res.status(429).json({ error: 'Too many messages. Please wait a moment.' });
    }

    const { discussion } = await chatService.getOrCreateTourChat(tourId, userId);
    const { message, tourName } = await chatService.createChatMessage(tourId, discussion.id, userId, content);

    // Fire-and-forget push to the other participants (never blocks the response)
    sendChatPush(
      tourId,
      userId,
      message.user_first_name || '',
      tourName,
      content,
      discussion.id
    ).catch((error: any) => {
      console.error(`[push] Chat push failed (message ${message.id}):`, error?.message || error);
    });

    return res.status(201).json({
      success: true,
      message
    });
  } catch (error) {
    console.error('Error sending chat message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
    if (errorMessage === 'Tour not found') {
      return res.status(404).json({ error: errorMessage });
    }
    if (errorMessage === 'Discussion is locked' || errorMessage.includes('tour has ended and is now read-only')) {
      return res.status(403).json({ error: errorMessage });
    }
    return res.status(500).json({ error: 'Failed to send message' });
  }
};

// POST /tours/:tourId/chat/read — read watermark
export const markChatRead = async (req: Request, res: Response): Promise<Response> => {
  try {
    const tourId = parseInt(req.params.tourId);
    const userId = req.user!.id;

    const found = await chatService.markTourChatRead(tourId, userId);
    if (!found) {
      return res.status(404).json({ error: 'Tour chat not found' });
    }

    return res.json({
      success: true,
      message: 'Chat marked as read'
    });
  } catch (error) {
    console.error('Error marking chat as read:', error);
    return res.status(500).json({ error: 'Failed to mark chat as read' });
  }
};

// POST /messages/:messageId/report
export const reportMessage = async (req: Request, res: Response): Promise<Response> => {
  try {
    const messageId = parseInt(req.params.messageId);
    const userId = req.user!.id;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : undefined;

    const found = await chatService.reportMessage(messageId, userId, reason);
    if (!found) {
      return res.status(404).json({ error: 'Message not found' });
    }

    return res.status(201).json({
      success: true,
      message: 'Message reported'
    });
  } catch (error) {
    console.error('Error reporting message:', error);
    return res.status(500).json({ error: 'Failed to report message' });
  }
};

// POST /users/:userId/block
export const blockUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const blockedId = req.params.userId;
    const blockerId = req.user!.id;

    if (!UUID_REGEX.test(blockedId)) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (blockedId === blockerId) {
      return res.status(400).json({ error: 'You cannot block yourself' });
    }

    const found = await chatService.blockUser(blockerId, blockedId);
    if (!found) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(201).json({
      success: true,
      message: 'User blocked'
    });
  } catch (error) {
    console.error('Error blocking user:', error);
    return res.status(500).json({ error: 'Failed to block user' });
  }
};

// DELETE /users/:userId/block
export const unblockUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const blockedId = req.params.userId;
    const blockerId = req.user!.id;

    if (!UUID_REGEX.test(blockedId)) {
      return res.status(404).json({ error: 'User not found' });
    }

    const found = await chatService.unblockUser(blockerId, blockedId);
    if (!found) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      success: true,
      message: 'User unblocked'
    });
  } catch (error) {
    console.error('Error unblocking user:', error);
    return res.status(500).json({ error: 'Failed to unblock user' });
  }
};

// POST /push/register — body { token, platform }
export const registerPushToken = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user!.id;
    const { token, platform } = req.body || {};

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Push token is required' });
    }

    await chatService.registerPushToken(userId, token, typeof platform === 'string' ? platform : undefined);

    return res.json({
      success: true,
      message: 'Push token registered'
    });
  } catch (error) {
    console.error('Error registering push token:', error);
    return res.status(500).json({ error: 'Failed to register push token' });
  }
};

// DELETE /push/register — body { token }. Removes this device's token so
// notifications stop server-side when a user revokes permission or signs out.
export const unregisterPushToken = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user!.id;
    const { token } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Push token is required' });
    }
    await chatService.unregisterPushToken(userId, token);
    return res.json({ success: true, message: 'Push token removed' });
  } catch (error) {
    console.error('Error unregistering push token:', error);
    return res.status(500).json({ error: 'Failed to unregister push token' });
  }
};
