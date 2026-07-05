-- Social media connections per organization.
-- 'facebook' covers both Facebook Messenger + Instagram DMs (same Meta OAuth/Page token).
-- 'tiktok' is separate. Instagram account ID is stored alongside the Facebook connection.

CREATE TABLE IF NOT EXISTS public.social_connections (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id             UUID        REFERENCES public.branches(id) ON DELETE SET NULL,
  platform              TEXT        NOT NULL CHECK (platform IN ('facebook', 'tiktok')),
  -- Facebook / Instagram (single Meta connection covers both)
  page_id               TEXT,
  page_name             TEXT,
  instagram_account_id  TEXT,
  -- TikTok
  tiktok_advertiser_id  TEXT,
  -- Auth
  access_token          TEXT        NOT NULL,
  token_expires_at      TIMESTAMPTZ,
  -- UI metadata
  profile_name          TEXT,
  -- State
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  connected_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata              JSONB       NOT NULL DEFAULT '{}',
  UNIQUE (organization_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_social_connections_org
  ON public.social_connections (organization_id);

CREATE INDEX IF NOT EXISTS idx_social_connections_page
  ON public.social_connections (page_id) WHERE page_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_connections_ig
  ON public.social_connections (instagram_account_id) WHERE instagram_account_id IS NOT NULL;

ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read social_connections"
  ON public.social_connections FOR SELECT
  USING (public.is_org_member(organization_id));
