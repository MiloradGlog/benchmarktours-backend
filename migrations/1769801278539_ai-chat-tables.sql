-- Up Migration

-- AI chat sessions table
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tour_id INTEGER REFERENCES tours(id) ON DELETE SET NULL,
  title VARCHAR(255),
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  message_count INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  total_cost DECIMAL(10, 4) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active', -- active, ended, error
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- AI conversation messages table
CREATE TABLE IF NOT EXISTS ai_conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL, -- user, assistant, system, function
  content TEXT NOT NULL,
  function_name VARCHAR(255),
  function_args JSONB,
  function_result JSONB,
  tokens_used INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- AI proposed changes table for approval workflow
CREATE TABLE IF NOT EXISTS ai_proposed_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  confirmation_token VARCHAR(255) UNIQUE NOT NULL,
  change_type VARCHAR(100) NOT NULL, -- schedule_adjustment, activity_update, etc.
  proposed_changes JSONB NOT NULL,
  affected_entities JSONB NOT NULL, -- List of affected activity IDs, tour IDs, etc.
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, expired
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '15 minutes'),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- AI tool executions table for tracking tool usage
CREATE TABLE IF NOT EXISTS ai_tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  message_id UUID REFERENCES ai_conversation_messages(id) ON DELETE CASCADE,
  tool_name VARCHAR(255) NOT NULL,
  tool_input JSONB NOT NULL,
  tool_output JSONB,
  execution_time_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user_id ON ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_tour_id ON ai_chat_sessions(tour_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_status ON ai_chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_ai_conversation_messages_session_id ON ai_conversation_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_proposed_changes_session_id ON ai_proposed_changes(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_proposed_changes_confirmation_token ON ai_proposed_changes(confirmation_token);
CREATE INDEX IF NOT EXISTS idx_ai_proposed_changes_status ON ai_proposed_changes(status);
CREATE INDEX IF NOT EXISTS idx_ai_tool_executions_session_id ON ai_tool_executions(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_tool_executions_tool_name ON ai_tool_executions(tool_name);

-- Down Migration
-- To rollback:
-- DROP INDEX IF EXISTS idx_ai_tool_executions_tool_name;
-- DROP INDEX IF EXISTS idx_ai_tool_executions_session_id;
-- DROP INDEX IF EXISTS idx_ai_proposed_changes_status;
-- DROP INDEX IF EXISTS idx_ai_proposed_changes_confirmation_token;
-- DROP INDEX IF EXISTS idx_ai_proposed_changes_session_id;
-- DROP INDEX IF EXISTS idx_ai_conversation_messages_session_id;
-- DROP INDEX IF EXISTS idx_ai_chat_sessions_status;
-- DROP INDEX IF EXISTS idx_ai_chat_sessions_tour_id;
-- DROP INDEX IF EXISTS idx_ai_chat_sessions_user_id;
-- DROP TABLE IF EXISTS ai_tool_executions;
-- DROP TABLE IF EXISTS ai_proposed_changes;
-- DROP TABLE IF EXISTS ai_conversation_messages;
-- DROP TABLE IF EXISTS ai_chat_sessions;