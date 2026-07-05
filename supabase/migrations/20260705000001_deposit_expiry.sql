-- No-show blindado: liberar cupos cuya separación (depósito) no se pagó a tiempo.
-- Registra CUÁNDO se solicitó la separación para poder expirarla tras una ventana (2h).
-- Aditiva y segura: columna nullable + índice parcial. Sin backfill destructivo.

alter table appointments
  add column if not exists payment_requested_at timestamptz;

-- El cron busca citas 'pending' cuya separación venció; índice parcial para esa query.
create index if not exists appointments_deposit_expiry_idx
  on appointments (payment_requested_at)
  where payment_status = 'pending';
