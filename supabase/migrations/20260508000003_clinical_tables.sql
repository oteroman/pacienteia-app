-- ══════════════════════════════════════════════════════════════════════════
-- PacienteIA — Clinical tables v2
--
-- organization_id is the tenant isolation key on every table.
-- branch_id is operational context (where the activity happened).
-- Patients belong to organization, NOT to branch.
--
-- SUPERADMIN ACCESS POLICY: None of these tables have superadmin policies.
-- Superadmin cannot query patients, appointments, encounters, lead_events,
-- workflow_runs, metrics_daily, subscription_usage, or gating_events.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Patients ─────────────────────────────────────────────────────────────
-- Belongs to organization. Can be seen/treated at multiple branches.
-- custom_data holds industry-specific fields (defined in industry_configs).
CREATE TABLE public.patients (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name       TEXT        NOT NULL,
  phone           TEXT,
  email           TEXT,
  dni             TEXT,
  status          TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','inactive','lead','blocked')),
  on_waitlist     BOOLEAN     NOT NULL DEFAULT FALSE,
  last_visit_date DATE,
  notes           TEXT,
  tags            TEXT[]      NOT NULL DEFAULT '{}',
  custom_data     JSONB       NOT NULL DEFAULT '{}',
  metadata        JSONB       NOT NULL DEFAULT '{}',
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patients_org    ON public.patients(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_patients_status ON public.patients(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_patients_phone  ON public.patients(organization_id, phone) WHERE phone IS NOT NULL;

CREATE TRIGGER set_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── Encounters ───────────────────────────────────────────────────────────
-- Branch-level visit context without duplicating patient ownership.
-- Phase 2: evolve into full clinical encounter with files, diagnoses, etc.
CREATE TABLE public.encounters (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id       UUID        NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  patient_id      UUID        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  last_visit_date DATE,
  notes           TEXT,
  custom_data     JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, patient_id)
);

CREATE INDEX idx_encounters_patient ON public.encounters(patient_id);
CREATE INDEX idx_encounters_branch  ON public.encounters(branch_id);
CREATE INDEX idx_encounters_org     ON public.encounters(organization_id);

CREATE TRIGGER set_encounters_updated_at
  BEFORE UPDATE ON public.encounters
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── Appointments ─────────────────────────────────────────────────────────
-- organization_id = tenant isolation. branch_id = where it happens.
-- custom_data holds industry-specific appointment fields.
CREATE TABLE public.appointments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id         UUID        NOT NULL REFERENCES public.branches(id),
  patient_id        UUID        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  assigned_staff_id UUID        REFERENCES auth.users(id),
  treatment_type    TEXT        NOT NULL,
  scheduled_at      TIMESTAMPTZ NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'scheduled'
                                CHECK (status IN ('scheduled','confirmed','completed','cancelled','no_show')),
  notes             TEXT,
  price             NUMERIC(10,2),
  custom_data       JSONB       NOT NULL DEFAULT '{}',
  metadata          JSONB       NOT NULL DEFAULT '{}',
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_appointments_org     ON public.appointments(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_appointments_branch  ON public.appointments(branch_id, scheduled_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX idx_appointments_status  ON public.appointments(branch_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_appointments_today   ON public.appointments(branch_id, scheduled_at)
  WHERE status IN ('scheduled','confirmed') AND deleted_at IS NULL;

CREATE TRIGGER set_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── Lead Events ──────────────────────────────────────────────────────────
CREATE TABLE public.lead_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id       UUID        REFERENCES public.branches(id),
  patient_id      UUID        REFERENCES public.patients(id),
  event_type      TEXT        NOT NULL,
  source          TEXT,
  payload         JSONB       NOT NULL DEFAULT '{}',
  processed       BOOLEAN     NOT NULL DEFAULT FALSE,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_events_org    ON public.lead_events(organization_id);
CREATE INDEX idx_lead_events_branch ON public.lead_events(branch_id) WHERE branch_id IS NOT NULL;

-- ─── Workflow Runs ────────────────────────────────────────────────────────
CREATE TABLE public.workflow_runs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id       UUID        REFERENCES public.branches(id),
  event_type      TEXT        NOT NULL,
  entity_type     TEXT,
  entity_id       UUID,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','running','success','failed')),
  payload         JSONB       NOT NULL DEFAULT '{}',
  result          JSONB,
  error           TEXT,
  triggered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_workflow_runs_org    ON public.workflow_runs(organization_id, triggered_at DESC);
CREATE INDEX idx_workflow_runs_branch ON public.workflow_runs(branch_id, triggered_at DESC) WHERE branch_id IS NOT NULL;
CREATE INDEX idx_workflow_runs_entity ON public.workflow_runs(entity_type, entity_id) WHERE entity_id IS NOT NULL;

-- ─── Metrics Daily ────────────────────────────────────────────────────────
CREATE TABLE public.metrics_daily (
  id                           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id              UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id                    UUID        NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  date                         DATE        NOT NULL,
  appointments_scheduled       INT         NOT NULL DEFAULT 0,
  appointments_confirmed       INT         NOT NULL DEFAULT 0,
  appointments_completed       INT         NOT NULL DEFAULT 0,
  appointments_cancelled       INT         NOT NULL DEFAULT 0,
  appointments_no_show         INT         NOT NULL DEFAULT 0,
  new_patients                 INT         NOT NULL DEFAULT 0,
  reactivated_patients         INT         NOT NULL DEFAULT 0,
  leads_captured               INT         NOT NULL DEFAULT 0,
  estimated_revenue_recovered  NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, date)
);

CREATE INDEX idx_metrics_org    ON public.metrics_daily(organization_id, date DESC);
CREATE INDEX idx_metrics_branch ON public.metrics_daily(branch_id, date DESC);

CREATE TRIGGER set_metrics_updated_at
  BEFORE UPDATE ON public.metrics_daily
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── Subscription Usage ───────────────────────────────────────────────────
-- Scoped to organization (not branch) — plan limits apply org-wide.
CREATE TABLE public.subscription_usage (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID    NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start       DATE    NOT NULL,
  leads_count        INT     NOT NULL DEFAULT 0,
  appointments_count INT     NOT NULL DEFAULT 0,
  active_users       INT     NOT NULL DEFAULT 0,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, period_start)
);

CREATE INDEX idx_sub_usage_org ON public.subscription_usage(organization_id, period_start DESC);

CREATE TRIGGER set_sub_usage_updated_at
  BEFORE UPDATE ON public.subscription_usage
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Atomic upsert helper for n8n and Server Actions
CREATE OR REPLACE FUNCTION public.increment_usage(
  p_organization_id UUID,
  p_period_start    DATE,
  p_field           TEXT   -- 'leads_count' | 'appointments_count'
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.subscription_usage (organization_id, period_start, leads_count, appointments_count)
  VALUES (
    p_organization_id, p_period_start,
    CASE WHEN p_field = 'leads_count'        THEN 1 ELSE 0 END,
    CASE WHEN p_field = 'appointments_count' THEN 1 ELSE 0 END
  )
  ON CONFLICT (organization_id, period_start) DO UPDATE SET
    leads_count        = subscription_usage.leads_count +
      CASE WHEN p_field = 'leads_count'        THEN 1 ELSE 0 END,
    appointments_count = subscription_usage.appointments_count +
      CASE WHEN p_field = 'appointments_count' THEN 1 ELSE 0 END,
    updated_at         = NOW();
END;
$$;

-- ─── Gating Events ────────────────────────────────────────────────────────
CREATE TABLE public.gating_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id       UUID        REFERENCES public.branches(id),
  user_id         UUID,
  event           TEXT        NOT NULL,
  resource        TEXT,
  gate_state      TEXT,
  operation       TEXT,
  source_page     TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gating_org      ON public.gating_events(organization_id, created_at DESC);
CREATE INDEX idx_gating_event    ON public.gating_events(event, created_at DESC);
CREATE INDEX idx_gating_resource ON public.gating_events(resource, gate_state, created_at DESC);

-- ─── Reactivation Campaigns ───────────────────────────────────────────────
CREATE TABLE public.reactivation_campaigns (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id       UUID        REFERENCES public.branches(id),
  patient_id      UUID        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  step            INT         NOT NULL DEFAULT 1 CHECK (step IN (1,2)),
  status          TEXT        NOT NULL DEFAULT 'sent'
                              CHECK (status IN ('sent','responded','scheduled','ignored')),
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at    TIMESTAMPTZ,
  scheduled_at    TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, patient_id, step)
);

CREATE INDEX idx_reactivation_org     ON public.reactivation_campaigns(organization_id, sent_at DESC);
CREATE INDEX idx_reactivation_patient ON public.reactivation_campaigns(patient_id);

-- ─── Patient Feedback ─────────────────────────────────────────────────────
CREATE TABLE public.patient_feedback (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id       UUID        NOT NULL REFERENCES public.branches(id),
  patient_id      UUID        REFERENCES public.patients(id) ON DELETE SET NULL,
  appointment_id  UUID        REFERENCES public.appointments(id) ON DELETE SET NULL,
  rating          INT         CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT,
  channel         TEXT        NOT NULL DEFAULT 'whatsapp',
  sentiment       TEXT        CHECK (sentiment IN ('positive','neutral','negative')),
  is_public       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedback_org    ON public.patient_feedback(organization_id, created_at DESC);
CREATE INDEX idx_feedback_branch ON public.patient_feedback(branch_id, created_at DESC);

-- ─── RLS — all clinical tables ────────────────────────────────────────────
-- SUPERADMIN has NO access to any of these tables.
-- All access is through org_member status only.

ALTER TABLE public.patients             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounters           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_runs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics_daily        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gating_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactivation_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_feedback     ENABLE ROW LEVEL SECURITY;

-- patients: all org members read; staff+ write; admin+ delete
CREATE POLICY "patients: org select"
  ON public.patients FOR SELECT
  USING (is_org_member(organization_id) AND deleted_at IS NULL);
CREATE POLICY "patients: org insert"
  ON public.patients FOR INSERT
  WITH CHECK (is_org_member(organization_id));
CREATE POLICY "patients: org update"
  ON public.patients FOR UPDATE
  USING (is_org_member(organization_id));
CREATE POLICY "patients: admin delete"
  ON public.patients FOR DELETE
  USING (get_user_org_role(organization_id) IN ('owner','admin'));

-- encounters: branch-scoped
CREATE POLICY "encounters: branch select"
  ON public.encounters FOR SELECT
  USING (can_access_branch(organization_id, branch_id));
CREATE POLICY "encounters: branch insert"
  ON public.encounters FOR INSERT
  WITH CHECK (can_access_branch(organization_id, branch_id));
CREATE POLICY "encounters: branch update"
  ON public.encounters FOR UPDATE
  USING (can_access_branch(organization_id, branch_id));

-- appointments: branch-scoped
CREATE POLICY "appointments: branch select"
  ON public.appointments FOR SELECT
  USING (can_access_branch(organization_id, branch_id) AND deleted_at IS NULL);
CREATE POLICY "appointments: branch insert"
  ON public.appointments FOR INSERT
  WITH CHECK (can_access_branch(organization_id, branch_id));
CREATE POLICY "appointments: branch update"
  ON public.appointments FOR UPDATE
  USING (can_access_branch(organization_id, branch_id));
CREATE POLICY "appointments: admin delete"
  ON public.appointments FOR DELETE
  USING (get_user_org_role(organization_id) IN ('owner','admin'));

-- lead_events: org-scoped
CREATE POLICY "lead_events: org select"
  ON public.lead_events FOR SELECT
  USING (is_org_member(organization_id));
CREATE POLICY "lead_events: org insert"
  ON public.lead_events FOR INSERT
  WITH CHECK (is_org_member(organization_id));

-- workflow_runs: org-scoped read-only for members
CREATE POLICY "workflow_runs: org select"
  ON public.workflow_runs FOR SELECT
  USING (is_org_member(organization_id));

-- metrics_daily: branch-scoped
CREATE POLICY "metrics_daily: branch select"
  ON public.metrics_daily FOR SELECT
  USING (can_access_branch(organization_id, branch_id));

-- subscription_usage: org-scoped
CREATE POLICY "subscription_usage: org select"
  ON public.subscription_usage FOR SELECT
  USING (is_org_member(organization_id));

-- gating_events: org-scoped
CREATE POLICY "gating_events: org select"
  ON public.gating_events FOR SELECT
  USING (is_org_member(organization_id));
CREATE POLICY "gating_events: org insert"
  ON public.gating_events FOR INSERT
  WITH CHECK (is_org_member(organization_id));

-- reactivation_campaigns: org-scoped
CREATE POLICY "reactivation: org select"
  ON public.reactivation_campaigns FOR SELECT
  USING (is_org_member(organization_id));
CREATE POLICY "reactivation: org insert"
  ON public.reactivation_campaigns FOR INSERT
  WITH CHECK (is_org_member(organization_id));
CREATE POLICY "reactivation: org update"
  ON public.reactivation_campaigns FOR UPDATE
  USING (is_org_member(organization_id));

-- patient_feedback: branch-scoped
CREATE POLICY "feedback: branch select"
  ON public.patient_feedback FOR SELECT
  USING (can_access_branch(organization_id, branch_id));
CREATE POLICY "feedback: branch insert"
  ON public.patient_feedback FOR INSERT
  WITH CHECK (can_access_branch(organization_id, branch_id));

COMMIT;
