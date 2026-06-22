-- Add persisted retention score columns to patients.
-- The score (0-100) is calculated by a weekly CRON and stored here so
-- the dashboard and patient list can filter/sort without recalculating.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS retention_score   SMALLINT,
  ADD COLUMN IF NOT EXISTS score_updated_at  TIMESTAMPTZ;

-- Index for dashboard query (at-risk patients: score < 40)
CREATE INDEX IF NOT EXISTS idx_patients_retention_score
  ON public.patients (organization_id, retention_score)
  WHERE retention_score IS NOT NULL AND deleted_at IS NULL;
