-- ─────────────────────────────────────────────────────────────
-- Platform admin roles and audit log
-- ─────────────────────────────────────────────────────────────

-- Global role on profiles (null = clinic user, no platform access)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS platform_role TEXT
  CHECK (platform_role IN ('superadmin', 'support'));

-- Platform action audit log (separate from intake_events / workflow_runs)
CREATE TABLE public.platform_audit_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID        NOT NULL,   -- platform admin user id
  actor_email  TEXT,                   -- denormalized for readability
  action_type  TEXT        NOT NULL,   -- extend_trial | suspend | reactivate | assign_plan | enter_tenant | exit_tenant
  clinic_id    UUID                 REFERENCES public.clinics(id) ON DELETE SET NULL,
  clinic_name  TEXT,                   -- denormalized
  details      JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_platform_audit_actor  ON public.platform_audit_log (actor_id, created_at DESC);
CREATE INDEX idx_platform_audit_clinic ON public.platform_audit_log (clinic_id, created_at DESC);

-- No RLS on platform tables — only accessible via admin client
ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;
