-- Fix message_search RLS: the trigger that populates message_search runs as
-- the inserting user, so it needs an INSERT policy.

-- Allow users to insert into message_search for conversations they belong to
CREATE POLICY "Users can insert message_search for their conversations" ON message_search
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = message_search.conversation_id
      AND (conversations.exporter_id = auth.uid() OR conversations.provider_id = auth.uid())
    )
  );

-- Alternatively, make the trigger function SECURITY DEFINER so it bypasses RLS
CREATE OR REPLACE FUNCTION populate_message_search()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO message_search (message_id, conversation_id, content_tsv)
  VALUES (NEW.id, NEW.conversation_id, to_tsvector('english', NEW.content))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
