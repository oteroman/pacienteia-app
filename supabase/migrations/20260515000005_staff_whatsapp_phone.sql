-- Staff WhatsApp phone registration for Voice-to-Task feature.
-- Each org member can register their personal WhatsApp number so the system
-- recognizes their voice notes instead of treating them as patient messages.
ALTER TABLE public.org_members
  ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;

CREATE INDEX IF NOT EXISTS idx_org_members_whatsapp_phone
  ON public.org_members (whatsapp_phone)
  WHERE whatsapp_phone IS NOT NULL;
