-- ─────────────────────────────────────────────────────────────
-- Intake audit log
-- Append-only record of what happened to each intake and who did it.
-- Actor = 'system' for cron/automation, user_id for staff actions.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE public.intake_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id   UUID        NOT NULL REFERENCES public.intakes(id) ON DELETE CASCADE,
  clinic_id   UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL,
                          -- created | normalized | assigned | status_changed
                          -- escalated | followup_triggered | resolved | dismissed
                          -- task_created | draft_requested
  actor       TEXT        NOT NULL DEFAULT 'system',   -- 'system' or auth user UUID
  details     JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_intake_events_intake ON public.intake_events (intake_id, created_at DESC);
CREATE INDEX idx_intake_events_clinic ON public.intake_events (clinic_id, created_at DESC);

ALTER TABLE public.intake_events ENABLE ROW LEVEL SECURITY;
