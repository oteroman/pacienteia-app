-- ─── Landing Leads ───────────────────────────────────────────────────────────
-- B2B SaaS leads captured from pacienteia.com (landing page footer form).
-- These are PacienteIA's own prospects, NOT clinic patient records.
-- Managed exclusively via service role (n8n, admin). No RLS SELECT for org users.
-- status progression: new → contacted → trialing → converted | cold

CREATE TABLE public.landing_leads (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT        NOT NULL,
  rubro        TEXT        NOT NULL
                           CHECK (rubro IN ('estetica','odontologia','psicologia','medicos')),
  status       TEXT        NOT NULL DEFAULT 'new'
                           CHECK (status IN ('new','contacted','trialing','converted','cold')),
  source       TEXT        NOT NULL DEFAULT 'landing_footer',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  contacted_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  metadata     JSONB       NOT NULL DEFAULT '{}'
);

-- Unique per email so n8n can upsert without duplicates
CREATE UNIQUE INDEX idx_landing_leads_email  ON public.landing_leads(email);
CREATE INDEX         idx_landing_leads_status ON public.landing_leads(status);
CREATE INDEX         idx_landing_leads_rubro  ON public.landing_leads(rubro);
CREATE INDEX         idx_landing_leads_ts     ON public.landing_leads(created_at DESC);

ALTER TABLE public.landing_leads ENABLE ROW LEVEL SECURITY;
-- No public policies — only accessible via service_role (n8n + admin actions)
