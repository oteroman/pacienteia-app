-- Message templates per branch
-- Staff can save reusable reply templates and pick them from the WhatsApp composer.

create table if not exists message_templates (
  id               uuid        primary key default gen_random_uuid(),
  organization_id  uuid        not null references organizations(id) on delete cascade,
  branch_id        uuid        not null references branches(id)      on delete cascade,
  name             text        not null,
  body             text        not null,
  category         text        not null default 'general',
  is_active        boolean     not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists message_templates_branch_idx
  on message_templates(organization_id, branch_id, is_active);

alter table message_templates enable row level security;

create policy "org members can access message_templates"
  on message_templates
  using (is_org_member(organization_id));
