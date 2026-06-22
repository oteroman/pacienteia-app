-- Abandonment risk score per patient: 0 (no risk) to 100 (high risk of churning).
-- Populated by the weekly CRON /api/internal/abandonment-prediction.

alter table patients
  add column if not exists abandonment_risk     int,
  add column if not exists abandonment_risk_at  timestamptz;

create index if not exists patients_abandonment_risk_idx
  on patients(organization_id, abandonment_risk)
  where abandonment_risk is not null;
