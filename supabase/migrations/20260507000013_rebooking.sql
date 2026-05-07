-- ─────────────────────────────────────────────────────────────
-- Appointment rebooking lifecycle tracking
-- One record per rebooking attempt; updated as outcome resolves.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE public.appointment_rebooking (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID        NOT NULL REFERENCES public.clinics(id)       ON DELETE CASCADE,
  appointment_id      UUID        NOT NULL REFERENCES public.appointments(id)  ON DELETE CASCADE,
  patient_id          UUID                 REFERENCES public.patients(id)      ON DELETE SET NULL,

  trigger_type        TEXT        NOT NULL
                                  CHECK (trigger_type IN (
                                    'cancelled',          -- patient explicitly cancelled
                                    'no_show',            -- didn't show up
                                    'no_response',        -- reminder sent, no reply within window
                                    'reschedule_request'  -- patient asked to change date
                                  )),
  previous_status     TEXT        NOT NULL,   -- appointment.status before the trigger
  rebook_reason       TEXT,                   -- free text: "paciente viaje", "emergencia", etc.

  channel             TEXT        NOT NULL DEFAULT 'task'
                                  CHECK (channel IN ('whatsapp', 'task', 'internal')),

  outcome             TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (outcome IN (
                                    'pending',    -- not yet resolved
                                    'rebooked',   -- new appointment was created / confirmed
                                    'lost',       -- patient won't rebook
                                    'escalated',  -- handed to staff
                                    'no_response' -- follow-up sent, still no reply
                                  )),

  staff_task_id       UUID                 REFERENCES public.copilot_tasks(id) ON DELETE SET NULL,
  new_appointment_id  UUID                 REFERENCES public.appointments(id)  ON DELETE SET NULL,

  whatsapp_message    TEXT,                   -- pre-built message sent/to-send
  patient_response    TEXT,                   -- raw patient reply if any
  resolved_at         TIMESTAMPTZ,
  notes               TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookups for the dashboard
CREATE INDEX idx_rebooking_clinic_outcome   ON public.appointment_rebooking (clinic_id, outcome, created_at DESC);
CREATE INDEX idx_rebooking_appointment      ON public.appointment_rebooking (appointment_id);

-- Prevent duplicate pending rebookings for the same appointment
CREATE UNIQUE INDEX idx_rebooking_appointment_pending
  ON public.appointment_rebooking (appointment_id)
  WHERE outcome = 'pending';

ALTER TABLE public.appointment_rebooking ENABLE ROW LEVEL SECURITY;
