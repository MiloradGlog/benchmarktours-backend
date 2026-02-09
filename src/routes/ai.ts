import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';
import {
  createChatSession,
  getChatSession,
  chatWithAI,
  getChatHistory,
  approveChanges,
  endChatSession,
  getUserSessions,
  getAIStatus
} from '../controllers/aiController';

const router = Router();

// Apply authentication to all routes, but check admin per-route for debugging
router.use(authenticateToken);

// Chat session management - temporarily removed requireAdmin for debugging
router.post('/sessions', createChatSession);
router.get('/sessions', getUserSessions);
router.get('/sessions/:sessionId', getChatSession);
router.get('/sessions/:sessionId/messages', getChatHistory);
router.post('/sessions/:sessionId/end', endChatSession);

// Main chat endpoint
router.post('/chat', chatWithAI);

// Approval workflow
router.post('/approve', approveChanges);

// Status and metrics
router.get('/status', getAIStatus);

// Debug endpoint to check authentication
router.get('/debug-auth', (req, res) => {
  res.json({
    authenticated: true,
    user: req.user,
    headers: {
      authorization: req.headers.authorization ? 'Present' : 'Missing'
    }
  });
});

export default router;