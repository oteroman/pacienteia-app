-- Payment configuration per branch + payment tracking per appointment.
-- Supports two methods: qr_image (manual Yape/Plin) and niubiz (payment link + auto-webhook).

alter table branch_whatsapp_config
  add column if not exists payment_method         text    not null default 'none',  -- none | qr_image | niubiz
  add column if not exists payment_deposit_amount int     not null default 50,       -- soles
  add column if not exists payment_qr_image_url   text,                              -- public URL of Yape/Plin QR image
  add column if not exists niubiz_merchant_id     text,
  add column if not exists niubiz_client_id_enc   text,                              -- encrypted
  add column if not exists niubiz_client_secret_enc text;                            -- encrypted

alter table appointments
  add column if not exists payment_status   text not null default 'none',  -- none | pending | paid | expired
  add column if not exists payment_link     text,
  add column if not exists payment_order_id text,
  add column if not exists payment_paid_at  timestamptz;

create index if not exists appointments_payment_pending_idx
  on appointments(organization_id, payment_status)
  where payment_status = 'pending';
