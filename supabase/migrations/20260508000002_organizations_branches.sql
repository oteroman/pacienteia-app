-- ══════════════════════════════════════════════════════════════════════════
-- PacienteIA — Identity model v2: organizations + branches + org_members
--
-- SUPERADMIN ACCESS POLICY:
--   organizations      → superadmin can SELECT via service role (metadata only)
--   branches           → superadmin can SELECT via service role (metadata only)
--   org_members        → superadmin can SELECT via service role (to count users)
--   branch_whatsapp_config → superadmin can SELECT status/phone_number_id via service role
--                            NEVER access_token_enc
--   patients / appointments / conversations / messages / encounters
--                      → NO access for superadmin (no policy, no service role calls)
--
-- All superadmin reads happen in lib/platform/ using createAdminClient().
-- Dashboard pages use createClient() (user session) → RLS enforced.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Organizations ────────────────────────────────────────────────────────
CREATE TABLE public.organizations (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id        UUID        NOT NULL REFERENCES auth.users(id),
  name                 TEXT        NOT NULL,
  slug                 TEXT        NOT NULL UNIQUE,
  -- Industry drives field definitions, templates, prompts, and n8n workflows
  industry             TEXT        NOT NULL DEFAULT 'estetica'
                                   CHECK (industry IN ('estetica','dental','psicologia','medicina')),
  plan                 TEXT        NOT NULL DEFAULT 'trial'
                                   CHECK (plan IN ('trial','basic','pro','premium')),
  subscription_status  TEXT        NOT NULL DEFAULT 'trialing'
                                   CHECK (subscription_status IN ('trialing','active','overdue','cancelled')),
  trial_ends_at        TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '14 days',
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  billing_email        TEXT,
  ticket_avg           NUMERIC(10,2) NOT NULL DEFAULT 350,
  -- Onboarding state machine: enforced at app layer; stored here for resume
  onboarding_status    TEXT        NOT NULL DEFAULT 'email_verified'
                                   CHECK (onboarding_status IN (
                                     'email_verified',      -- OTP verified, account created
                                     'org_created',         -- organization record exists
                                     'branch_created',      -- at least one branch created
                                     'whatsapp_connected',  -- first branch WhatsApp active
                                     'first_flow_active'    -- n8n workflow registered
                                   )),
  settings             JSONB       NOT NULL DEFAULT '{}',
  deleted_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One user can own at most one organization (enforced at DB + app layer)
CREATE UNIQUE INDEX orgs_owner_unique ON public.organizations(owner_user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_orgs_status   ON public.organizations(subscription_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_orgs_industry ON public.organizations(industry);

CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── Branches ─────────────────────────────────────────────────────────────
-- Each branch = physical location + WhatsApp channel + operational context.
-- Patients belong to the organization, NOT to branches.
-- Branch is only an operational/routing context.
CREATE TABLE public.branches (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  slug            TEXT        NOT NULL,
  logo_url        TEXT,
  phone           TEXT,
  address         TEXT,
  city            TEXT        NOT NULL DEFAULT 'Lima',
  country         TEXT        NOT NULL DEFAULT 'PE',
  settings        JSONB       NOT NULL DEFAULT '{}',
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, slug)
);

CREATE INDEX idx_branches_org ON public.branches(organization_id) WHERE deleted_at IS NULL;

CREATE TRIGGER set_branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── Org Members ──────────────────────────────────────────────────────────
-- Roles: owner (one per org, auto-set on creation) | admin | staff
-- branch_scope NULL = access to all branches; [uuid,...] = limited branches
CREATE TABLE public.org_members (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL CHECK (role IN ('owner','admin','staff')),
  branch_scope    UUID[]      DEFAULT NULL,
  status          TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  invited_by      UUID        REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_org_members_user ON public.org_members(user_id, status);
CREATE INDEX idx_org_members_org  ON public.org_members(organization_id, status);

-- ─── RLS Helper Functions ─────────────────────────────────────────────────

-- Returns true if the calling user is an active member of the organization
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE organization_id = p_org_id
      AND user_id         = auth.uid()
      AND status          = 'active'
  );
$$;

-- Returns true if the calling user can access the given branch
-- (either has no branch_scope restriction, or the branch is in their scope)
CREATE OR REPLACE FUNCTION public.can_access_branch(p_org_id UUID, p_branch_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE organization_id = p_org_id
      AND user_id         = auth.uid()
      AND status          = 'active'
      AND (branch_scope IS NULL OR p_branch_id = ANY(branch_scope))
  );
$$;

-- Returns the calling user's role in the organization (null if not a member)
CREATE OR REPLACE FUNCTION public.get_user_org_role(p_org_id UUID)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM public.org_members
  WHERE organization_id = p_org_id
    AND user_id         = auth.uid()
    AND status          = 'active'
  LIMIT 1;
$$;

-- ─── RLS — Organizations ──────────────────────────────────────────────────
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Active members can read their org
CREATE POLICY "orgs: member select"
  ON public.organizations FOR SELECT
  USING (is_org_member(id) AND deleted_at IS NULL);

-- Only owner can update org settings
CREATE POLICY "orgs: owner update"
  ON public.organizations FOR UPDATE
  USING (owner_user_id = auth.uid());

-- INSERT and DELETE only via service role (createAdminClient in Server Actions)
-- Superadmin: reads via service role (no user-level policy needed)

-- ─── RLS — Branches ───────────────────────────────────────────────────────
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branches: member select"
  ON public.branches FOR SELECT
  USING (is_org_member(organization_id) AND deleted_at IS NULL);

CREATE POLICY "branches: owner/admin insert"
  ON public.branches FOR INSERT
  WITH CHECK (get_user_org_role(organization_id) IN ('owner','admin'));

CREATE POLICY "branches: owner/admin update"
  ON public.branches FOR UPDATE
  USING (get_user_org_role(organization_id) IN ('owner','admin'));

CREATE POLICY "branches: owner delete"
  ON public.branches FOR DELETE
  USING (get_user_org_role(organization_id) = 'owner');

-- ─── RLS — Org Members ────────────────────────────────────────────────────
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members: member select"
  ON public.org_members FOR SELECT
  USING (is_org_member(organization_id));

-- Owner manages all members; admin can manage staff (not owner, not other admins)
CREATE POLICY "org_members: owner all"
  ON public.org_members FOR ALL
  USING (get_user_org_role(organization_id) = 'owner');

CREATE POLICY "org_members: admin insert staff"
  ON public.org_members FOR INSERT
  WITH CHECK (
    get_user_org_role(organization_id) = 'admin'
    AND role = 'staff'
  );

-- ─── Organization Profile (1:1 brand settings) ───────────────────────────
-- Replaces clinic_profiles. Accessed via service role by copilot/intakes.
-- Superadmin: can read via service role for support context.
CREATE TABLE public.organization_profiles (
  organization_id   UUID        PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  brand_name        TEXT,
  brand_tone        TEXT        NOT NULL DEFAULT 'professional'
                                CHECK (brand_tone IN ('casual','professional','formal','warm')),
  brand_tone_notes  TEXT,
  default_signature TEXT,
  response_opener   TEXT,
  business_hours    TEXT,
  website           TEXT,
  instagram_handle  TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.organization_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_profiles: member select"
  ON public.organization_profiles FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "org_profiles: owner/admin update"
  ON public.organization_profiles FOR ALL
  USING (get_user_org_role(organization_id) IN ('owner','admin'));

COMMIT;
