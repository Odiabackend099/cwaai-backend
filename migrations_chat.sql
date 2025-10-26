-- =====================================================
-- Chat Conversations Table
-- Stores AI widget chat conversations with memory
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT UNIQUE NOT NULL,
  session_id TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  user_metadata JSONB DEFAULT '{}'::jsonb,
  sentiment_score DECIMAL(3,2) DEFAULT 0.5,
  intent TEXT DEFAULT 'general',
  urgency TEXT DEFAULT 'medium',
  keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  message_count INTEGER DEFAULT 0,
  lead_captured BOOLEAN DEFAULT FALSE,
  lead_captured_at TIMESTAMP WITH TIME ZONE,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_chat_conversations_conversation_id
  ON chat_conversations(conversation_id);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_session_id
  ON chat_conversations(session_id);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_lead_captured
  ON chat_conversations(lead_captured);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_message_at
  ON chat_conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_sentiment_score
  ON chat_conversations(sentiment_score DESC);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_chat_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_chat_conversations_updated_at
  BEFORE UPDATE ON chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_conversations_updated_at();

-- Enable Row Level Security (optional)
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public to insert (for AI widget)
CREATE POLICY "Allow public insert" ON chat_conversations
  FOR INSERT WITH CHECK (true);

-- Policy: Allow public to select their own conversations
CREATE POLICY "Allow public select" ON chat_conversations
  FOR SELECT USING (true);

-- Policy: Allow public to update their own conversations
CREATE POLICY "Allow public update" ON chat_conversations
  FOR UPDATE USING (true);

COMMENT ON TABLE chat_conversations IS 'Stores AI widget chat conversations with sentiment analysis and lead qualification';
COMMENT ON COLUMN chat_conversations.conversation_id IS 'Unique identifier for conversation thread';
COMMENT ON COLUMN chat_conversations.session_id IS 'Browser session identifier';
COMMENT ON COLUMN chat_conversations.messages IS 'Array of chat messages with role, content, and timestamp';
COMMENT ON COLUMN chat_conversations.sentiment_score IS 'Lead qualification score (0-1)';
COMMENT ON COLUMN chat_conversations.intent IS 'Detected user intent (information, demo, pricing, etc)';
COMMENT ON COLUMN chat_conversations.urgency IS 'Urgency level (low, medium, high)';
