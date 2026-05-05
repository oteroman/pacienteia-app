-- ============================================================
-- PacienteIA — Soft Deletes
-- Add deleted_at to business entities
-- ============================================================

ALTER TABLE public.clinics      ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE public.patients     ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE public.appointments ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE public.lead_events  ADD COLUMN deleted_at TIMESTAMPTZ;

-- Partial indexes to only scan non-deleted rows
CREATE INDEX idx_clinics_active      ON public.clinics      (id)         WHERE deleted_at IS NULL;
CREATE INDEX idx_patients_active     ON public.patients     (clinic_id)  WHERE deleted_at IS NULL;
CREATE INDEX idx_appointments_active ON public.appointments (clinic_id)  WHERE deleted_at IS NULL;

-- Update RLS policies to exclude soft-deleted rows

-- clinics: members only see active clinics
DROP POLICY IF EXISTS "clinics: member select" ON public.clinics;
CREATE POLICY "clinics: member select"
  ON public.clinics FOR SELECT
  USING (public.is_clinic_member(id) AND deleted_at IS NULL);

-- patients: members only see active patients
DROP POLICY IF EXISTS "patients: member select" ON public.patients;
CREATE POLICY "patients: member select"
  ON public.patients FOR SELECT
  USING (public.is_clinic_member(clinic_id) AND deleted_at IS NULL);

-- appointments: members only see active appointments
DROP POLICY IF EXISTS "appointments: member select" ON public.appointments;
CREATE POLICY "appointments: member select"
  ON public.appointments FOR SELECT
  USING (public.is_clinic_member(clinic_id) AND deleted_at IS NULL);
