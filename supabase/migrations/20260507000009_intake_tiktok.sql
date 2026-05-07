-- Add TikTok to intake source_channel enum
-- Drops and recreates the check constraint to include 'tiktok'

ALTER TABLE public.intakes
  DROP CONSTRAINT IF EXISTS intakes_source_channel_check;

ALTER TABLE public.intakes
  ADD CONSTRAINT intakes_source_channel_check
    CHECK (source_channel IN
      ('whatsapp', 'instagram', 'facebook', 'call', 'webform', 'manual', 'tiktok'));
