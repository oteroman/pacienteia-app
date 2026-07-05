-- ad_spend: registro manual de inversión publicitaria por período
CREATE TABLE IF NOT EXISTS public.ad_spend (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id       UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  spend_date      DATE NOT NULL,
  amount_soles    NUMERIC(10,2) NOT NULL CHECK (amount_soles > 0),
  source          TEXT NOT NULL DEFAULT 'facebook',  -- facebook | instagram | google | tiktok | other
  campaign_name   TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_spend_org_date ON public.ad_spend (organization_id, spend_date DESC);

ALTER TABLE public.ad_spend ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members manage ad spend"
  ON public.ad_spend FOR ALL
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

-- marketing_alerts: historial de alertas de fuga enviadas al dueño
CREATE TABLE IF NOT EXISTS public.marketing_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  alert_type      TEXT NOT NULL DEFAULT 'cpl_spike',  -- cpl_spike | low_conversion | combined
  cpl_current     NUMERIC(10,2),
  cpl_baseline    NUMERIC(10,2),
  conversion_rate NUMERIC(5,2),
  new_leads_count INTEGER,
  message_sent    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_alerts_org ON public.marketing_alerts (organization_id, created_at DESC);

ALTER TABLE public.marketing_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read marketing alerts"
  ON public.marketing_alerts FOR SELECT
  USING (is_org_member(organization_id));
