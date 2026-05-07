-- ─────────────────────────────────────────────────────────────
-- Intake orchestration fields
-- Adds SLA, escalation, follow-up, and interaction tracking
-- ─────────────────────────────────────────────────────────────

-- Extend status check to include operational waiting states
ALTER TABLE public.intakes
  DROP CONSTRAINT IF EXISTS intakes_status_check;

ALTER TABLE public.intakes
  ADD CONSTRAINT intakes_status_check
    CHECK (status IN ('new', 'in_progress', 'waiting_customer', 'waiting_staff', 'resolved', 'dismissed'));

-- Orchestration columns
ALTER TABLE public.intakes
  ADD COLUMN IF NOT EXISTS first_response_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_due_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalation_level   INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interaction_count  INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS follow_up_due_at   TIMESTAMPTZ;

-- Index for SLA cron queries
CREATE INDEX IF NOT EXISTS idx_intakes_sla
  ON public.intakes (clinic_id, sla_due_at)
  WHERE status IN ('new', 'in_progress', 'waiting_staff');

CREATE INDEX IF NOT EXISTS idx_intakes_followup
  ON public.intakes (clinic_id, follow_up_due_at)
  WHERE status = 'waiting_customer';
