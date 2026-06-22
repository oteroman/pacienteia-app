-- Audit log for appointment-level actions
CREATE TABLE IF NOT EXISTS appointment_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  UUID        NOT NULL,
  organization_id UUID        NOT NULL,
  event_type      TEXT        NOT NULL,  -- created | status_changed | notes_updated | rescheduled | payment_received | cancelled
  details         JSONB       NOT NULL DEFAULT '{}',
  actor           TEXT        NOT NULL DEFAULT 'system',  -- user email or 'system'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX appointment_events_apt_idx ON appointment_events (appointment_id, created_at DESC);
CREATE INDEX appointment_events_org_idx ON appointment_events (organization_id, created_at DESC);

ALTER TABLE appointment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read appointment events"
  ON appointment_events FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "org members can insert appointment events"
  ON appointment_events FOR INSERT
  WITH CHECK (is_org_member(organization_id));
