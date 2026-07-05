-- Google Business Profile connection per organization (one per org)
CREATE TABLE IF NOT EXISTS public.google_business_connections (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id       TEXT        NOT NULL,
  location_id      TEXT        NOT NULL,
  location_name    TEXT,
  refresh_token    TEXT        NOT NULL,
  access_token     TEXT,
  token_expires_at TIMESTAMPTZ,
  last_review_at   TIMESTAMPTZ,
  connected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

-- Processed reviews — prevents duplicate copilot_tasks if CRON runs twice
CREATE TABLE IF NOT EXISTS public.google_review_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL,
  review_id       TEXT        NOT NULL,
  rating          INT         NOT NULL CHECK (rating BETWEEN 1 AND 5),
  reviewer_name   TEXT,
  comment         TEXT,
  review_time     TIMESTAMPTZ NOT NULL,
  task_id         UUID        REFERENCES public.copilot_tasks(id),
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, review_id)
);

CREATE INDEX IF NOT EXISTS idx_google_review_events_org
  ON public.google_review_events (organization_id, review_time DESC);
