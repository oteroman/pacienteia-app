-- ============================================================
-- PacienteIA — Initial Schema
-- Multi-tenant SaaS for aesthetic clinics
-- ============================================================

-- ─────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────

-- User profile linked to auth.users
CREATE TABLE public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  avatar_url  TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tenant / clinic organization
CREATE TABLE public.clinics (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        NOT NULL UNIQUE,
  logo_url    TEXT,
  phone       TEXT,
  address     TEXT,
  city        TEXT        NOT NULL DEFAULT 'Lima',
  country     TEXT        NOT NULL DEFAULT 'PE',
  settings    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User membership inside a clinic with role
CREATE TABLE public.clinic_members (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL CHECK (role IN ('owner', 'admin', 'staff')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (clinic_id, user_id)
);

-- Patients belonging to a clinic
CREATE TABLE public.patients (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  full_name       TEXT        NOT NULL,
  phone           TEXT,
  email           TEXT,
  dni             TEXT,
  status          TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'inactive', 'lead', 'blocked')),
  last_visit_date DATE,
  notes           TEXT,
  tags            TEXT[]      NOT NULL DEFAULT '{}',
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Appointments for a patient in a clinic
CREATE TABLE public.appointments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id        UUID        NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  assigned_staff_id UUID        REFERENCES auth.users(id),
  treatment_type    TEXT        NOT NULL,
  scheduled_at      TIMESTAMPTZ NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'scheduled'
                                CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes             TEXT,
  price             NUMERIC(10, 2),
  metadata          JSONB       NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Raw inbound lead events
CREATE TABLE public.lead_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id  UUID        REFERENCES public.patients(id),
  event_type  TEXT        NOT NULL,
  source      TEXT,
  payload     JSONB       NOT NULL DEFAULT '{}',
  processed   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Automation workflow execution records (written by n8n)
CREATE TABLE public.workflow_runs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  event_type   TEXT        NOT NULL,
  entity_type  TEXT,
  entity_id    UUID,
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'running', 'success', 'failed')),
  payload      JSONB       NOT NULL DEFAULT '{}',
  result       JSONB,
  error        TEXT,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Daily KPI snapshots per clinic
CREATE TABLE public.metrics_daily (
  id                           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id                    UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  date                         DATE        NOT NULL,
  appointments_scheduled       INT         NOT NULL DEFAULT 0,
  appointments_confirmed       INT         NOT NULL DEFAULT 0,
  appointments_completed       INT         NOT NULL DEFAULT 0,
  appointments_cancelled       INT         NOT NULL DEFAULT 0,
  appointments_no_show         INT         NOT NULL DEFAULT 0,
  new_patients                 INT         NOT NULL DEFAULT 0,
  reactivated_patients         INT         NOT NULL DEFAULT 0,
  leads_captured               INT         NOT NULL DEFAULT 0,
  estimated_revenue_recovered  NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (clinic_id, date)
);

-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────

CREATE INDEX idx_clinic_members_user_id   ON public.clinic_members (user_id);
CREATE INDEX idx_clinic_members_clinic_id ON public.clinic_members (clinic_id);
CREATE INDEX idx_patients_clinic_id       ON public.patients (clinic_id);
CREATE INDEX idx_patients_status          ON public.patients (clinic_id, status);
CREATE INDEX idx_appointments_clinic_id   ON public.appointments (clinic_id);
CREATE INDEX idx_appointments_patient_id  ON public.appointments (patient_id);
CREATE INDEX idx_appointments_scheduled   ON public.appointments (clinic_id, scheduled_at);
CREATE INDEX idx_appointments_status      ON public.appointments (clinic_id, status);
CREATE INDEX idx_lead_events_clinic_id    ON public.lead_events (clinic_id);
CREATE INDEX idx_workflow_runs_clinic_id  ON public.workflow_runs (clinic_id);
CREATE INDEX idx_workflow_runs_entity     ON public.workflow_runs (entity_type, entity_id);
CREATE INDEX idx_metrics_daily_clinic     ON public.metrics_daily (clinic_id, date);

