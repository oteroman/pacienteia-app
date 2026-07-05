-- P4.2 Concierge de Sala de Espera
-- Adds wa_phone to branch_whatsapp_config for QR generation
-- Creates waiting_queue table for real-time queue management

ALTER TABLE public.branch_whatsapp_config
  ADD COLUMN IF NOT EXISTS wa_phone TEXT;

CREATE TABLE IF NOT EXISTS public.waiting_queue (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id)  ON DELETE CASCADE,
  branch_id       UUID        NOT NULL REFERENCES public.branches(id)        ON DELETE CASCADE,
  patient_id      UUID                 REFERENCES public.patients(id)         ON DELETE SET NULL,
  patient_name    TEXT        NOT NULL DEFAULT 'Paciente',
  phone           TEXT        NOT NULL,
  treatment_type  TEXT,
  position        INTEGER     NOT NULL DEFAULT 1,
  status          TEXT        NOT NULL DEFAULT 'waiting'
                              CHECK (status IN ('waiting', 'called', 'done')),
  entered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  called_at       TIMESTAMPTZ,
  done_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS waiting_queue_branch_status_idx
  ON public.waiting_queue(branch_id, status, entered_at);

ALTER TABLE public.waiting_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_member_waiting_queue" ON public.waiting_queue
  FOR ALL USING (is_org_member(organization_id));
