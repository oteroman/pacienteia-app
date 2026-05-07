-- ─────────────────────────────────────────────────────────────
-- Clinic Profile — brand settings for response assistance
-- 1:1 with clinics, created on first save (upsert pattern)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE public.clinic_profiles (
  clinic_id         UUID        PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,

  -- Brand identity
  brand_name        TEXT,                         -- display name used in responses
  brand_tone        TEXT        NOT NULL DEFAULT 'professional'
                                CHECK (brand_tone IN ('casual', 'professional', 'formal', 'warm')),
  brand_tone_notes  TEXT,                         -- extra style guidance for LLM

  -- Response defaults
  default_signature TEXT,                         -- e.g. "El equipo de Clínica Bella"
  response_opener   TEXT,                         -- override default "Hola [nombre],"

  -- Contact info for auto-fill
  whatsapp          TEXT,
  phone             TEXT,
  address           TEXT,
  business_hours    TEXT,                         -- free text, e.g. "Lun-Vie 9-19h, Sáb 9-14h"
  website           TEXT,
  instagram_handle  TEXT,

  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No RLS — accessed via service-role same as intakes/copilot tables
ALTER TABLE public.clinic_profiles ENABLE ROW LEVEL SECURITY;
