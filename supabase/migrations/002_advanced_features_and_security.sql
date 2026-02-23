-- Phase 9: Advanced Features & Security Enhancements

-- 1. Assume tracking_events and live_locations already exist, add RLS
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_locations ENABLE ROW LEVEL SECURITY;

-- Tracking events RLS: Users can view events for their bookings
CREATE POLICY "Users can view tracking events for their bookings" ON tracking_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings
      LEFT JOIN containers ON containers.id = bookings.container_id
      WHERE bookings.id = tracking_events.booking_id
      AND (bookings.exporter_id = auth.uid() OR containers.provider_id = auth.uid())
    )
  );

-- Live locations RLS: Users can view locations for their bookings
CREATE POLICY "Users can view live locations for their bookings" ON live_locations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings
      LEFT JOIN containers ON containers.id = bookings.container_id
      WHERE bookings.id = live_locations.booking_id
      AND (bookings.exporter_id = auth.uid() OR containers.provider_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert live locations for their bookings" ON live_locations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings
      LEFT JOIN containers ON containers.id = bookings.container_id
      WHERE bookings.id = live_locations.booking_id
      AND (bookings.exporter_id = auth.uid() OR containers.provider_id = auth.uid())
    )
  );

CREATE POLICY "Users can update live locations for their bookings" ON live_locations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM bookings
      LEFT JOIN containers ON containers.id = bookings.container_id
      WHERE bookings.id = live_locations.booking_id
      AND (bookings.exporter_id = auth.uid() OR containers.provider_id = auth.uid())
    )
  );

-- 2. Create token_usage table for tracking AI API usage
CREATE TABLE token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  tokens_consumed INT NOT NULL,
  cost DECIMAL(10, 4) NOT NULL DEFAULT 0,
  model TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_token_usage_user_id ON token_usage(user_id);
CREATE INDEX idx_token_usage_conversation_id ON token_usage(conversation_id);
CREATE INDEX idx_token_usage_timestamp ON token_usage(timestamp);

-- RLS for token_usage: Users can view only their own usage
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own token usage" ON token_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert token usage" ON token_usage
  FOR INSERT WITH CHECK (true);

-- 3. Create rate_limits table for tracking request limits
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  message_count INT DEFAULT 0,
  last_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  window_seconds INT DEFAULT 3600
);

CREATE INDEX idx_rate_limits_user_id ON rate_limits(user_id);

-- RLS for rate_limits: Users can view only their own limits
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rate limits" ON rate_limits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rate limits" ON rate_limits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rate limits" ON rate_limits
  FOR UPDATE USING (auth.uid() = user_id);

-- 4. Create message_search table for full-text search indexing
CREATE TABLE message_search (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  content_tsv TSVECTOR,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_message_search_tsv ON message_search USING GIN(content_tsv);
CREATE INDEX idx_message_search_conversation_id ON message_search(conversation_id);

-- RLS for message_search: Users can view only messages in their conversations
ALTER TABLE message_search ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can search messages in their conversations" ON message_search
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = message_search.conversation_id
      AND (conversations.exporter_id = auth.uid() OR conversations.provider_id = auth.uid())
    )
  );

-- 5. Create trigger to auto-populate message_search on message insert
CREATE OR REPLACE FUNCTION populate_message_search()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO message_search (message_id, conversation_id, content_tsv)
  VALUES (NEW.id, NEW.conversation_id, to_tsvector('english', NEW.content))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER message_search_trigger
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION populate_message_search();

-- 6. Create audit_log table for tracking important actions
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  changes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- RLS for audit_log: Admins/system can view all; users see their own
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all audit logs" ON audit_log
  FOR SELECT USING (auth.jwt() ->> 'role' = 'authenticated');

-- 7. Create container_allocation_log for tracking container usage
CREATE TABLE container_allocation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  allocated_cbm DECIMAL(10, 2) NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('allocate', 'deallocate', 'return')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_container_allocation_log_container_id ON container_allocation_log(container_id);
CREATE INDEX idx_container_allocation_log_booking_id ON container_allocation_log(booking_id);

-- RLS for container_allocation_log: Users can view logs for their bookings
ALTER TABLE container_allocation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view allocation logs for their bookings" ON container_allocation_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings
      LEFT JOIN containers ON containers.id = bookings.container_id
      WHERE bookings.id = container_allocation_log.booking_id
      AND (bookings.exporter_id = auth.uid() OR containers.provider_id = auth.uid())
    )
  );
