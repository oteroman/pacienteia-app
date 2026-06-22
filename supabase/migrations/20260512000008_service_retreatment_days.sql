-- Add retreatment_days to services so the system can detect when a patient
-- is due for their next appointment of the same type.
-- NULL means "no cycle defined for this service".
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS retreatment_days INT
    CHECK (retreatment_days IS NULL OR retreatment_days > 0);

COMMENT ON COLUMN public.services.retreatment_days IS
  'Days between appointments for this service. NULL = no recurring cycle. Used by revenue opportunities detection.';
