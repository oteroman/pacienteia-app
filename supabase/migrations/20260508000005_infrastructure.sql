-- ══════════════════════════════════════════════════════════════════════════
-- PacienteIA — Infrastructure tables
-- WhatsApp config, audit logs, webhook queue, Gemini rate limiting,
-- invitations, platform audit.
--
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- SUPERADMIN ACCESS POLICY:
--   branch_whatsapp_config  → superadmin reads status/phone_number_id/waba_id
--                             via service role. NEVER access_token_enc.
--   whatsapp_connection_logs → superadmin reads for support diagnostics.
--   platform_audit_log       → superadmin reads own actions.
--   tenant_audit_log         → NO superadmin access (clinical context).
--   webhook_queue            → service role only (n8n + Next.js API).
--   gemini_usage             → service role only.
--   org_invitations          → org members read; service role for accept.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Branch WhatsApp Config ───────────────────────────────────────────────
-- phone_number_id is the authoritative routing key from Meta payloads.
-- access_token_enc: encrypted at application layer before INSERT.
-- Supuesto: AES-256 encryption in Server Action before storing.
-- Phase 2: migrate to Supabase Vault when available in project.
CREATE TABLE public.branch_whatsapp_config (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id           UUID        NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  organization_id     UUID        NOT NULL REFERENCES public.organizations(id),
  -- Routing key: Meta sends phone_number_id in every webhook payload
  phone_number_id     TEXT        NOT NULL UNIQUE,
  waba_id             TEXT        NOT NULL,
  -- Stored AES-encrypted; decrypted only in Server Action, never sent to client
  access_token_enc    TEXT        NOT NULL,
  -- Unique key used in n8n webhook URL path for routing
  webhook_routing_key TEXT        NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  display_name        TEXT,
  status              TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','active','error','revoked')),
  connected_at        TIMESTAMPTZ,
  last_verified_at    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wa_config_branch ON public.branch_whatsapp_config(branch_id);
CREATE INDEX idx_wa_config_org    ON public.branch_whatsapp_config(organization_id);

CREATE TRIGGER set_wa_config_updated_at
  BEFORE UPDATE ON public.branch_whatsapp_config
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── WhatsApp Connection Logs ─────────────────────────────────────────────
-- Tracks every connection event: errors, retries, revocations, verifications.
-- Used by superadmin support dashboard and branch-level diagnostics.
CREATE TABLE public.whatsapp_connection_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       UUID        NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES public.organizations(id),
  event_type      TEXT        NOT NULL
                              CHECK (event_type IN (
                                'connected','disconnected','error','retry',
                                'revoked','token_refreshed','verified'
                              )),
  details         JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wa_logs_branch ON public.whatsapp_connection_logs(branch_id, created_at DESC);
CREATE INDEX idx_wa_logs_org    ON public.whatsapp_connection_logs(organization_id, created_at DESC);

-- ─── Webhook Queue ────────────────────────────────────────────────────────
-- Decouples inbound WhatsApp messages from n8n processing.
-- Next.js /api/whatsapp/webhook writes here (fast, returns 200 immediately).
-- n8n polls pending rows, sets status to processing → done/failed.
-- Prevents message loss if n8n is temporarily down.
CREATE TABLE public.webhook_queue (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id),
  branch_id       UUID        NOT NULL REFERENCES public.branches(id),
  phone_number_id TEXT        NOT NULL,
  source          TEXT        NOT NULL DEFAULT 'whatsapp',
  payload         JSONB       NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','processing','done','failed')),
  attempts        INT         NOT NULL DEFAULT 0,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ
);

CREATE INDEX idx_wq_pending ON public.webhook_queue(status, created_at) WHERE status = 'pending';
CREATE INDEX idx_wq_org     ON public.webhook_queue(organization_id, created_at DESC);

-- ─── Org Invitations ──────────────────────────────────────────────────────
CREATE TABLE public.org_invitations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email           TEXT        NOT NULL,
  role            TEXT        NOT NULL CHECK (role IN ('admin','staff')),
  branch_scope    UUID[]      DEFAULT NULL,
  token           TEXT        NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', ''), '-', ''),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  accepted_at     TIMESTAMPTZ,
  created_by      UUID        NOT NULL REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invitations_org   ON public.org_invitations(organization_id);
CREATE INDEX idx_invitations_email ON public.org_invitations(email) WHERE accepted_at IS NULL;
CREATE INDEX idx_invitations_token ON public.org_invitations(token) WHERE accepted_at IS NULL;

