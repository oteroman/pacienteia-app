-- Adds reschedule_options to appointment_reminders so the WhatsApp bot
-- can propose 3 available slots automatically when patient replies "2".
-- Also extends the status check to include 'rescheduled'.

-- Drop the existing status check constraint (auto-named by PostgreSQL)
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.appointment_reminders'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.appointment_reminders DROP CONSTRAINT %I', cname);
  END IF;
END $$;

-- Add column to store proposed slot options as JSON array
ALTER TABLE public.appointment_reminders
  ADD COLUMN IF NOT EXISTS reschedule_options JSONB;

-- Re-add the check constraint with 'rescheduled' included
ALTER TABLE public.appointment_reminders
  ADD CONSTRAINT appointment_reminders_status_check
  CHECK (status IN ('sent', 'confirmed', 'reschedule_requested', 'rescheduled', 'failed'));
