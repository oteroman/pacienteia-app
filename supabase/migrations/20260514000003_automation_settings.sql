-- Automation settings: per-branch toggle for each automated workflow.
-- Staff can pause/resume automations from the settings panel.

create table if not exists automation_settings (
  id               uuid    primary key default gen_random_uuid(),
  organization_id  uuid    not null references organizations(id) on delete cascade,
  branch_id        uuid    not null references branches(id)      on delete cascade,
  automation_key   text    not null,
  is_enabled       boolean not null default true,
  updated_at       timestamptz not null default now(),
  unique (organization_id, branch_id, automation_key)
);

alter table automation_settings enable row level security;

create policy "org members can access automation_settings"
  on automation_settings
  using (is_org_member(organization_id));
