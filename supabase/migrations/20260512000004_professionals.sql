-- Professionals: first-class entity for doctors/therapists per branch
CREATE TABLE IF NOT EXISTS public.professionals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id        UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  specialty        TEXT,
  color            TEXT NOT NULL DEFAULT '#6366f1',
  is_active        BOOLEAN NOT NULL DEFAULT true,
  user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS professionals_org_branch_idx
  ON public.professionals(organization_id, branch_id);

-- Link appointments to professionals (nullable — existing rows unaffected)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS professional_id UUID
    REFERENCES public.professionals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS appointments_professional_idx
  ON public.appointments(professional_id);

-- Link doctor_schedules to professionals (keep doctor_name for backward compat)
ALTER TABLE public.doctor_schedules
  ADD COLUMN IF NOT EXISTS professional_id UUID
    REFERENCES public.professionals(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can read professionals"   ON public.professionals;
DROP POLICY IF EXISTS "org members can manage professionals" ON public.professionals;

CREATE POLICY "org members can read professionals"
  ON public.professionals FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "org members can manage professionals"
  ON public.professionals FOR ALL
  USING (is_org_member(organization_id));
