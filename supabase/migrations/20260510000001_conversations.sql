-- ══════════════════════════════════════════════════════════════════════════
-- PacienteIA — Conversations & Messages (WhatsApp Inbox)
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── conversations ──────────────────────────────────────────────────────────
CREATE TABLE public.conversations (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id            UUID        NOT NULL REFERENCES public.branches(id),
  patient_id           UUID        REFERENCES public.patients(id) ON DELETE SET NULL,
  channel              TEXT        NOT NULL DEFAULT 'whatsapp',
  contact_phone        TEXT        NOT NULL,
  contact_name         TEXT,
  status               TEXT        NOT NULL DEFAULT 'open'
                                   CHECK (status IN ('open','assigned','resolved')),
  assigned_to          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  lead_heat            TEXT        CHECK (lead_heat IN ('hot','warm','cold')),
  unread_count         INT         NOT NULL DEFAULT 0,
  last_message_at      TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, branch_id, contact_phone, channel)
);

CREATE INDEX idx_conv_org_branch ON public.conversations(organization_id, branch_id, last_message_at DESC);
CREATE INDEX idx_conv_status     ON public.conversations(organization_id, status);
CREATE INDEX idx_conv_patient    ON public.conversations(patient_id) WHERE patient_id IS NOT NULL;

CREATE TRIGGER set_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── messages ───────────────────────────────────────────────────────────────
CREATE TABLE public.messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL,
  wamid           TEXT        UNIQUE,
  direction       TEXT        NOT NULL CHECK (direction IN ('inbound','outbound')),
  body            TEXT,
  media_type      TEXT        CHECK (media_type IN ('text','image','audio','video','document','sticker','location','reaction')),
  media_url       TEXT,
  status          TEXT        NOT NULL DEFAULT 'received'
                              CHECK (status IN ('received','sent','delivered','read','failed')),
  sent_by         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_msg_conversation ON public.messages(conversation_id, created_at ASC);
CREATE INDEX idx_msg_wamid        ON public.messages(wamid) WHERE wamid IS NOT NULL;
CREATE INDEX idx_msg_org          ON public.messages(organization_id, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read conversations"
  ON public.conversations FOR SELECT
  USING (public.is_org_member(organization_id));

CREATE POLICY "org members update conversations"
  ON public.conversations FOR UPDATE
  USING (public.is_org_member(organization_id));

CREATE POLICY "org members read messages"
  ON public.messages FOR SELECT
  USING (public.is_org_member(organization_id));

-- ── Helper function ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_unread(p_conversation_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.conversations
  SET unread_count = unread_count + 1
  WHERE id = p_conversation_id;
$$;

COMMIT;
