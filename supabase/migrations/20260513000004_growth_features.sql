-- Fuente de adquisición por organización
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS acquisition_source TEXT
    CHECK (acquisition_source IN ('paxi','referido','outreach','google','evento','otro'));

-- CRM mínimo: notas de contacto del equipo de ventas/plataforma
CREATE TABLE IF NOT EXISTS public.platform_crm_notes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_email    TEXT        NOT NULL,
  contact_type    TEXT        NOT NULL DEFAULT 'note'
                              CHECK (contact_type IN ('note','call','email','demo','whatsapp')),
  body            TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_notes_org
  ON public.platform_crm_notes(organization_id, created_at DESC);
