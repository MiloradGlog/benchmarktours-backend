import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import {
  AIChatSession,
  AIConversationMessage,
  AIProposedChange,
  ChatRequest,
  ChatResponse,
  ChatContext,
  ApprovalRequest,
  ApprovalResponse,
  ProposedChangeDetail
} from '../types/ai';
import {
  scheduleAdjustmentTool,
  viewScheduleTool,
  getTourInfoTool,
  checkConflictsTool
} from '../tools/scheduleTools';
import { LangSmithService } from './LangSmithService';

type AIProvider = 'openai' | 'gemini';

export class AIService {
  private model: BaseChatModel;
  private pool: Pool;
  private langSmithService: LangSmithService;
  private tools: any[] = [];
  private systemPrompt: string;
  private provider: AIProvider;

  constructor(pool: Pool) {
    this.pool = pool;
    this.langSmithService = new LangSmithService();

    // Determine which provider to use based on environment variables
    this.provider = (process.env.AI_PROVIDER as AIProvider) || 'openai';

    // Initialize the appropriate model based on provider
    this.model = this.initializeModel();

    // System prompt for the schedule management assistant
    this.systemPrompt = `You are a professional tour schedule management assistant specializing in DYNAMIC, REAL-TIME tour operations in Japan.

OPERATIONAL CONTEXT:
- You assist guides and administrators who are ACTIVELY MANAGING live tours in Japan (JST timezone)
- Tours are highly dynamic - delays from traffic, weather, and spontaneous changes are NORMAL
- Your goal is to make schedule adjustments FAST and INTELLIGENT with minimal friction
- Speed and autonomy are critical - users need answers in seconds, not minutes
- **CRITICAL**: The tour context is automatically provided to all tools - you cannot and should not specify tour IDs
- All tools (view_schedule, check_conflicts, get_tour_info) automatically use the correct tour from the session
- NEVER mention tour IDs in your responses - users don't need to know about internal IDs

TOUR & ACTIVITY REFERENCES (IMPORTANT):
- NEVER mention tour IDs or status in your responses
- When referring to tours, only mention: tour name, start date, and end date
- NEVER mention activity IDs in your responses
- When referring to activities, only mention: activity name, time, and type
- Example: "Tour Name (Jan 27 - Feb 7)" NOT "Tour Name (ID: 1, Status: Active)"

TIMEZONE (CRITICAL):
- ALL times are Japanese Standard Time (JST, UTC+9) - NEVER convert or mention other timezones
- When users say "now", "today", "tomorrow", they ALWAYS mean JST
- All calculations, displays, and storage use JST
- Current time from context is already in JST

ROLE-BASED AUTHORITY:
You have TWO operational modes based on user role:

1. **GUIDE MODE** (User role = "Guide", actively managing a tour):
   - Apply schedule adjustments IMMEDIATELY without approval
   - Guides are on-site with real-time knowledge - trust their judgment
   - Use executeImmediately=true when calling adjust_activity_times
   - Be fast and decisive - minimize questions and back-and-forth
   - Confirm actions taken, not intentions

2. **ADMIN MODE** (User role = "Admin", planning or reviewing):
   - Propose changes and request approval via confirmation token
   - Use executeImmediately=false (default) when calling adjust_activity_times
   - Provide detailed explanations and implications
   - Standard approval workflow applies

INTELLIGENT SCHEDULE ADJUSTMENT WORKFLOW:

When a user says "we're running [X] late" or "delay by [X]" or similar:

STEP 1 - UNDERSTAND CONTEXT AUTOMATICALLY:
- The user's tour ID and current schedule are in the context
- Identify which activities are UPCOMING (start_time >= current time in JST)
- If user mentions a specific activity ("after lunch", "from Sony visit"), find it by name

STEP 2 - GATHER DATA (use your tools proactively):
- If needed, use get_tour_info to understand tour details
- Use view_schedule to see all activities for the tour
- Filter activities based on user's intent (all upcoming, or from a specific point)

STEP 3 - CALCULATE & VALIDATE:
- Extract time offset from natural language (e.g., "1 hour late" = +60 minutes)
- Calculate new start_time and end_time for each affected activity
- Call adjust_activity_times with discovered activity IDs and offset
- Check for conflicts, impossible times, external coordination needs

STEP 4 - PRESENT CLEARLY (format matters for busy users):
- Show affected activities in a scannable list format
- Display: Activity name | OLD time → NEW time
- Highlight warnings (overlaps, too early/late, company visits that need rescheduling)
- Show participant count who will be notified
- Be CONCISE - guides don't have time for long explanations

STEP 5 - EXECUTE BASED ON ROLE:
- **GUIDE MODE**: Apply immediately, confirm completion, state next steps
- **ADMIN MODE**: Provide approval token, explain approval process

NATURAL LANGUAGE UNDERSTANDING (critical for UX):

Users will NOT provide activity IDs. Interpret their intent:
- "we're 1 hour late" → offset: +60min, affect: all upcoming activities from now
- "delay everything after lunch" → find activity with "lunch" in name/type, adjust all after it
- "push back the afternoon by 30 minutes" → find activities starting after 12:00 PM, offset: +30min
- "move the Sony visit to 3 PM" → find "Sony" activity, calculate offset needed to start at 15:00
- "we're running 45 minutes behind" → offset: +45min, affect: all upcoming activities

Be INTELLIGENT about interpreting intent. Make reasonable assumptions based on context. Act decisively.

COMMUNICATION STYLE:
- Be concise and action-oriented - guides are busy managing real people
- Use bullet points and clear formatting
- Avoid over-explaining - state facts and actions
- Use language like "Adjusted 5 activities" not "I will adjust" or "I can adjust"
- Don't ask multiple clarifying questions - make one reasonable interpretation and execute
- If truly ambiguous, ask ONE specific question maximum
- NEVER mention IDs or status fields - only use names and dates

EXAMPLE INTERACTIONS:

Guide: "we are 1 hour late"
You: Use view_schedule → filter upcoming activities → adjust_activity_times(ids, +60, executeImmediately=true)
Response: "✓ Adjusted 5 upcoming activities by +1 hour:
• Lunch: 12:00 → 13:00
• Sony Visit: 14:00 → 15:00
• Discussion: 16:00 → 17:00
• Dinner: 18:30 → 19:30
• Hotel Check-in: 20:00 → 21:00
All 12 participants notified."

Admin: "I need to delay tomorrow's morning session by 30 minutes"
You: Use view_schedule(date=tomorrow) → filter morning → adjust_activity_times(ids, +30, executeImmediately=false)
Response: "I've prepared schedule adjustments for tomorrow morning (4 activities affected). Please review and approve:
• Breakfast: 07:00 → 07:30
• Toyota Visit: 09:00 → 09:30
• Factory Tour: 10:00 → 10:30
• Debrief: 11:30 → 12:00
[Approval token: abc123...]"

TOOLS YOU HAVE ACCESS TO:
- view_schedule: View tour activities, optionally filtered by date
- get_tour_info: Get tour details (name, dates, participant count, status)
- adjust_activity_times: Adjust activity times with offset (supports immediate execution)
- check_conflicts: Find overlapping activities in a tour

USE YOUR TOOLS PROACTIVELY. Don't wait to be told - if you need information to make a decision, fetch it immediately.`;

    // Initialize tools
    this.initializeTools();
  }

