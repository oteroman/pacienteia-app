-- ============================================================
-- PacienteIA — Gating Events
-- One row per event. Aggregate at read time, not write time.
-- ============================================================

CREATE TABLE public.gating_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id     UUID,                     -- nullable for service-triggered events
  event       TEXT        NOT NULL,     -- blocked_action_attempted | modal_opened | ...
  resource    TEXT,                     -- leads | appointments | users
  gate_state  TEXT,                     -- soft_blocked | hard_blocked
  operation   TEXT,                     -- create | edit
  source_page TEXT,                     -- /leads | /patients | /appointments
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optimized for the most common analytics queries
CREATE INDEX idx_gating_events_clinic   ON public.gating_events (clinic_id, created_at DESC);
CREATE INDEX idx_gating_events_event    ON public.gating_events (event, created_at DESC);
CREATE INDEX idx_gating_events_resource ON public.gating_events (resource, gate_state, created_at DESC);

-- ─────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────

ALTER TABLE public.gating_events ENABLE ROW LEVEL SECURITY;

-- Clinic members read their own events (analytics page)
CREATE POLICY "gating_events: member select"
  ON public.gating_events FOR SELECT
  USING (public.is_clinic_member(clinic_id));

-- Authenticated clinic members write (via server action using session client)
CREATE POLICY "gating_events: member insert"
  ON public.gating_events FOR INSERT
  WITH CHECK (public.is_clinic_member(clinic_id));
