-- Recreate slot_openings with multi-tenant schema (organization_id / branch_id).
-- The original table used clinic_id (dropped in the v1→v2 schema migration).
-- Adds notified_phones JSONB to track who has actually been messaged.
-- Adds gap_detected to reason_opened so the dashboard filter works.

DROP TABLE IF EXISTS public.slot_openings CASCADE;

CREATE TABLE public.slot_openings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id           UUID        REFERENCES public.branches(id),
  appointment_id      UUID        REFERENCES public.appointments(id) ON DELETE SET NULL,

  treatment_type      TEXT        NOT NULL,
  slot_start          TIMESTAMPTZ NOT NULL,
  slot_end            TIMESTAMPTZ,

  reason_opened       TEXT        NOT NULL
    CHECK (reason_opened IN ('cancellation', 'no_show', 'reschedule', 'manual', 'gap_detected')),

  status              TEXT        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'filled', 'expired')),

  -- Ranked candidates computed at trigger time
  candidates          JSONB       NOT NULL DEFAULT '[]',
  candidate_count     INT         NOT NULL DEFAULT 0,

  -- Phones that have already been sent a WhatsApp backfill offer
  notified_phones     JSONB       NOT NULL DEFAULT '[]',

  selected_patient_id UUID        REFERENCES public.patients(id)     ON DELETE SET NULL,
  new_appointment_id  UUID        REFERENCES public.appointments(id) ON DELETE SET NULL,
  fill_attempts       INT         NOT NULL DEFAULT 0,
  staff_task_id       UUID        REFERENCES public.copilot_tasks(id) ON DELETE SET NULL,

  filled_at           TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_slot_openings_org_status ON public.slot_openings (organization_id, status, slot_start ASC);
CREATE INDEX idx_slot_openings_appointment ON public.slot_openings (appointment_id);

ALTER TABLE public.slot_openings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "slot_openings: org member select"
  ON public.slot_openings FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "slot_openings: org member insert"
  ON public.slot_openings FOR INSERT
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "slot_openings: org member update"
  ON public.slot_openings FOR UPDATE
  USING (public.is_org_member(organization_id));

-- Waitlist opt-in flag on patients (created by old migration; safe to re-add)
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS on_waitlist BOOLEAN NOT NULL DEFAULT FALSE;
