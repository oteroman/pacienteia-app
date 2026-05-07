-- ============================================================
-- PacienteIA — Task Audit + Automation tracking fields
-- ============================================================

-- ── 1. Extend clinic_tasks with automation tracking ──────────
ALTER TABLE public.clinic_tasks
  ADD COLUMN escalated_at     TIMESTAMPTZ,  -- set when cron auto-escalates priority
  ADD COLUMN reminder_sent_at TIMESTAMPTZ,  -- set when first automated reminder is logged
  ADD COLUMN last_note        TEXT;          -- denormalized last note for quick display

-- ── 2. Audit log ─────────────────────────────────────────────
CREATE TABLE public.clinic_task_audit (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id        UUID        NOT NULL REFERENCES public.clinic_tasks(id) ON DELETE CASCADE,
  clinic_id      UUID        NOT NULL,
  action_type    TEXT        NOT NULL,
    -- 'created' | 'resolved' | 'snoozed' | 'reopened' | 'escalated' | 'reminded' | 'note'
  prev_status    TEXT,
  new_status     TEXT,
  prev_priority  TEXT,
  new_priority   TEXT,
  actor          TEXT        NOT NULL DEFAULT 'system',  -- 'system' | 'admin'
  note           TEXT,
  metadata       JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_audit_task    ON public.clinic_task_audit (task_id, created_at DESC);
CREATE INDEX idx_task_audit_clinic  ON public.clinic_task_audit (clinic_id, created_at DESC);
CREATE INDEX idx_task_audit_type    ON public.clinic_task_audit (action_type, created_at DESC);

-- RLS: deny all (internal only — service role bypasses)
ALTER TABLE public.clinic_task_audit ENABLE ROW LEVEL SECURITY;