-- ─── Tenant Audit Log ─────────────────────────────────────────────────────
-- Records actions by org users within their organization.
-- Superadmin has NO access to this table (clinical context).
CREATE TABLE public.tenant_audit_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id       UUID        REFERENCES public.branches(id),
  actor_id        UUID        NOT NULL REFERENCES auth.users(id),
  actor_email     TEXT,
  action_type     TEXT        NOT NULL,
  entity_type     TEXT,
  entity_id       UUID,
  details         JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenant_audit_org   ON public.tenant_audit_log(organization_id, created_at DESC);
CREATE INDEX idx_tenant_audit_actor ON public.tenant_audit_log(actor_id, created_at DESC);

-- ─── Platform Audit Log ───────────────────────────────────────────────────
-- Records superadmin actions on organizations (extend_trial, suspend, etc.).
-- No clinical data here — organization metadata only.
CREATE TABLE public.platform_audit_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id          UUID        NOT NULL REFERENCES auth.users(id),
  actor_email       TEXT,
  action_type       TEXT        NOT NULL,
  organization_id   UUID        REFERENCES public.organizations(id) ON DELETE SET NULL,
  organization_name TEXT,
  details           JSONB       NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_platform_audit_actor ON public.platform_audit_log(actor_id, created_at DESC);
CREATE INDEX idx_platform_audit_org   ON public.platform_audit_log(organization_id, created_at DESC);

-- ─── Gemini Usage (rate limiting) ────────────────────────────────────────
-- One row per (organization, UTC minute). Checked before every Gemini call.
-- Limit enforcement: if call_count >= 10 in current minute → queue or reject.
-- Supuesto: limit values are read from plan config, not hardcoded here.
CREATE TABLE public.gemini_usage (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  minute_bucket   TIMESTAMPTZ NOT NULL,  -- date_trunc('minute', NOW())
  call_count      INT         NOT NULL DEFAULT 1,
  tokens_used     INT         NOT NULL DEFAULT 0,
  UNIQUE (organization_id, minute_bucket)
);

CREATE INDEX idx_gemini_usage_org ON public.gemini_usage(organization_id, minute_bucket DESC);

-- RPC for atomic Gemini usage increment + limit check
-- Returns TRUE if call is allowed; FALSE if rate limit exceeded.
CREATE OR REPLACE FUNCTION public.check_and_increment_gemini(
  p_organization_id UUID,
  p_tokens          INT DEFAULT 0,
  p_limit           INT DEFAULT 10   -- calls per minute
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_bucket TIMESTAMPTZ := date_trunc('minute', NOW());
  v_count  INT;
BEGIN
  INSERT INTO public.gemini_usage (organization_id, minute_bucket, call_count, tokens_used)
  VALUES (p_organization_id, v_bucket, 1, p_tokens)
  ON CONFLICT (organization_id, minute_bucket) DO UPDATE
    SET call_count  = gemini_usage.call_count + 1,
        tokens_used = gemini_usage.tokens_used + p_tokens
  RETURNING call_count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;

-- ─── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.branch_whatsapp_config   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_connection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_queue            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_invitations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_audit_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_audit_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gemini_usage             ENABLE ROW LEVEL SECURITY;

-- WhatsApp config: org members see status/display_name (NOT access_token_enc via policy)
-- access_token_enc is only read via service role in Server Action
CREATE POLICY "wa_config: member select"
  ON public.branch_whatsapp_config FOR SELECT
  USING (is_org_member(organization_id));
CREATE POLICY "wa_config: owner/admin manage"
  ON public.branch_whatsapp_config FOR ALL
  USING (get_user_org_role(organization_id) IN ('owner','admin'));

-- WhatsApp logs: org members see their branch logs
CREATE POLICY "wa_logs: member select"
  ON public.whatsapp_connection_logs FOR SELECT
  USING (is_org_member(organization_id));

-- Webhook queue: service role only (no user-facing policy)

-- Invitations: owner/admin manage
CREATE POLICY "invitations: member select"
  ON public.org_invitations FOR SELECT
  USING (is_org_member(organization_id));
CREATE POLICY "invitations: owner/admin manage"
  ON public.org_invitations FOR ALL
  USING (get_user_org_role(organization_id) IN ('owner','admin'));

-- Tenant audit: org members read (owner/admin have full view)
CREATE POLICY "tenant_audit: member select"
  ON public.tenant_audit_log FOR SELECT
  USING (is_org_member(organization_id));

-- Platform audit: superadmin only via service role (no user-level policy)

-- Gemini usage: owner/admin read their org usage
CREATE POLICY "gemini_usage: owner/admin select"
  ON public.gemini_usage FOR SELECT
  USING (get_user_org_role(organization_id) IN ('owner','admin'));

COMMIT;
