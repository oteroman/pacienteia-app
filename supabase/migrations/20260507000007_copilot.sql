-- ─────────────────────────────────────────────────────────────
-- Copiloto Operativo — tablas base
--
-- interactions        : input crudo del staff (WhatsApp, audio, llamada, nota)
-- interaction_summaries: output del LLM (resumen + compromisos + riesgos)
-- copilot_tasks       : tareas generadas automáticamente (separadas de clinic_tasks de CS)
-- ─────────────────────────────────────────────────────────────

-- ── interactions ─────────────────────────────────────────────
CREATE TABLE public.interactions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  source_type   TEXT        NOT NULL
                            CHECK (source_type IN ('whatsapp_text', 'whatsapp_audio', 'phone_call', 'staff_note', 'chat')),
  raw_content   TEXT        NOT NULL,
  patient_id    UUID        REFERENCES public.patients(id) ON DELETE SET NULL,
  submitted_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interactions_clinic    ON public.interactions (clinic_id, created_at DESC);
CREATE INDEX idx_interactions_status   ON public.interactions (clinic_id, status);
CREATE INDEX idx_interactions_patient  ON public.interactions (clinic_id, patient_id)
  WHERE patient_id IS NOT NULL;

CREATE TRIGGER set_interactions_updated_at
  BEFORE UPDATE ON public.interactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── interaction_summaries ─────────────────────────────────────
CREATE TABLE public.interaction_summaries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id  UUID        NOT NULL REFERENCES public.interactions(id) ON DELETE CASCADE,
  clinic_id       UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  summary         TEXT        NOT NULL,
  commitments     JSONB       NOT NULL DEFAULT '[]',
  risks           JSONB       NOT NULL DEFAULT '[]',
  tasks_created   INT         NOT NULL DEFAULT 0,
  model_used      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_interaction_summaries_uniq ON public.interaction_summaries (interaction_id);
CREATE INDEX idx_interaction_summaries_clinic ON public.interaction_summaries (clinic_id);

-- ── copilot_tasks ─────────────────────────────────────────────
CREATE TABLE public.copilot_tasks (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id  UUID        NOT NULL REFERENCES public.interactions(id) ON DELETE CASCADE,
  clinic_id       UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id      UUID        REFERENCES public.patients(id) ON DELETE SET NULL,
  title           TEXT        NOT NULL,
  description     TEXT,
  priority        TEXT        NOT NULL DEFAULT 'medium'
                              CHECK (priority IN ('high', 'medium', 'low')),
  status          TEXT        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open', 'done', 'dismissed')),
  due_date        DATE,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_copilot_tasks_clinic      ON public.copilot_tasks (clinic_id, status);
CREATE INDEX idx_copilot_tasks_interaction ON public.copilot_tasks (interaction_id);
CREATE INDEX idx_copilot_tasks_patient     ON public.copilot_tasks (clinic_id, patient_id)
  WHERE patient_id IS NOT NULL;

CREATE TRIGGER set_copilot_tasks_updated_at
  BEFORE UPDATE ON public.copilot_tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── RLS — deny-all (accessed only via service-role from server) ──
ALTER TABLE public.interactions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interaction_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copilot_tasks        ENABLE ROW LEVEL SECURITY;
