-- ─────────────────────────────────────────────────────────────
-- Add 'gap_detected' to slot_openings reason_opened enum
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.slot_openings
  DROP CONSTRAINT IF EXISTS slot_openings_reason_opened_check;

ALTER TABLE public.slot_openings
  ADD CONSTRAINT slot_openings_reason_opened_check
  CHECK (reason_opened IN (
    'cancellation',   -- appointment cancelled
    'no_show',        -- patient didn't show up
    'reschedule',     -- moved to another time
    'manual',         -- staff opened manually
    'gap_detected'    -- proactive: day below density threshold
  ));
