import { Request, Response } from 'express';
import { Pool } from 'pg';
import { AIService } from '../services/AIService';
import {
  ChatRequest,
  ChatResponse,
  ApprovalRequest,
  ApprovalResponse,
  ChatContext
} from '../types/ai';

let aiService: AIService | null = null;
let dbPool: Pool | null = null;

// Initialize the AI service with the database pool
export function initializeAIController(pool: Pool) {
  aiService = new AIService(pool);
  dbPool = pool;
}

// Helper to ensure AI service is initialized
function ensureAIService(): AIService {
  if (!aiService) {
    throw new Error('AI Service not initialized');
  }
  return aiService;
}

/**
 * Start a new chat session
 * POST /api/ai/sessions
 */
export async function createChatSession(req: Request, res: Response) {
  try {
    const aiService = ensureAIService();
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { tourId } = req.body;
    console.log('🆕 Creating chat session:', {
      userId,
      tourId,
      tourIdType: typeof tourId
    });

    // SECURITY: Verify user is assigned to this tour (if tourId provided)
    if (tourId) {
      if (!dbPool) {
        return res.status(500).json({ error: 'Database pool not initialized' });
      }

      const participantCheck = await dbPool.query(
        'SELECT 1 FROM tour_participants WHERE tour_id = $1 AND user_id = $2',
        [tourId, userId]
      );

      if (participantCheck.rows.length === 0) {
        return res.status(403).json({
          error: 'Access denied - not assigned to this tour'
        });
      }
    }

    const session = await aiService.createSession(userId, tourId);
    console.log('✅ Session created:', {
      sessionId: session.id,
      storedTourId: session.tourId
    });

    res.json({
      success: true,
      sessionId: session.id,
      message: 'Chat session created successfully'
    });
  } catch (error) {
    console.error('Error creating chat session:', error);
    res.status(500).json({
      error: 'Failed to create chat session'
    });
  }
}

/**
 * Get chat session details
 * GET /api/ai/sessions/:sessionId
 */
export async function getChatSession(req: Request, res: Response) {
  try {
    const aiService = ensureAIService();
    const { sessionId } = req.params;
    const userId = (req as any).user?.id;

    const session = await aiService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Verify the user owns this session
    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Error getting chat session:', error);
    res.status(500).json({
      error: 'Failed to get chat session'
    });
  }
}

/**
 * Send a message to the AI chat
 * POST /api/ai/chat
 */
export async function chatWithAI(req: Request, res: Response) {
  try {
    const aiService = ensureAIService();
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Only guides and admins can use the AI chat
    if (userRole !== 'Admin' && userRole !== 'Guide') {
      return res.status(403).json({
        error: 'AI chat is only available to guides'
      });
    }

    const { message, sessionId, tourId } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({
        error: 'Message and sessionId are required'
      });
    }

    // Verify session ownership
    const session = await aiService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Build context with current UTC time (will be converted to JST in AIService)
    const context: ChatContext = {
      currentDate: new Date().toISOString(), // Send UTC time, let AIService handle JST conversion
      userRole,
      timezone: 'Asia/Tokyo'
    };

    if (tourId || session.tourId) {
      const effectiveTourId = tourId || session.tourId;

      if (!dbPool) {
        return res.status(500).json({
          error: 'Database pool not initialized'
        });
      }

      // Fetch actual tour data from the database
      const tourQuery = `
        SELECT id, name, start_date, end_date, status
        FROM tours
        WHERE id = $1
      `;
      const tourResult = await dbPool.query(tourQuery, [effectiveTourId]);

      if (tourResult.rows.length > 0) {
        const tour = tourResult.rows[0];
        context.tourInfo = {
          id: tour.id,
          name: tour.name,
          startDate: tour.start_date.toISOString(),
          endDate: tour.end_date.toISOString(),
          status: tour.status
        };
        console.log('✅ Tour context set:', context.tourInfo);
      } else {
        console.warn(`⚠️ Tour ${effectiveTourId} not found in database`);
      }
    } else {
      console.log('⚠️ No tour ID provided in request or session');
    }

    const chatRequest: ChatRequest = {
      message,
      sessionId,
      tourId,
      context
    };

    const response: ChatResponse = await aiService.chat(chatRequest);

    res.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      type: 'error',
      error: error instanceof Error ? error.message : 'An error occurred during chat'
    });
  }
}

/**
 * Get conversation history for a session
 * GET /api/ai/sessions/:sessionId/messages
 */
export async function getChatHistory(req: Request, res: Response) {
  try {
    const aiService = ensureAIService();
    const { sessionId } = req.params;
    const userId = (req as any).user?.id;

    // Verify session ownership
    const session = await aiService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await aiService.getConversationHistory(sessionId);

    res.json({
      success: true,
      sessionId,
      messages
    });
  } catch (error) {
    console.error('Error getting chat history:', error);
    res.status(500).json({
      error: 'Failed to get chat history'
    });
  }
}

