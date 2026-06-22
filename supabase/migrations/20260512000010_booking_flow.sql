-- Stores active self-booking conversation state (service selection → slot selection).
-- Cleared automatically once the appointment is created or the flow expires.
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS booking_flow            JSONB,
  ADD COLUMN IF NOT EXISTS booking_flow_updated_at TIMESTAMPTZ;

-- Fast lookup: find conversations with an active booking flow
CREATE INDEX IF NOT EXISTS idx_conversations_booking_flow
  ON public.conversations (organization_id, booking_flow_updated_at DESC)
  WHERE booking_flow IS NOT NULL;
