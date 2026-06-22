-- ══════════════════════════════════════════════════════════════════════════
-- PacienteIA — Appointment Reminders tracking
--
-- Tracks every WhatsApp reminder sent (24h / 2h before appointment).
-- UNIQUE (appointment_id, reminder_type) prevents duplicate sends.
-- contact_phone stored normalized (E.164 digits, e.g. 51987654321)
-- so we can match inbound replies without joining through patients.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE public.appointment_reminders (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id       UUID        NOT NULL REFERENCES public.branches(id),
  appointment_id  UUID        NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id      UUID        REFERENCES public.patients(id) ON DELETE SET NULL,
  contact_phone   TEXT,
  reminder_type   TEXT        NOT NULL CHECK (reminder_type IN ('24h', '2h')),
  status          TEXT        NOT NULL DEFAULT 'sent'
                              CHECK (status IN ('sent', 'confirmed', 'reschedule_requested', 'failed')),
  wamid           TEXT,
  error_msg       TEXT,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at    TIMESTAMPTZ,
  UNIQUE (appointment_id, reminder_type)
);

CREATE INDEX idx_appt_reminders_org     ON public.appointment_reminders(organization_id, sent_at DESC);
CREATE INDEX idx_appt_reminders_phone   ON public.appointment_reminders(contact_phone, status)
  WHERE contact_phone IS NOT NULL;
CREATE INDEX idx_appt_reminders_patient ON public.appointment_reminders(patient_id, status)
  WHERE patient_id IS NOT NULL;

ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminders: org member select"
  ON public.appointment_reminders FOR SELECT
  USING (public.is_org_member(organization_id));

COMMIT;
