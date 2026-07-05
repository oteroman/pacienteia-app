-- doctor_schedules: weekly recurring availability per professional
CREATE TABLE IF NOT EXISTS public.doctor_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id       UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  doctor_name     TEXT NOT NULL,
  day_of_week     INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.doctor_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedules: org member all" ON public.doctor_schedules
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE INDEX idx_doctor_schedules_org ON public.doctor_schedules(organization_id, branch_id);

-- schedule_blocks: one-time date blocks (holidays, vacations, meetings)
CREATE TABLE IF NOT EXISTS public.schedule_blocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id       UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  block_date      DATE NOT NULL,
  start_time      TIME,
  end_time        TIME,
  reason          TEXT,
  block_type      TEXT NOT NULL DEFAULT 'other' CHECK (block_type IN ('holiday', 'vacation', 'meeting', 'other')),
  doctor_name     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocks: org member all" ON public.schedule_blocks
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE INDEX idx_schedule_blocks_org ON public.schedule_blocks(organization_id, branch_id, block_date);