/**
 * Approve or reject proposed changes
 * POST /api/ai/approve
 */
export async function approveChanges(req: Request, res: Response) {
  try {
    const aiService = ensureAIService();
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Only guides and admins can approve changes
    if (userRole !== 'Admin' && userRole !== 'Guide') {
      return res.status(403).json({
        error: 'Only guides can approve changes'
      });
    }

    const { confirmationToken, approved, rejectionReason } = req.body;

    if (!confirmationToken || approved === undefined) {
      return res.status(400).json({
        error: 'confirmationToken and approved are required'
      });
    }

    const approvalRequest: ApprovalRequest = {
      confirmationToken,
      approved,
      rejectionReason
    };

    const response: ApprovalResponse = await aiService.approveChanges(
      approvalRequest,
      userId
    );

    res.json(response);
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process approval'
    });
  }
}

/**
 * End a chat session
 * POST /api/ai/sessions/:sessionId/end
 */
export async function endChatSession(req: Request, res: Response) {
  try {
    const aiService = ensureAIService();
    const { sessionId } = req.params;
    const userId = (req as any).user?.id;

    // Verify session ownership
    const session = await aiService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await aiService.endSession(sessionId);

    res.json({
      success: true,
      message: 'Session ended successfully'
    });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({
      error: 'Failed to end session'
    });
  }
}

/**
 * Get user's chat sessions
 * GET /api/ai/sessions
 */
export async function getUserSessions(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!dbPool) {
      return res.status(500).json({
        error: 'Database pool not initialized'
      });
    }

    const query = `
      SELECT
        s.*,
        t.name as tour_name
      FROM ai_chat_sessions s
      LEFT JOIN tours t ON s.tour_id = t.id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC
      LIMIT 20
    `;

    const result = await dbPool.query(query, [userId]);

    res.json({
      success: true,
      sessions: result.rows
    });
  } catch (error) {
    console.error('Error getting user sessions:', error);
    res.status(500).json({
      error: 'Failed to get user sessions'
    });
  }
}

/**
 * Get AI service status and metrics
 * GET /api/ai/status
 */
export async function getAIStatus(req: Request, res: Response) {
  try {
    const userRole = (req as any).user?.role;

    // Only guides and admins can view AI status
    if (userRole !== 'Admin' && userRole !== 'Guide') {
      return res.status(403).json({
        error: 'Only guides can view AI status'
      });
    }

    if (!dbPool) {
      return res.status(500).json({
        error: 'Database pool not initialized'
      });
    }

    // Get some basic metrics
    const metricsQuery = `
      SELECT
        COUNT(DISTINCT s.id) as total_sessions,
        COUNT(DISTINCT s.user_id) as unique_users,
        COUNT(m.id) as total_messages,
        SUM(s.tokens_used) as total_tokens,
        SUM(s.total_cost) as total_cost,
        COUNT(CASE WHEN p.status = 'approved' THEN 1 END) as approved_changes,
        COUNT(CASE WHEN p.status = 'rejected' THEN 1 END) as rejected_changes,
        COUNT(CASE WHEN p.status = 'pending' THEN 1 END) as pending_changes
      FROM ai_chat_sessions s
      LEFT JOIN ai_conversation_messages m ON s.id = m.session_id
      LEFT JOIN ai_proposed_changes p ON s.id = p.session_id
      WHERE s.created_at >= NOW() - INTERVAL '30 days'
    `;

    const result = await dbPool.query(metricsQuery);
    const metrics = result.rows[0];

    res.json({
      success: true,
      status: 'operational',
      serviceInitialized: !!aiService,
      provider: process.env.AI_PROVIDER || 'openai',
      langSmithEnabled: process.env.LANGSMITH_ENABLED !== 'false',
      model: process.env.AI_MODEL || (process.env.AI_PROVIDER === 'gemini' ? 'gemini-pro' : 'gpt-4-turbo-preview'),
      metrics: {
        last30Days: {
          totalSessions: parseInt(metrics.total_sessions) || 0,
          uniqueUsers: parseInt(metrics.unique_users) || 0,
          totalMessages: parseInt(metrics.total_messages) || 0,
          totalTokens: parseInt(metrics.total_tokens) || 0,
          totalCost: parseFloat(metrics.total_cost) || 0,
          approvedChanges: parseInt(metrics.approved_changes) || 0,
          rejectedChanges: parseInt(metrics.rejected_changes) || 0,
          pendingChanges: parseInt(metrics.pending_changes) || 0
        }
      }
    });
  } catch (error) {
    console.error('Error getting AI status:', error);
    res.status(500).json({
      error: 'Failed to get AI status'
    });
  }
}