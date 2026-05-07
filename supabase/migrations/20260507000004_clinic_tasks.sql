-- ============================================================
-- PacienteIA — Clinic Tasks (internal customer health ops)
-- Internal-only table: no clinic user should ever read this.
-- Access is via service-role client only (RLS deny-all).
-- ============================================================

CREATE TABLE public.clinic_tasks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  trigger_type     TEXT        NOT NULL,
    -- 'at_risk' | 'churned' | 'upgrade_ready' | 'high_friction' | 'declining' | 'inactive'
  status           TEXT        NOT NULL DEFAULT 'open'
                               CHECK (status IN ('open', 'done', 'snoozed')),
  priority         TEXT        NOT NULL DEFAULT 'medium'
                               CHECK (priority IN ('high', 'medium', 'low')),
  title            TEXT        NOT NULL,
  description      TEXT        NOT NULL,
  action_text      TEXT        NOT NULL,
  message_template TEXT,
  health_score     INT,
  snoozed_until    TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DB-level guard: only one open task per (clinic, trigger) at a time
CREATE UNIQUE INDEX clinic_tasks_open_uniq
  ON public.clinic_tasks (clinic_id, trigger_type)
  WHERE status = 'open';

CREATE INDEX idx_clinic_tasks_status  ON public.clinic_tasks (status, created_at DESC);
CREATE INDEX idx_clinic_tasks_clinic  ON public.clinic_tasks (clinic_id, status);

-- Updated_at trigger
CREATE TRIGGER set_clinic_tasks_updated_at
  BEFORE UPDATE ON public.clinic_tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS: deny all for non-service-role connections (internal table)
ALTER TABLE public.clinic_tasks ENABLE ROW LEVEL SECURITY;
-- No policies = default deny. Service role bypasses RLS.
