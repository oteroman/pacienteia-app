-- Delay warnings: tracks when a patient was notified that the doctor is running late.
-- Prevents duplicate warnings for the same appointment pair.

create table if not exists delay_warnings (
  id                       uuid        primary key default gen_random_uuid(),
  organization_id          uuid        not null references organizations(id) on delete cascade,
  branch_id                uuid        not null references branches(id)      on delete cascade,
  delayed_appointment_id   uuid        not null references appointments(id)  on delete cascade,
  warned_appointment_id    uuid        not null references appointments(id)  on delete cascade,
  delay_minutes            int         not null default 0,
  sent_at                  timestamptz not null default now()
);

create unique index if not exists delay_warnings_pair_idx
  on delay_warnings(organization_id, delayed_appointment_id, warned_appointment_id);

alter table delay_warnings enable row level security;

create policy "org members can access delay_warnings"
  on delay_warnings
  using (is_org_member(organization_id));
