-- Flash offers: empty slot detection + targeted WhatsApp campaigns
-- When a slot opens or stays empty before tomorrow, notify 1-2 patients with a discount.

create table if not exists flash_offers (
  id               uuid        primary key default gen_random_uuid(),
  organization_id  uuid        not null references organizations(id) on delete cascade,
  branch_id        uuid        not null references branches(id)      on delete cascade,
  professional_id  uuid        references professionals(id),
  service_id       uuid        references services(id),
  patient_id       uuid        references patients(id),
  contact_phone    text        not null,
  slot_at          timestamptz not null,
  discount_pct     int         not null default 20,
  status           text        not null default 'sent',   -- sent | accepted | expired
  expires_at       timestamptz not null,
  sent_at          timestamptz not null default now(),
  responded_at     timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists flash_offers_lookup_idx
  on flash_offers(organization_id, branch_id, status, contact_phone);

create index if not exists flash_offers_slot_idx
  on flash_offers(organization_id, branch_id, slot_at, status);

alter table flash_offers enable row level security;

create policy "org members can access flash_offers"
  on flash_offers
  using (is_org_member(organization_id));