  private initializeModel(): BaseChatModel {
    // Note: We rely on built-in LangChain tracing (LANGCHAIN_TRACING_V2=true)
    // instead of custom callbacks to avoid duplicate traces

    switch (this.provider) {
      case 'gemini':
        console.log('🤖 Initializing Google Gemini model');

        // Check for API key
        if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
          throw new Error('GEMINI_API_KEY or GOOGLE_API_KEY is required for Gemini provider');
        }

        const geminiModel = process.env.AI_MODEL || 'gemini-2.0-flash-exp';
        console.log(`📌 Using Gemini model: ${geminiModel}`);

        return new ChatGoogleGenerativeAI({
          model: geminiModel,
          temperature: parseFloat(process.env.AI_TEMPERATURE || '0.1'),
          maxOutputTokens: parseInt(process.env.AI_MAX_TOKENS || '2000'),
          apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
        });

      case 'openai':
      default:
        console.log('🤖 Initializing OpenAI model');

        // Check for API key
        if (!process.env.OPENAI_API_KEY) {
          console.warn('OPENAI_API_KEY not found, AI features will be limited');
        }

        return new ChatOpenAI({
          modelName: process.env.AI_MODEL || 'gpt-4-turbo-preview',
          temperature: parseFloat(process.env.AI_TEMPERATURE || '0.1'),
          maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2000'),
          openAIApiKey: process.env.OPENAI_API_KEY
        });
    }
  }

  private async initializeTools() {
    // Tools are now created per-session to prevent tour ID manipulation
    // This method is kept for backward compatibility but tools are empty by default
    this.tools = [];
  }

  /**
   * Creates session-specific tools with the tour ID baked in
   * This prevents the AI from being able to access other tours
   */
  private createSessionTools(tourId: number) {
    const adjustScheduleTool = scheduleAdjustmentTool(this.pool, tourId);
    const viewTool = viewScheduleTool(this.pool, tourId);
    const tourInfoTool = getTourInfoTool(this.pool, tourId);
    const conflictsTool = checkConflictsTool(this.pool, tourId);

    return [
      adjustScheduleTool,
      viewTool,
      tourInfoTool,
      conflictsTool
    ];
  }

  /**
   * Maps database row (snake_case) to TypeScript interface (camelCase)
   */
  private mapSessionRow(row: any): AIChatSession {
    return {
      id: row.id,
      userId: row.user_id,
      tourId: row.tour_id,
      title: row.title,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      messageCount: row.message_count,
      tokensUsed: row.tokens_used,
      totalCost: parseFloat(row.total_cost) || 0,
      status: row.status,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async createSession(userId: string, tourId?: number): Promise<AIChatSession> {
    const sessionId = uuidv4();
    const query = `
      INSERT INTO ai_chat_sessions (id, user_id, tour_id, status)
      VALUES ($1, $2, $3, 'active')
      RETURNING *
    `;

    const result = await this.pool.query(query, [sessionId, userId, tourId]);
    return this.mapSessionRow(result.rows[0]);
  }

  async getSession(sessionId: string): Promise<AIChatSession | null> {
    const query = 'SELECT * FROM ai_chat_sessions WHERE id = $1';
    const result = await this.pool.query(query, [sessionId]);
    return result.rows[0] ? this.mapSessionRow(result.rows[0]) : null;
  }

  async saveMessage(
    sessionId: string,
    role: string,
    content: string,
    functionName?: string,
    functionArgs?: any,
    functionResult?: any
  ): Promise<AIConversationMessage> {
    const messageId = uuidv4();
    const query = `
      INSERT INTO ai_conversation_messages
      (id, session_id, role, content, function_name, function_args, function_result)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      messageId,
      sessionId,
      role,
      content,
      functionName,
      functionArgs ? JSON.stringify(functionArgs) : null,
      functionResult ? JSON.stringify(functionResult) : null
    ]);

    // Update session message count
    await this.pool.query(
      'UPDATE ai_chat_sessions SET message_count = message_count + 1 WHERE id = $1',
      [sessionId]
    );

    return result.rows[0];
  }

  async getConversationHistory(sessionId: string): Promise<AIConversationMessage[]> {
    const query = `
      SELECT * FROM ai_conversation_messages
      WHERE session_id = $1
      ORDER BY created_at ASC
    `;
    const result = await this.pool.query(query, [sessionId]);
    return result.rows;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      // Get or create session
      let session: AIChatSession;
      if (request.sessionId) {
        const existingSession = await this.getSession(request.sessionId);
        if (!existingSession) {
          throw new Error('Session not found');
        }
        session = existingSession;
      } else {
        // This should be created by the controller with proper user context
        throw new Error('Session ID is required');
      }

      // Save user message
      await this.saveMessage(session.id, 'user', request.message);

      // Get conversation history
      const history = await this.getConversationHistory(session.id);
      // Filter out function/system messages from history to avoid Gemini's "System message should be the first one" error
      // Only user and assistant messages should be in the conversation history
      const chatHistory = history
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => {
          if (msg.role === 'user') return new HumanMessage(msg.content);
          return new AIMessage(msg.content); // Must be assistant if we got here
        });

      // Enhance the message with context
      const enhancedInput = await this.buildEnhancedInput(request);

      // Create session-specific tools with the tour ID baked in
      // This prevents AI from accessing other tours
      const sessionTools = session.tourId ? this.createSessionTools(session.tourId) : [];

      // For now, we'll use direct model invocation with tool binding
      // This is a simpler approach that works with both providers
      const messages = [
        new SystemMessage(this.systemPrompt),
        ...chatHistory,
        new HumanMessage(enhancedInput)
      ];

      // Bind tools to the model if the provider supports it
      let modelWithTools = this.model;

      // Check if the model supports function calling
      const supportsFunctionCalling = this.provider === 'openai' ||
        (this.provider === 'gemini' && (
          process.env.AI_MODEL?.includes('gemini-1.5') ||
          process.env.AI_MODEL?.includes('gemini-2') ||
          process.env.AI_MODEL?.includes('flash') ||
          process.env.AI_MODEL?.includes('pro')
        ));

      if (supportsFunctionCalling && sessionTools.length > 0) {
        // Bind tools to the model - check if bind method exists
        if (typeof this.model.bind === 'function') {
          modelWithTools = this.model.bind({
            tools: sessionTools
          });
        } else if (typeof (this.model as any).bindTools === 'function') {
          // Some models use bindTools instead of bind
          modelWithTools = (this.model as any).bindTools(sessionTools);
        } else {
          console.warn('Model does not support tool binding, proceeding without tools');
        }
      }

      // Agent loop - keep invoking tools until we get a text response
      let currentMessages = messages;
      let currentResponse = await modelWithTools.invoke(currentMessages);
      let iterations = 0;
      const maxIterations = 5; // Prevent infinite loops

      let proposedChanges = null;
      let confirmationToken = null;
      let finalResponse = '';

      while ('tool_calls' in currentResponse && currentResponse.tool_calls && currentResponse.tool_calls.length > 0 && iterations < maxIterations) {
        iterations++;
        console.log(`🔄 Agent iteration ${iterations}: Processing ${currentResponse.tool_calls.length} tool call(s)`);

        const response = currentResponse; // Rename for clarity in the loop
        console.log('  🔧 Tool calls:', response.tool_calls.map(tc => tc.name));

        for (const toolCall of response.tool_calls) {
          const tool = sessionTools.find(t => t.name === toolCall.name);
          if (tool) {
            try {
              console.log(`🛠️  Executing tool: ${toolCall.name}`);
              const toolResult = await tool.invoke(toolCall.args);
              console.log(`✅ Tool result:`, {
                hasAppliedChanges: !!toolResult?.appliedChanges,
                requiresApproval: !!toolResult?.requiresApproval,
                hasMessage: !!toolResult?.message,
                resultKeys: Object.keys(toolResult || {})
              });

              // Check if changes were applied immediately (guide mode)
              if (toolResult && toolResult.appliedChanges) {
                // Changes were applied - no approval needed
                finalResponse = toolResult.message || `Successfully applied schedule changes for ${toolResult.appliedChanges.length} ${toolResult.appliedChanges.length === 1 ? 'activity' : 'activities'}.`;
              }
              // Check if approval is required (admin mode)
              else if (toolResult && toolResult.requiresApproval) {
                confirmationToken = this.generateConfirmationToken();
                await this.createProposedChanges(
                  session.id,
                  confirmationToken,
                  toolResult.proposedChanges
                );
                proposedChanges = toolResult.proposedChanges;
                finalResponse = toolResult.message || 'I\'ve prepared the schedule adjustments. Please review the proposed changes above and approve them if they look correct.';
              }
              // Handle other tool results - let the AI process the data
              else if (toolResult) {
                // For tools that return data (like get_tour_info), we need to invoke the AI again
                // to generate a natural language response from the tool result
                console.log('📊 Tool returned data without message, invoking AI again to process result');

                // Save tool execution
                await this.saveMessage(
                  session.id,
                  'function',
                  JSON.stringify(toolResult),
                  toolCall.name,
                  toolCall.args,
                  toolResult
                );

                // Add tool result to messages for next iteration
                currentMessages = [
                  ...currentMessages,
                  response,
                  new ToolMessage({
                    content: JSON.stringify(toolResult),
                    tool_call_id: toolCall.id || toolCall.name
                  })
                ];
              }
              else {
                // Save tool execution even if no result
                await this.saveMessage(
                  session.id,
                  'function',
                  'Tool executed',
                  toolCall.name,
                  toolCall.args,
                  toolResult
                );
              }
            } catch (error) {
              console.error('Tool execution error:', error);
              finalResponse = `I encountered an error while trying to adjust the schedule. ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
          }
        }

        // After processing all tool calls in this iteration, invoke AI again
        if (!finalResponse && !proposedChanges) {
          currentResponse = await modelWithTools.invoke(currentMessages);
          console.log(`🤖 Agent iteration ${iterations} complete, checking for more tool calls...`);
        } else {
          // If we got a final response or proposed changes, break the loop
          break;
        }
      }

      // After loop ends - either we have finalResponse/proposedChanges, or we hit max iterations, or no more tool calls
      if (!finalResponse && !proposedChanges) {
        // No tool calls in the response - use the response content directly
        console.log('📝 No more tool calls, using final response content');
        finalResponse = typeof currentResponse.content === 'string'
          ? currentResponse.content
          : Array.isArray(currentResponse.content)
          ? currentResponse.content.map(c => typeof c === 'string' ? c : JSON.stringify(c)).join('')
          : JSON.stringify(currentResponse.content);
      }

      if (iterations >= maxIterations) {
        console.warn(`⚠️ Reached maximum iterations (${maxIterations}), stopping agent loop`);
        if (!finalResponse) {
          finalResponse = 'I apologize, but I encountered a complexity limit while processing your request. Please try breaking it down into simpler steps.';
        }
      }

      // Ensure we have a response
      if (!finalResponse) {
        console.warn('⚠️  No finalResponse set! Using fallback message');
        finalResponse = 'I apologize, but I was unable to process your request. Please try again.';
      }

      console.log('💬 Final response length:', finalResponse.length);

      // Save assistant response
      await this.saveMessage(session.id, 'assistant', finalResponse);

      // Return appropriate response type
      if (proposedChanges && confirmationToken) {
        return {
          type: 'approval_required',
          message: finalResponse,
          proposedChanges,
          confirmationToken,
          sessionId: session.id
        };
      }

      return {
        type: 'message',
        message: finalResponse,
        sessionId: session.id
      };
    } catch (error) {
      console.error('Chat error:', error);

      // Provide more specific error messages based on provider
      let errorMessage = 'An error occurred';
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          errorMessage = `${this.provider === 'gemini' ? 'Gemini' : 'OpenAI'} API key is not configured. Please add it to your environment variables.`;
        } else {
          errorMessage = error.message;
        }
      }

      return {
        type: 'error',
        error: errorMessage,
        sessionId: request.sessionId || ''
      };
    }
  }

  private async buildEnhancedInput(request: ChatRequest): Promise<string> {
    let input = request.message;

    if (request.context) {
      const context = request.context;
      let scheduleContext = '';

      // Auto-fetch today's schedule if user is actively managing a tour
      if (context.tourInfo?.id && context.currentDate) {
        try {
          // Extract date from currentDate (format: ISO string in UTC)
          const currentDateObj = new Date(context.currentDate);
          const today = currentDateObj.toISOString().split('T')[0];

          // Query today's activities for this tour
          // Get today's date in JST from the current UTC timestamp
          const currentJSTDate = new Date(context.currentDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' }); // YYYY-MM-DD format
          const activitiesResult = await this.pool.query(
            `SELECT id, title, type, start_time, end_time, location_details
             FROM activities
             WHERE tour_id = $1
             AND DATE(start_time AT TIME ZONE 'Asia/Tokyo') = $2::date
             ORDER BY start_time`,
            [context.tourInfo.id, currentJSTDate]
          );

          if (activitiesResult.rows.length > 0) {
            scheduleContext = '\n\nTODAY\'S SCHEDULE (JST):';
            activitiesResult.rows.forEach((activity) => {
              const startTime = new Date(activity.start_time).toLocaleTimeString('en-US', {
                timeZone: 'Asia/Tokyo',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              });
              const endTime = new Date(activity.end_time).toLocaleTimeString('en-US', {
                timeZone: 'Asia/Tokyo',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              });
              const location = activity.location_details ? ` @ ${activity.location_details}` : '';
              scheduleContext += `\n- ${activity.title} (${activity.type}) | ${startTime}-${endTime}${location}`;
            });

            // Add current time marker
            const currentTime = currentDateObj.toLocaleTimeString('en-US', {
              timeZone: 'Asia/Tokyo',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            });
            scheduleContext += `\n\n(Current time: ${currentTime} JST)`;
          }
        } catch (error) {
          console.error('Error fetching schedule context:', error);
          // Continue without schedule context if query fails
        }
      }

      input = `
CONTEXT:
Timezone: ${context.timezone || 'Asia/Tokyo'} (JST, UTC+9)
Current date/time: ${new Date(context.currentDate).toLocaleString('en-US', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
})} JST
User role: ${context.userRole}
IMPORTANT: All times mentioned by the user or in schedules are in JST timezone. When working with times, interpret and adjust them as JST.
${context.tourInfo ? `
Active Tour:
- Name: ${context.tourInfo.name}
- Start Date: ${context.tourInfo.startDate}
- End Date: ${context.tourInfo.endDate}
${scheduleContext}` : ''}

USER REQUEST: ${request.message}`;
    }

    return input;
  }

  private generateConfirmationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private async createProposedChanges(
    sessionId: string,
    confirmationToken: string,
    changes: any[]
  ): Promise<void> {
    const proposalId = uuidv4();
    const affectedEntities = this.extractAffectedEntities(changes);

    const query = `
      INSERT INTO ai_proposed_changes
      (id, session_id, confirmation_token, change_type, proposed_changes, affected_entities, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
    `;

    await this.pool.query(query, [
      proposalId,
      sessionId,
      confirmationToken,
      'schedule_adjustment',
      JSON.stringify(changes),
      JSON.stringify(affectedEntities)
    ]);
  }

  private extractAffectedEntities(changes: any[]): any[] {
    const entities: any[] = [];
    const activityIds = new Set<number>();
    const tourIds = new Set<number>();

    changes.forEach(change => {
      if (change.activityId && !activityIds.has(change.activityId)) {
        activityIds.add(change.activityId);
        entities.push({
          type: 'activity',
          id: change.activityId,
          name: change.activityName
        });
      }
      if (change.tourId && !tourIds.has(change.tourId)) {
        tourIds.add(change.tourId);
        entities.push({
          type: 'tour',
          id: change.tourId
        });
      }
    });

    return entities;
  }

  async approveChanges(request: ApprovalRequest, userId: string): Promise<ApprovalResponse> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Get proposed changes
      const proposalQuery = `
        SELECT * FROM ai_proposed_changes
        WHERE confirmation_token = $1 AND status = 'pending'
      `;
      const proposalResult = await client.query(proposalQuery, [request.confirmationToken]);

      if (proposalResult.rows.length === 0) {
        throw new Error('Proposed changes not found or already processed');
      }

      const proposal = proposalResult.rows[0];

      // Check if expired
      if (new Date() > new Date(proposal.expires_at)) {
        await client.query(
          'UPDATE ai_proposed_changes SET status = $1 WHERE id = $2',
          ['expired', proposal.id]
        );
        throw new Error('Approval request has expired');
      }

      if (!request.approved) {
        // Reject the changes
        await client.query(
          `UPDATE ai_proposed_changes
           SET status = 'rejected',
               rejection_reason = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [request.rejectionReason || 'Rejected by user', proposal.id]
        );

        await client.query('COMMIT');
        return {
          success: true,
          message: 'Changes rejected'
        };
      }

      // Apply the approved changes
      // Note: proposed_changes is JSONB in PostgreSQL, so it's already an object
      const changes = Array.isArray(proposal.proposed_changes)
        ? proposal.proposed_changes
        : JSON.parse(proposal.proposed_changes);
      const appliedChanges: ProposedChangeDetail[] = [];

      console.log('📝 Applying approved changes:', {
        changesCount: changes.length,
        changes: changes.map((c: any) => ({
          activityId: c.activityId,
          activityName: c.activityName,
          newStartTime: c.newStartTime,
          newEndTime: c.newEndTime,
          types: {
            newStartTime: typeof c.newStartTime,
            newEndTime: typeof c.newEndTime
          }
        }))
      });

      for (const change of changes) {
        if (change.activityId) {
          // Ensure dates are in the correct format for PostgreSQL
          const newStartTime = typeof change.newStartTime === 'string'
            ? change.newStartTime
            : new Date(change.newStartTime).toISOString();
          const newEndTime = typeof change.newEndTime === 'string'
            ? change.newEndTime
            : new Date(change.newEndTime).toISOString();

          console.log('💾 Updating activity:', {
            activityId: change.activityId,
            activityName: change.activityName,
            newStartTime,
            newEndTime
          });

          // Update activity times
          await client.query(
            `UPDATE activities
             SET start_time = $1::timestamptz,
                 end_time = $2::timestamptz,
                 updated_at = NOW()
             WHERE id = $3`,
            [newStartTime, newEndTime, change.activityId]
          );

          console.log('✅ Activity updated successfully:', change.activityId);

          appliedChanges.push({
            entityType: 'activity',
            entityId: change.activityId,
            field: 'time',
            oldValue: { start: change.oldStartTime, end: change.oldEndTime },
            newValue: { start: newStartTime, end: newEndTime },
            description: `Updated ${change.activityName} schedule`
          });
        }
      }

      // Mark proposal as approved
      await client.query(
        `UPDATE ai_proposed_changes
         SET status = 'approved',
             approved_by = $1,
             approved_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [userId, proposal.id]
      );

      await client.query('COMMIT');

      return {
        success: true,
        message: 'Changes applied successfully',
        appliedChanges
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error approving changes:', error);
      return {
        success: false,
        message: 'Failed to apply changes',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      client.release();
    }
  }

  async endSession(sessionId: string): Promise<void> {
    await this.pool.query(
      `UPDATE ai_chat_sessions
       SET status = 'ended',
           ended_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [sessionId]
    );
  }

  // Helper method to get current provider
  getProvider(): string {
    return this.provider;
  }
}