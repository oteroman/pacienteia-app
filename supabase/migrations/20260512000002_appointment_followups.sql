-- ══════════════════════════════════════════════════════════════════════════
-- PacienteIA — Seguimiento post-cita + Escudo de Reputación
--
-- appointment_followups: rastrea el mensaje de encuesta enviado tras cada
-- cita atendida. UNIQUE(appointment_id) garantiza un solo follow-up por cita.
-- contact_phone normalizado (E.164) para matching con respuestas inbound.
--
-- branch_whatsapp_config.google_review_url: URL del perfil Google Business
-- de la sucursal, se envía automáticamente a pacientes que califican 4-5.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Agregar URL de Google Reviews a la config de cada sucursal
ALTER TABLE public.branch_whatsapp_config
  ADD COLUMN IF NOT EXISTS google_review_url TEXT;

CREATE TABLE public.appointment_followups (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id       UUID        NOT NULL REFERENCES public.branches(id),
  appointment_id  UUID        NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id      UUID        REFERENCES public.patients(id) ON DELETE SET NULL,
  contact_phone   TEXT,
  -- Estado del ciclo
  status          TEXT        NOT NULL DEFAULT 'sent'
                              CHECK (status IN ('sent', 'responded', 'failed')),
  rating          SMALLINT    CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),
  review_link_sent BOOLEAN    NOT NULL DEFAULT false,
  alert_created   BOOLEAN     NOT NULL DEFAULT false,
  -- Trazabilidad
  wamid           TEXT,
  error_msg       TEXT,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at    TIMESTAMPTZ,
  UNIQUE (appointment_id)
);

CREATE INDEX idx_appt_followups_org     ON public.appointment_followups(organization_id, sent_at DESC);
CREATE INDEX idx_appt_followups_phone   ON public.appointment_followups(contact_phone, status)
  WHERE contact_phone IS NOT NULL;
CREATE INDEX idx_appt_followups_patient ON public.appointment_followups(patient_id, status)
  WHERE patient_id IS NOT NULL;

ALTER TABLE public.appointment_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "followups: org member select"
  ON public.appointment_followups FOR SELECT
  USING (public.is_org_member(organization_id));

COMMIT;
