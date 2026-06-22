-- Conversation history for Paxi sales bot
CREATE TABLE IF NOT EXISTS sales_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID        NOT NULL REFERENCES sales_prospects(id) ON DELETE CASCADE,
  direction   TEXT        NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body        TEXT        NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_messages_prospect
  ON sales_messages(prospect_id, sent_at DESC);
