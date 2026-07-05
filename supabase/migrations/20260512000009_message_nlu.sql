-- Store NLU classification results on messages so the inbox can show intent badges
-- without re-running Gemini on every page load.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS detected_intent    TEXT,
  ADD COLUMN IF NOT EXISTS intent_confidence  TEXT,
  ADD COLUMN IF NOT EXISTS intent_summary     TEXT;

-- Fast lookup for conversations with actionable intents (inbox badge filter)
CREATE INDEX IF NOT EXISTS idx_messages_intent
  ON public.messages (organization_id, detected_intent, created_at DESC)
  WHERE detected_intent IS NOT NULL;

-- Convenience column on conversations so the inbox list can show a badge
-- without joining messages.
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS last_intent       TEXT,
  ADD COLUMN IF NOT EXISTS last_intent_at    TIMESTAMPTZ;
