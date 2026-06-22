-- Platform-level social connections for PacienteIA's own pages (not per-tenant).
-- Used by the Paxi sales bot to receive and reply to Facebook/Instagram messages.
-- RLS disabled intentionally — admin client only, no policies = user client gets nothing.

CREATE TABLE IF NOT EXISTS public.platform_social_config (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  platform              TEXT        NOT NULL UNIQUE CHECK (platform IN ('facebook', 'tiktok')),
  page_id               TEXT,
  page_name             TEXT,
  instagram_account_id  TEXT,
  access_token          TEXT        NOT NULL,
  connected_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata              JSONB       NOT NULL DEFAULT '{}'
);

ALTER TABLE public.platform_social_config ENABLE ROW LEVEL SECURITY;
-- No public policies — service role only.