-- ─────────────────────────────────────────
-- HELPER FUNCTIONS
-- ─────────────────────────────────────────

-- Returns true if the current user is a member of the given clinic
CREATE OR REPLACE FUNCTION public.is_clinic_member(p_clinic_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinic_members
    WHERE clinic_id = p_clinic_id
      AND user_id   = auth.uid()
  );
$$;

-- Returns true if the current user has the specified role (or higher) in the clinic
CREATE OR REPLACE FUNCTION public.has_clinic_role(p_clinic_id UUID, p_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinic_members
    WHERE clinic_id = p_clinic_id
      AND user_id   = auth.uid()
      AND CASE p_role
            WHEN 'staff' THEN role IN ('staff', 'admin', 'owner')
            WHEN 'admin' THEN role IN ('admin', 'owner')
            WHEN 'owner' THEN role = 'owner'
            ELSE FALSE
          END
  );
$$;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Auto-create profile when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_clinics_updated_at
  BEFORE UPDATE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_metrics_updated_at
  BEFORE UPDATE ON public.metrics_daily
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────

ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_runs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics_daily  ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles: own select"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profiles: own insert"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles: own update"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- clinics
CREATE POLICY "clinics: member select"
  ON public.clinics FOR SELECT
  USING (public.is_clinic_member(id));

CREATE POLICY "clinics: owner update"
  ON public.clinics FOR UPDATE
  USING (public.has_clinic_role(id, 'owner'));

-- clinic_members
CREATE POLICY "clinic_members: member select"
  ON public.clinic_members FOR SELECT
  USING (public.is_clinic_member(clinic_id));

CREATE POLICY "clinic_members: owner insert"
  ON public.clinic_members FOR INSERT
  WITH CHECK (public.has_clinic_role(clinic_id, 'owner'));

CREATE POLICY "clinic_members: owner delete"
  ON public.clinic_members FOR DELETE
  USING (public.has_clinic_role(clinic_id, 'owner'));

-- patients
CREATE POLICY "patients: member select"
  ON public.patients FOR SELECT
  USING (public.is_clinic_member(clinic_id));

CREATE POLICY "patients: staff insert"
  ON public.patients FOR INSERT
  WITH CHECK (public.has_clinic_role(clinic_id, 'staff'));

CREATE POLICY "patients: staff update"
  ON public.patients FOR UPDATE
  USING (public.has_clinic_role(clinic_id, 'staff'));

CREATE POLICY "patients: admin delete"
  ON public.patients FOR DELETE
  USING (public.has_clinic_role(clinic_id, 'admin'));

-- appointments
CREATE POLICY "appointments: member select"
  ON public.appointments FOR SELECT
  USING (public.is_clinic_member(clinic_id));

CREATE POLICY "appointments: staff insert"
  ON public.appointments FOR INSERT
  WITH CHECK (public.has_clinic_role(clinic_id, 'staff'));

CREATE POLICY "appointments: staff update"
  ON public.appointments FOR UPDATE
  USING (public.has_clinic_role(clinic_id, 'staff'));

CREATE POLICY "appointments: admin delete"
  ON public.appointments FOR DELETE
  USING (public.has_clinic_role(clinic_id, 'admin'));

-- lead_events
CREATE POLICY "lead_events: member select"
  ON public.lead_events FOR SELECT
  USING (public.is_clinic_member(clinic_id));

CREATE POLICY "lead_events: admin insert"
  ON public.lead_events FOR INSERT
  WITH CHECK (public.has_clinic_role(clinic_id, 'admin'));

-- workflow_runs
CREATE POLICY "workflow_runs: member select"
  ON public.workflow_runs FOR SELECT
  USING (public.is_clinic_member(clinic_id));

-- metrics_daily
CREATE POLICY "metrics_daily: member select"
  ON public.metrics_daily FOR SELECT
  USING (public.is_clinic_member(clinic_id));
