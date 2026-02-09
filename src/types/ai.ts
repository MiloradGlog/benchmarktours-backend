// AI Service Type Definitions

export interface AIChatSession {
  id: string;
  userId: string;
  tourId?: number;
  title?: string;
  startedAt: Date;
  endedAt?: Date;
  messageCount: number;
  tokensUsed: number;
  totalCost: number;
  status: 'active' | 'ended' | 'error';
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIConversationMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'function';
  content: string;
  functionName?: string;
  functionArgs?: Record<string, any>;
  functionResult?: Record<string, any>;
  tokensUsed?: number;
  createdAt: Date;
}

export interface AIProposedChange {
  id: string;
  sessionId: string;
  confirmationToken: string;
  changeType: 'schedule_adjustment' | 'activity_update' | 'batch_schedule_update';
  proposedChanges: ProposedChangeDetail[];
  affectedEntities: AffectedEntity[];
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProposedChangeDetail {
  entityType: 'activity' | 'tour';
  entityId: number;
  field: string;
  oldValue: any;
  newValue: any;
  description: string;
}

export interface AffectedEntity {
  type: 'activity' | 'tour' | 'participant';
  id: number;
  name?: string;
}

export interface AIToolExecution {
  id: string;
  sessionId: string;
  messageId?: string;
  toolName: string;
  toolInput: Record<string, any>;
  toolOutput?: Record<string, any>;
  executionTimeMs?: number;
  success: boolean;
  errorMessage?: string;
  createdAt: Date;
}

// Tool Definitions
export interface ScheduleAdjustmentParams {
  activityIds: number[];
  offsetMinutes: number;
  effectiveFrom: string; // ISO datetime
  reason?: string;
  executeImmediately?: boolean; // If true, apply changes directly without approval
}

export interface ScheduleAdjustmentResult {
  success: boolean;
  proposedChanges?: ActivityTimeChange[]; // Present when requiresApproval is true
  appliedChanges?: ActivityTimeChange[]; // Present when executeImmediately is true
  requiresApproval: boolean;
  confirmationToken?: string;
  conflicts?: ScheduleConflict[];
  message?: string; // Optional message to return to user
}

export interface ActivityTimeChange {
  activityId: number;
  activityName: string;
  tourId: number;
  oldStartTime: Date;
  newStartTime: Date;
  oldEndTime: Date;
  newEndTime: Date;
  affectedParticipants: string[];
}

export interface ScheduleConflict {
  type: 'overlap' | 'too_early' | 'too_late' | 'insufficient_gap' | 'error';
  activityId: number;
  description: string;
  severity: 'error' | 'warning';
}

// Chat API Request/Response types
export interface ChatRequest {
  message: string;
  sessionId?: string;
  tourId?: number;
  context?: ChatContext;
}

export interface ChatContext {
  currentDate: string;
  userRole: string;
  timezone: string; // e.g., 'Asia/Tokyo'
  tourInfo?: {
    id: number;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
  };
}

export interface ChatResponse {
  type: 'message' | 'approval_required' | 'error';
  message?: string;
  proposedChanges?: ProposedChangeDetail[];
  confirmationToken?: string;
  sessionId: string;
  error?: string;
}

export interface ApprovalRequest {
  confirmationToken: string;
  approved: boolean;
  rejectionReason?: string;
}

export interface ApprovalResponse {
  success: boolean;
  message: string;
  appliedChanges?: ProposedChangeDetail[];
  error?: string;
}

// LangChain specific types
export interface ToolDefinition {
  name: string;
  description: string;
  schema: Record<string, any>; // Zod schema
  handler: (params: any) => Promise<any>;
}

export interface AgentConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  tools: ToolDefinition[];
  systemPrompt?: string;
}

// Activity types from existing system
export interface Activity {
  id: number;
  tour_id: number;
  company_id?: number;
  type: 'CompanyVisit' | 'Hotel' | 'Restaurant' | 'Travel' | 'Other';
  name: string;
  description?: string;
  location?: string;
  start_time: Date;
  end_time: Date;
  image_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Tour {
  id: number;
  name: string;
  description?: string;
  start_date: Date;
  end_date: Date;
  status: 'Active' | 'Completed' | 'Cancelled';
  theme_primary_color?: string;
  theme_logo_url?: string;
  post_tour_access_window?: number;
  created_at: Date;
  updated_at: Date;
}