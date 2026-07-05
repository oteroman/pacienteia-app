-- Per-clinic App Secret for HMAC validation.
-- Each clinic has their own Meta app with their own App Secret.
-- Stored encrypted with the same AES-256-GCM key as access_token_enc.
ALTER TABLE branch_whatsapp_config
  ADD COLUMN IF NOT EXISTS app_secret_enc TEXT;
