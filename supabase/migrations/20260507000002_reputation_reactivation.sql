-- ============================================================
-- PacienteIA — Semana 3: Reactivación Pro + Escudo de Reputación
-- ============================================================

-- ─────────────────────────────────────────
-- 1. Campañas de reactivación de pacientes
-- ─────────────────────────────────────────

CREATE TABLE public.reactivation_campaigns (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id    UUID        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  -- step 1: primer mensaje, step 2: incentivo/descuento
  step          INT         NOT NULL DEFAULT 1 CHECK (step IN (1, 2)),
  status        TEXT        NOT NULL DEFAULT 'sent'
                            CHECK (status IN ('sent', 'responded', 'scheduled', 'ignored')),
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at  TIMESTAMPTZ,
  scheduled_at  TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (clinic_id, patient_id, step)
);

CREATE INDEX idx_reactivation_clinic     ON public.reactivation_campaigns (clinic_id, sent_at);
CREATE INDEX idx_reactivation_patient    ON public.reactivation_campaigns (patient_id);
CREATE INDEX idx_reactivation_status     ON public.reactivation_campaigns (clinic_id, status, step);

-- ─────────────────────────────────────────
-- 2. Feedback post-visita (Escudo de Reputación)
-- ─────────────────────────────────────────

CREATE TABLE public.patient_feedback (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id          UUID        REFERENCES public.patients(id),
  appointment_id      UUID        REFERENCES public.appointments(id),
  score               INT         NOT NULL CHECK (score BETWEEN 1 AND 5),
  channel             TEXT        NOT NULL DEFAULT 'whatsapp',
  google_review_sent  BOOLEAN     NOT NULL DEFAULT FALSE,
  -- alert_sent: si se notificó internamente (score <= 3)
  alert_sent          BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedback_clinic      ON public.patient_feedback (clinic_id, created_at);
CREATE INDEX idx_feedback_patient     ON public.patient_feedback (patient_id);
CREATE INDEX idx_feedback_score       ON public.patient_feedback (clinic_id, score);

-- ─────────────────────────────────────────
-- 3. RLS
-- ─────────────────────────────────────────

ALTER TABLE public.reactivation_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_feedback       ENABLE ROW LEVEL SECURITY;

-- Reactivation: miembros leen, admins escriben
CREATE POLICY "reactivation: member select"
  ON public.reactivation_campaigns FOR SELECT
  USING (public.is_clinic_member(clinic_id));

CREATE POLICY "reactivation: admin insert"
  ON public.reactivation_campaigns FOR INSERT
  WITH CHECK (public.has_clinic_role(clinic_id, 'admin'));

CREATE POLICY "reactivation: admin update"
  ON public.reactivation_campaigns FOR UPDATE
  USING (public.has_clinic_role(clinic_id, 'admin'));

-- Feedback: miembros leen, service role escribe (via webhook)
CREATE POLICY "feedback: member select"
  ON public.patient_feedback FOR SELECT
  USING (public.is_clinic_member(clinic_id));

CREATE POLICY "feedback: admin insert"
  ON public.patient_feedback FOR INSERT
  WITH CHECK (public.has_clinic_role(clinic_id, 'admin'));

-- ─────────────────────────────────────────
-- 4. Agregar google_profile_url a clinics
--    para que n8n incluya el link real en el mensaje
-- ─────────────────────────────────────────

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS google_profile_url TEXT;
