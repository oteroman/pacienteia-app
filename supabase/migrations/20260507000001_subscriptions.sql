-- ============================================================
-- PacienteIA — Subscription & Plan Gating
-- Adds commercial plan tracking to clinics + monthly usage
-- ============================================================

-- ─────────────────────────────────────────
-- 1. Extend clinics with subscription fields
-- ─────────────────────────────────────────

ALTER TABLE public.clinics
  ADD COLUMN plan                  TEXT        NOT NULL DEFAULT 'trial'
    CHECK (plan IN ('trial', 'basic', 'pro', 'premium')),
  ADD COLUMN subscription_status   TEXT        NOT NULL DEFAULT 'trialing'
    CHECK (subscription_status IN ('trialing', 'active', 'overdue', 'cancelled')),
  ADD COLUMN trial_ends_at         TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '14 days',
  ADD COLUMN current_period_start  TIMESTAMPTZ,
  ADD COLUMN current_period_end    TIMESTAMPTZ,
  ADD COLUMN billing_email         TEXT,
  -- ticket_avg: clinic's average treatment price in S/ — used for ROI calculations
  ADD COLUMN ticket_avg            NUMERIC(10,2) NOT NULL DEFAULT 350;

-- All existing clinics start on trial
UPDATE public.clinics
  SET plan               = 'trial',
      subscription_status = 'trialing',
      trial_ends_at       = NOW() + INTERVAL '14 days'
  WHERE plan = 'trial';  -- already defaulted, this is explicit

-- ─────────────────────────────────────────
-- 2. Monthly usage counters per clinic
-- ─────────────────────────────────────────

CREATE TABLE public.subscription_usage (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id            UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  period_start         DATE        NOT NULL,  -- always first day of month, e.g. '2026-05-01'
  leads_count          INT         NOT NULL DEFAULT 0,
  appointments_count   INT         NOT NULL DEFAULT 0,
  active_users         INT         NOT NULL DEFAULT 0,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (clinic_id, period_start)
);

CREATE INDEX idx_subscription_usage_clinic ON public.subscription_usage (clinic_id, period_start);

-- ─────────────────────────────────────────
-- 3. Atomic increment RPC for usage counters
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_usage(
  p_clinic_id    UUID,
  p_period_start DATE,
  p_field        TEXT  -- 'leads_count' | 'appointments_count'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.subscription_usage (clinic_id, period_start, leads_count, appointments_count)
  VALUES (
    p_clinic_id,
    p_period_start,
    CASE WHEN p_field = 'leads_count'        THEN 1 ELSE 0 END,
    CASE WHEN p_field = 'appointments_count' THEN 1 ELSE 0 END
  )
  ON CONFLICT (clinic_id, period_start)
  DO UPDATE SET
    leads_count        = subscription_usage.leads_count +
      CASE WHEN p_field = 'leads_count'        THEN 1 ELSE 0 END,
    appointments_count = subscription_usage.appointments_count +
      CASE WHEN p_field = 'appointments_count' THEN 1 ELSE 0 END,
    updated_at         = NOW();
END;
$$;

-- ─────────────────────────────────────────
-- 4. RLS for subscription_usage
-- ─────────────────────────────────────────

ALTER TABLE public.subscription_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_usage: member select"
  ON public.subscription_usage FOR SELECT
  USING (public.is_clinic_member(clinic_id));

-- Only the system (service role) writes usage; app uses the RPC above
CREATE POLICY "subscription_usage: owner update"
  ON public.subscription_usage FOR UPDATE
  USING (public.has_clinic_role(clinic_id, 'owner'));

-- ─────────────────────────────────────────
-- 5. Updated_at trigger for subscription_usage
-- ─────────────────────────────────────────

CREATE TRIGGER set_subscription_usage_updated_at
  BEFORE UPDATE ON public.subscription_usage
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
