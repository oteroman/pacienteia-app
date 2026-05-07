-- ─────────────────────────────────────────────────────────────
-- Unified Omnichannel Intake
--
-- intakes: single model for all inbound contact points
--   whatsapp | instagram | facebook | call | webform | manual
-- ─────────────────────────────────────────────────────────────

CREATE TABLE public.intakes (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,

  -- Channel origin
  source_channel      TEXT        NOT NULL
                                  CHECK (source_channel IN
                                    ('whatsapp', 'instagram', 'facebook', 'call', 'webform', 'manual')),
  external_id         TEXT,       -- Meta message_id, form submission uuid, etc.

  -- Contact info (may not map to a patient yet)
  contact_name        TEXT,
  contact_phone       TEXT,
  contact_email       TEXT,

  -- Content
  raw_content         TEXT        NOT NULL,
  normalized_summary  TEXT,
  detected_intent     TEXT
                                  CHECK (detected_intent IN
                                    ('lead_inquiry', 'appointment_request', 'followup', 'urgent', 'general')),

  -- Routing
  priority            TEXT        NOT NULL DEFAULT 'medium'
                                  CHECK (priority IN ('high', 'medium', 'low')),
  status              TEXT        NOT NULL DEFAULT 'new'
                                  CHECK (status IN ('new', 'in_progress', 'resolved', 'dismissed')),
  assigned_to         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Links to existing entities
  patient_id          UUID        REFERENCES public.patients(id) ON DELETE SET NULL,

  -- Channel-specific metadata (phone numbers, thread IDs, form field values, etc.)
  metadata            JSONB       NOT NULL DEFAULT '{}',

  tasks_created       INT         NOT NULL DEFAULT 0,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at         TIMESTAMPTZ
);

CREATE INDEX idx_intakes_clinic_status   ON public.intakes (clinic_id, status, created_at DESC);
CREATE INDEX idx_intakes_clinic_priority ON public.intakes (clinic_id, priority, created_at DESC);
CREATE INDEX idx_intakes_external        ON public.intakes (source_channel, external_id)
  WHERE external_id IS NOT NULL;
CREATE INDEX idx_intakes_patient         ON public.intakes (clinic_id, patient_id)
  WHERE patient_id IS NOT NULL;

CREATE TRIGGER set_intakes_updated_at
  BEFORE UPDATE ON public.intakes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS — deny-all (accessed only via service-role from server)
ALTER TABLE public.intakes ENABLE ROW LEVEL SECURITY;
