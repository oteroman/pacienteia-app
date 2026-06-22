-- Sales prospects table for PacienteIA's own AI salesperson bot.
-- Platform-level data (no organization_id) — no RLS needed, admin client only.

CREATE TABLE IF NOT EXISTS sales_prospects (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  phone         TEXT        NOT NULL UNIQUE,
  contact_name  TEXT,
  clinic_name   TEXT,
  monthly_apts  TEXT,
  pain_point    TEXT,
  email         TEXT,
  status        TEXT        NOT NULL DEFAULT 'new'
                CHECK (status IN ('new','qualifying','demo_requested','converted','disqualified')),
  flow_step     TEXT        NOT NULL DEFAULT 'awaiting_name',
  flow_data     JSONB       NOT NULL DEFAULT '{}',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_prospects_status_idx ON sales_prospects(status);
CREATE INDEX IF NOT EXISTS sales_prospects_created_at_idx ON sales_prospects(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_sales_prospects_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_sales_prospects_updated_at ON sales_prospects;
CREATE TRIGGER trg_sales_prospects_updated_at
  BEFORE UPDATE ON sales_prospects
  FOR EACH ROW EXECUTE FUNCTION update_sales_prospects_updated_at();
