-- ─────────────────────────────────────────────────────────────
-- Reactivated patients per clinic (last 30 days)
--
-- Definition: a patient is "reactivated" when they have an
-- appointment in the last 30 days AND their most recent previous
-- appointment (before that 30-day window) was ≥ 90 days ago.
-- First-time patients (no prior appointment) are excluded.
--
-- Returns one row per clinic with ≥ 1 reactivated patient.
-- Aggregate-only — no patient PII leaves the function.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_reactivated_patients_30d()
RETURNS TABLE (clinic_id uuid, reactivated_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH w AS (
    SELECT
      NOW() - INTERVAL '30 days'  AS window_start,  -- start of "recently active" window
      NOW() - INTERVAL '90 days'  AS gap_cutoff      -- max allowed date for last prior appt
  ),
  -- Patients who had a non-cancelled appointment in the last 30 days
  recent_active AS (
    SELECT DISTINCT a.clinic_id, a.patient_id
    FROM appointments a
    CROSS JOIN w
    WHERE a.scheduled_at >= w.window_start
      AND a.status <> 'cancelled'
  ),
  -- For each recently-active patient, find their last appointment BEFORE the 30-day window
  last_prior_appt AS (
    SELECT a.clinic_id, a.patient_id, MAX(a.scheduled_at) AS last_seen
    FROM appointments a
    JOIN recent_active r USING (clinic_id, patient_id)
    CROSS JOIN w
    WHERE a.scheduled_at < w.window_start  -- strictly before the recent window
    GROUP BY a.clinic_id, a.patient_id
  )
  -- Count patients whose last prior appointment was beyond the 90-day gap
  SELECT p.clinic_id, COUNT(*)::bigint AS reactivated_count
  FROM last_prior_appt p
  CROSS JOIN w
  WHERE p.last_seen < w.gap_cutoff
  GROUP BY p.clinic_id
$$;
