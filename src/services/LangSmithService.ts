import { Client } from 'langsmith';
import { CallbackHandler } from '@langchain/core/callbacks/base';

interface LangSmithConfig {
  apiKey?: string;
  apiUrl?: string;
  projectName?: string;
  enabled?: boolean;
}

export class LangSmithService {
  private client: Client | null = null;
  private projectName: string;
  private enabled: boolean;

  constructor(config?: LangSmithConfig) {
    this.enabled = config?.enabled !== false && process.env.LANGSMITH_ENABLED !== 'false';
    this.projectName = config?.projectName || process.env.LANGSMITH_PROJECT || 'benchmark-tours-ai';

    if (this.enabled && (config?.apiKey || process.env.LANGSMITH_API_KEY)) {
      try {
        this.client = new Client({
          apiKey: config?.apiKey || process.env.LANGSMITH_API_KEY,
          apiUrl: config?.apiUrl || process.env.LANGSMITH_API_URL || 'https://api.smith.langchain.com'
        });
        console.log(`LangSmith monitoring enabled for project: ${this.projectName}`);
      } catch (error) {
        console.warn('Failed to initialize LangSmith client:', error);
        this.enabled = false;
      }
    } else {
      console.log('LangSmith monitoring is disabled');
    }
  }

  /**
   * Get LangSmith callbacks for LangChain integration
   */
  getCallbacks(): CallbackHandler[] {
    if (!this.enabled || !this.client) {
      return [];
    }

    // Create a custom callback handler for LangSmith
    const callbacks: CallbackHandler[] = [];

    const handler: CallbackHandler = {
      name: 'LangSmithHandler',

      handleLLMStart: async (llm: any, prompts: string[], runId?: string) => {
        if (!this.client) return;

        try {
          await this.client.createRun({
            name: 'llm_call',
            run_type: 'llm',
            inputs: { prompts },
            project_name: this.projectName,
            tags: ['production', 'schedule-assistant'],
            extra: {
              model: llm.modelName || 'unknown',
              temperature: llm.temperature,
              max_tokens: llm.maxTokens
            }
          });
        } catch (error) {
          console.error('LangSmith logging error:', error);
        }
      },

      handleLLMEnd: async (output: any, runId?: string) => {
        // Log completion metrics
        if (!this.client) return;

        try {
          // Track token usage and cost
          const tokenUsage = output.llmOutput?.tokenUsage;
          if (tokenUsage) {
            console.log('Token usage:', tokenUsage);
          }
        } catch (error) {
          console.error('LangSmith logging error:', error);
        }
      },

      handleLLMError: async (error: Error, runId?: string) => {
        console.error('LLM Error:', error);
      },

      handleToolStart: async (tool: any, input: string, runId?: string) => {
        if (!this.client) return;

        try {
          await this.client.createRun({
            name: `tool_${tool.name}`,
            run_type: 'tool',
            inputs: { input },
            project_name: this.projectName,
            tags: ['tool', tool.name]
          });
        } catch (error) {
          console.error('LangSmith tool logging error:', error);
        }
      },

      handleToolEnd: async (output: string, runId?: string) => {
        // Tool execution completed
        if (!this.client) return;
        console.log('Tool execution completed');
      },

      handleToolError: async (error: Error, runId?: string) => {
        console.error('Tool Error:', error);
      },

      handleChainStart: async (chain: any, inputs: any, runId?: string) => {
        if (!this.client) return;

        try {
          await this.client.createRun({
            name: 'chat_session',
            run_type: 'chain',
            inputs,
            project_name: this.projectName,
            tags: ['chat', 'agent']
          });
        } catch (error) {
          console.error('LangSmith chain logging error:', error);
        }
      },

      handleChainEnd: async (outputs: any, runId?: string) => {
        // Chain completed
        if (!this.client) return;
        console.log('Chain execution completed');
      },

      handleChainError: async (error: Error, runId?: string) => {
        console.error('Chain Error:', error);
      },

      handleAgentAction: async (action: any, runId?: string) => {
        if (!this.client) return;
        console.log('Agent action:', action);
      },

      handleAgentEnd: async (action: any, runId?: string) => {
        if (!this.client) return;
        console.log('Agent completed');
      }
    };

    callbacks.push(handler);
    return callbacks;
  }

  /**
   * Create a custom trace for specific events
   */
  async createTrace(
    name: string,
    inputs: Record<string, any>,
    outputs?: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.enabled || !this.client) return;

    try {
      await this.client.createRun({
        name,
        run_type: 'chain',
        inputs,
        outputs,
        project_name: this.projectName,
        tags: metadata?.tags || [],
        extra: metadata
      });
    } catch (error) {
      console.error('Failed to create LangSmith trace:', error);
    }
  }

  /**
   * Log a chat session
   */
  async logChatSession(
    sessionId: string,
    userId: string,
    tourId?: number
  ): Promise<void> {
    await this.createTrace(
      'chat_session_started',
      {
        sessionId,
        userId,
        tourId
      },
      undefined,
      {
        tags: ['session', 'chat'],
        sessionId,
        userId
      }
    );
  }

  /**
   * Log tool usage
   */
  async logToolUsage(
    toolName: string,
    input: any,
    output: any,
    executionTimeMs: number,
    success: boolean
  ): Promise<void> {
    await this.createTrace(
      `tool_${toolName}`,
      input,
      output,
      {
        tags: ['tool', toolName],
        executionTimeMs,
        success
      }
    );
  }

  /**
   * Log approval request
   */
  async logApprovalRequest(
    confirmationToken: string,
    proposedChanges: any[],
    approved: boolean,
    userId: string
  ): Promise<void> {
    await this.createTrace(
      'approval_request',
      {
        confirmationToken,
        proposedChanges
      },
      {
        approved,
        userId
      },
      {
        tags: ['approval', approved ? 'approved' : 'rejected'],
        userId
      }
    );
  }

  /**
   * Log errors
   */
  async logError(
    errorType: string,
    error: Error,
    context: Record<string, any>
  ): Promise<void> {
    await this.createTrace(
      `error_${errorType}`,
      context,
      {
        error: error.message,
        stack: error.stack
      },
      {
        tags: ['error', errorType]
      }
    );
  }

  /**
   * Get project metrics
   */
  async getMetrics(): Promise<any> {
    if (!this.enabled || !this.client) {
      return null;
    }

    try {
      // This would typically query LangSmith API for metrics
      // For now, returning a placeholder
      return {
        projectName: this.projectName,
        enabled: this.enabled,
        message: 'Metrics endpoint would return usage statistics from LangSmith'
      };
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      return null;
    }
  }

  /**
   * Check if monitoring is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}