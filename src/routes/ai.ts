import { Router } from 'express';
import { authenticateToken, requireGuideOrHigher } from '../middleware/auth.middleware';
import {
  createChatSession,
  getChatSession,
  chatWithAI,
  getChatHistory,
  approveChanges,
  endChatSession,
  deleteChatSession,
  getUserSessions,
  getAIStatus
} from '../controllers/aiController';

const router = Router();

// The AI scheduling assistant is Guide/Admin only
router.use(authenticateToken, requireGuideOrHigher);

// Chat session management
router.post('/sessions', createChatSession);
router.get('/sessions', getUserSessions);
router.get('/sessions/:sessionId', getChatSession);
router.get('/sessions/:sessionId/messages', getChatHistory);
router.post('/sessions/:sessionId/end', endChatSession);
router.delete('/sessions/:sessionId', deleteChatSession);

// Main chat endpoint
router.post('/chat', chatWithAI);

// Approval workflow
router.post('/approve', approveChanges);

// Status and metrics
router.get('/status', getAIStatus);

export default router;