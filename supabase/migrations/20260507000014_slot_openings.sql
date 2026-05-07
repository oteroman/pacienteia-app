-- ─────────────────────────────────────────────────────────────
-- Slot openings: freed appointment slots and backfill lifecycle
-- ─────────────────────────────────────────────────────────────

-- Flag on patients to opt-in to waitlist (fast contacto de última hora)
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS on_waitlist BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE public.slot_openings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID        NOT NULL REFERENCES public.clinics(id)      ON DELETE CASCADE,

  -- Freed appointment (nullable: manual or gap-detected slots may have no source appt)
  appointment_id      UUID                 REFERENCES public.appointments(id) ON DELETE SET NULL,
  treatment_type      TEXT        NOT NULL,
  slot_start          TIMESTAMPTZ NOT NULL,
  slot_end            TIMESTAMPTZ,

  reason_opened       TEXT        NOT NULL
                                  CHECK (reason_opened IN (
                                    'cancellation',   -- appointment cancelled
                                    'no_show',        -- patient didn't show up
                                    'reschedule',     -- moved to another time
                                    'manual'          -- staff opened it manually
                                  )),

  status              TEXT        NOT NULL DEFAULT 'open'
                                  CHECK (status IN ('open', 'filled', 'expired')),

  -- Ranked candidate list computed at trigger time (JSONB for fast reads)
  -- Each element: {patientId, patientName, phone, score, scoreReasons[], waMessage}
  candidates          JSONB       NOT NULL DEFAULT '[]',
  candidate_count     INT         NOT NULL DEFAULT 0,

  selected_patient_id UUID                 REFERENCES public.patients(id)     ON DELETE SET NULL,
  new_appointment_id  UUID                 REFERENCES public.appointments(id) ON DELETE SET NULL,
  fill_attempts       INT         NOT NULL DEFAULT 0,
  staff_task_id       UUID                 REFERENCES public.copilot_tasks(id) ON DELETE SET NULL,

  filled_at           TIMESTAMPTZ,
  notes               TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_slot_openings_clinic_status ON public.slot_openings (clinic_id, status, slot_start ASC);
CREATE INDEX idx_slot_openings_appointment   ON public.slot_openings (appointment_id);

ALTER TABLE public.slot_openings ENABLE ROW LEVEL SECURITY;
