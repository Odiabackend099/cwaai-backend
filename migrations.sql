-- CallWaitingAI Voice API Gateway
-- Supabase Database Migrations
-- Run these in Supabase SQL Editor

-- =====================================================
-- 1. Call Logs Table
-- =====================================================
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  request_body JSONB,
  response_body JSONB,
  error_message TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_call_logs_user_id ON call_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON call_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_endpoint ON call_logs(endpoint);

-- Row Level Security (RLS)
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own logs
CREATE POLICY "Users can view their own call logs"
  ON call_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert logs
CREATE POLICY "Service role can insert call logs"
  ON call_logs FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- 2. Webhook Events Table
-- =====================================================
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for unprocessed events
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed, created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);

-- Row Level Security
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access webhook events
CREATE POLICY "Service role can manage webhook events"
  ON webhook_events FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 3. Enhanced Leads Table (Add new columns)
-- =====================================================
-- Add columns if they don't exist (safe for existing tables)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'qualification_score') THEN
    ALTER TABLE leads ADD COLUMN qualification_score NUMERIC(3,2) CHECK (qualification_score >= 0 AND qualification_score <= 1);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'flutterwave_payment_link') THEN
    ALTER TABLE leads ADD COLUMN flutterwave_payment_link TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'payment_status') THEN
    ALTER TABLE leads ADD COLUMN payment_status TEXT CHECK (payment_status IN ('pending', 'completed', 'failed'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'telegram_notified_at') THEN
    ALTER TABLE leads ADD COLUMN telegram_notified_at TIMESTAMPTZ;
  END IF;
END $$;

-- =====================================================
-- 4. Update Calls Table (Add missing columns)
-- =====================================================
-- Ensure all necessary columns exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'ai_response') THEN
    ALTER TABLE calls ADD COLUMN ai_response TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'audio_url') THEN
    ALTER TABLE calls ADD COLUMN audio_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calls' AND column_name = 'recording_sid') THEN
    ALTER TABLE calls ADD COLUMN recording_sid TEXT;
  END IF;
END $$;

-- =====================================================
-- 5. Utility Functions
-- =====================================================

-- Function: Get user's call statistics
CREATE OR REPLACE FUNCTION get_user_call_stats(user_id_param UUID)
RETURNS TABLE(
  total_calls BIGINT,
  answered_calls BIGINT,
  missed_calls BIGINT,
  total_duration INTEGER,
  calls_this_month BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_calls,
    COUNT(*) FILTER (WHERE status = 'answered')::BIGINT AS answered_calls,
    COUNT(*) FILTER (WHERE status = 'missed')::BIGINT AS missed_calls,
    SUM(COALESCE(duration, 0))::INTEGER AS total_duration,
    COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW()))::BIGINT AS calls_this_month
  FROM calls
  WHERE user_id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get user's qualified leads count
CREATE OR REPLACE FUNCTION get_qualified_leads_count(user_id_param UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM leads
    WHERE user_id = user_id_param AND is_qualified = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. Indexes for Performance
-- =====================================================

-- Leads table indexes
CREATE INDEX IF NOT EXISTS idx_leads_qualified ON leads(is_qualified, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_payment_status ON leads(payment_status) WHERE payment_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_user_created ON leads(user_id, created_at DESC);

-- Calls table indexes
CREATE INDEX IF NOT EXISTS idx_calls_user_status ON calls(user_id, status);
CREATE INDEX IF NOT EXISTS idx_calls_created ON calls(created_at DESC);

-- =====================================================
-- 7. Sample Data Verification (Optional)
-- =====================================================

-- Check if tables exist and show row counts
DO $$
DECLARE
  call_logs_count INTEGER;
  webhook_events_count INTEGER;
  leads_count INTEGER;
  calls_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO call_logs_count FROM call_logs;
  SELECT COUNT(*) INTO webhook_events_count FROM webhook_events;
  SELECT COUNT(*) INTO leads_count FROM leads;
  SELECT COUNT(*) INTO calls_count FROM calls;

  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'call_logs: % rows', call_logs_count;
  RAISE NOTICE 'webhook_events: % rows', webhook_events_count;
  RAISE NOTICE 'leads: % rows', leads_count;
  RAISE NOTICE 'calls: % rows', calls_count;
END $$;

-- =====================================================
-- 8. Grant Permissions
-- =====================================================

-- Grant necessary permissions to authenticated users
GRANT SELECT ON call_logs TO authenticated;
GRANT SELECT ON leads TO authenticated;
GRANT SELECT ON calls TO authenticated;

-- Grant all permissions to service role (already has by default, but explicit is better)
GRANT ALL ON call_logs TO service_role;
GRANT ALL ON webhook_events TO service_role;
GRANT ALL ON leads TO service_role;
GRANT ALL ON calls TO service_role;
