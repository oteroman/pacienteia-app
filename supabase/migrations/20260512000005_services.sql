-- Services / treatments catalog per branch
CREATE TABLE IF NOT EXISTS public.services (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id        UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  price            NUMERIC(10,2),
  duration_min     INTEGER,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS services_org_branch_idx
  ON public.services(organization_id, branch_id);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can read services"   ON public.services;
DROP POLICY IF EXISTS "org members can manage services" ON public.services;

CREATE POLICY "org members can read services"
  ON public.services FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "org members can manage services"
  ON public.services FOR ALL
  USING (is_org_member(organization_id));
