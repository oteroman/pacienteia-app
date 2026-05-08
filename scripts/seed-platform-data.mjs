/**
 * Seed script — populates production DB with realistic platform demo data.
 * Run: node scripts/seed-platform-data.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = 'https://hwuuuslpzxcgpfzdjrhz.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3dXV1c2xwenhjZ3BmemRqcmh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3OTIyMiwiZXhwIjoyMDkzNTU1MjIyfQ.xmJLfRQUGjZtH6Va6hHr9YCDR4Pd4QUTesTR8EL0D8o'

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const now = new Date()
const daysAgo  = (d) => new Date(now - d * 86400000).toISOString()
const daysFrom = (d) => new Date(now.getTime() + d * 86400000).toISOString()

// ── Clinics to add (new ones, real-looking Lima clinics) ──────────────────
// plan values: 'trial' | 'basic' | 'pro' | 'premium'
// subscription_status: 'trialing' | 'active' | 'overdue' | 'cancelled'
// trial_ends_at: NOT NULL (use far-future date for active/cancelled)
const FAR_FUTURE = daysFrom(3650) // 10 years for non-trial clinics

const NEW_CLINICS = [
  {
    id: 'cccccccc-0001-0000-0000-000000000001',
    name: 'Clínica Estética Miraflores',
    slug: 'estetica-miraflores',
    address: 'Av. Larco 740, Miraflores, Lima',
    city: 'Lima', country: 'PE',
    plan: 'pro',
    subscription_status: 'active',
    trial_ends_at: FAR_FUTURE,
    created_at: daysAgo(90),
  },
  {
    id: 'cccccccc-0002-0000-0000-000000000001',
    name: 'BeautyMed San Isidro',
    slug: 'beautymed-san-isidro',
    address: 'Calle Los Libertadores 320, San Isidro',
    city: 'Lima', country: 'PE',
    plan: 'basic',
    subscription_status: 'trialing',
    trial_ends_at: daysFrom(2),   // expires in 2 days — URGENT
    created_at: daysAgo(28),
  },
  {
    id: 'cccccccc-0003-0000-0000-000000000001',
    name: 'Derma Clinic Surco',
    slug: 'derma-clinic-surco',
    address: 'Av. El Polo 670, Santiago de Surco',
    city: 'Lima', country: 'PE',
    plan: 'pro',
    subscription_status: 'trialing',
    trial_ends_at: daysFrom(6),   // 6 days — warning
    created_at: daysAgo(24),
  },
  {
    id: 'cccccccc-0004-0000-0000-000000000001',
    name: 'Skin Lab Barranco',
    slug: 'skin-lab-barranco',
    address: 'Jr. Junín 234, Barranco',
    city: 'Lima', country: 'PE',
    plan: 'basic',
    subscription_status: 'trialing',
    trial_ends_at: daysFrom(12),
    created_at: daysAgo(18),
  },
  {
    id: 'cccccccc-0005-0000-0000-000000000001',
    name: 'Clínica Juventa La Molina',
    slug: 'juventa-la-molina',
    address: 'Av. La Molina 1234, La Molina',
    city: 'Lima', country: 'PE',
    plan: 'premium',
    subscription_status: 'active',
    trial_ends_at: FAR_FUTURE,
    created_at: daysAgo(180),
  },
  {
    id: 'cccccccc-0006-0000-0000-000000000001',
    name: 'AesthétiQ Pueblo Libre',
    slug: 'aesthetiq-pueblo-libre',
    address: 'Av. Brasil 2100, Pueblo Libre',
    city: 'Lima', country: 'PE',
    plan: 'basic',
    subscription_status: 'cancelled',
    trial_ends_at: daysAgo(5),
    created_at: daysAgo(60),
  },
  {
    id: 'cccccccc-0007-0000-0000-000000000001',
    name: 'Médico Estético Lince',
    slug: 'medico-estetico-lince',
    address: 'Av. Arequipa 3100, Lince',
    city: 'Lima', country: 'PE',
    plan: 'pro',
    subscription_status: 'overdue',
    trial_ends_at: FAR_FUTURE,
    created_at: daysAgo(45),
  },
  {
    id: 'cccccccc-0008-0000-0000-000000000001',
    name: 'Glow Center Magdalena',
    slug: 'glow-center-magdalena',
    address: 'Av. Brasil 820, Magdalena del Mar',
    city: 'Lima', country: 'PE',
    plan: 'trial',
    subscription_status: 'trialing',
    trial_ends_at: daysFrom(0),   // expires TODAY
    created_at: daysAgo(30),
  },
]

// ── Users to create for new clinics ──────────────────────────────────────
const CLINIC_USERS = [
  { email: 'dra.garcia@estetica-miraflores.com', name: 'Dra. Carmen García', clinicIdx: 0, role: 'owner' },
  { email: 'admin@estetica-miraflores.com',      name: 'Patricia Ríos',      clinicIdx: 0, role: 'admin' },
  { email: 'info@beautymed-si.com',              name: 'Dr. Roberto Lema',   clinicIdx: 1, role: 'owner' },
  { email: 'recepcion@beautymed-si.com',         name: 'Lucia Torres',       clinicIdx: 1, role: 'staff' },
  { email: 'direccion@dermaclinic.pe',           name: 'Dra. Sofía Herrera', clinicIdx: 2, role: 'owner' },
  { email: 'admin@dermaclinic.pe',               name: 'Marco Vega',         clinicIdx: 2, role: 'admin' },
  { email: 'consultas@dermaclinic.pe',           name: 'Ana Palacios',       clinicIdx: 2, role: 'staff' },
  { email: 'info@skinlab.pe',                    name: 'Dr. Álvaro Núñez',   clinicIdx: 3, role: 'owner' },
  { email: 'dra.mendoza@juventa.pe',             name: 'Dra. Elena Mendoza', clinicIdx: 4, role: 'owner' },
  { email: 'admin@juventa.pe',                   name: 'Carlos Fuentes',     clinicIdx: 4, role: 'admin' },
  { email: 'staff1@juventa.pe',                  name: 'Rosa Cárdenas',      clinicIdx: 4, role: 'staff' },
  { email: 'staff2@juventa.pe',                  name: 'Miguel Ángel Díaz',  clinicIdx: 4, role: 'staff' },
  { email: 'dr.castillo@aesthetiq.pe',           name: 'Dr. Felipe Castillo',clinicIdx: 5, role: 'owner' },
  { email: 'info@medicostetico.pe',              name: 'Dra. Valeria Mora',  clinicIdx: 6, role: 'owner' },
  { email: 'glow@glowcenter.pe',                 name: 'Daniela Ortega',     clinicIdx: 7, role: 'owner' },
]

// ── Audit log entries ─────────────────────────────────────────────────────
const SUPERADMIN_ID   = '0adc0c09-d2de-42db-8603-8fc3f7e5ba62'
const SUPERADMIN_EMAIL = 'oteroman22@gmail.com'

const AUDIT_ENTRIES = [
  { action: 'extend_trial', clinic: 2, daysAgo: 1,  details: { days: 7 } },
  { action: 'extend_trial', clinic: 3, daysAgo: 3,  details: { days: 14 } },
  { action: 'assign_plan',  clinic: 0, daysAgo: 5,  details: { plan: 'pro' } },
  { action: 'enter_tenant', clinic: 4, daysAgo: 6,  details: {} },
  { action: 'exit_tenant',  clinic: 4, daysAgo: 6,  details: {} },
  { action: 'suspend',      clinic: 5, daysAgo: 10, details: { reason: 'pago vencido' } },
  { action: 'reactivate',   clinic: 5, daysAgo: 8,  details: {} },
  { action: 'extend_trial', clinic: 1, daysAgo: 12, details: { days: 7 } },
]

async function run() {
  console.log('=== PacienteIA Platform Seed ===\n')

  // 1. Upsert new clinics
  console.log('Upserting clinics...')
  const { error: clinicErr } = await sb.from('clinics').upsert(NEW_CLINICS, { onConflict: 'id' })
  if (clinicErr) console.error('  Clinics error:', clinicErr.message)
  else console.log(`  ✓ ${NEW_CLINICS.length} clinics upserted`)

  // 2. Update existing clinics with better trial dates
  console.log('\nUpdating existing clinic trial dates...')
  const existingUpdates = [
    { id: 'aaaaaaaa-0000-0000-0000-000000000001', trial_ends_at: daysFrom(4),  plan: 'basic' },
    { id: 'aaaaaaaa-0000-0000-0000-000000000002', trial_ends_at: daysFrom(18), plan: 'pro' },
    { id: 'dddddddd-0000-0000-0000-000000000001', plan: 'basic',   trial_ends_at: FAR_FUTURE },
    { id: 'dddddddd-0000-0000-0000-000000000002', plan: 'pro',     trial_ends_at: FAR_FUTURE },
    { id: 'dddddddd-0000-0000-0000-000000000003', plan: 'premium', trial_ends_at: FAR_FUTURE },
  ]
  for (const u of existingUpdates) {
    const { error } = await sb.from('clinics').update({ plan: u.plan, trial_ends_at: u.trial_ends_at }).eq('id', u.id)
    if (error) console.error('  Update error:', error.message, u.id)
  }
  console.log('  ✓ Existing clinics updated')

  // 3. Create users and link to clinics
  console.log('\nCreating clinic users...')
  const { data: { users: existingUsers } } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const existingEmails = new Set(existingUsers.map(u => u.email))

  for (const cu of CLINIC_USERS) {
    const clinic = NEW_CLINICS[cu.clinicIdx]
    if (!clinic) continue

    let userId
    if (existingEmails.has(cu.email)) {
      userId = existingUsers.find(u => u.email === cu.email)?.id
      console.log(`  → ${cu.email} already exists`)
    } else {
      const { data, error } = await sb.auth.admin.createUser({
        email: cu.email, password: 'Demo2026!', email_confirm: true,
        user_metadata: { full_name: cu.name },
      })
      if (error) { console.error(`  ERROR creating ${cu.email}:`, error.message); continue }
      userId = data.user.id
      console.log(`  ✓ Created ${cu.email}`)
    }

    if (userId) {
      await sb.from('profiles').upsert({ id: userId, full_name: cu.name }, { onConflict: 'id' })
      await sb.from('clinic_members').upsert(
        { clinic_id: clinic.id, user_id: userId, role: cu.role },
        { onConflict: 'clinic_id,user_id' }
      )
    }
  }

  // 4. Seed platform audit log — fetch actual clinic IDs from DB
  console.log('\nSeeding audit log...')
  const { data: allClinics } = await sb.from('clinics').select('id, name').order('created_at', { ascending: false })
  const auditRows = AUDIT_ENTRIES.map(e => ({
    actor_id:    SUPERADMIN_ID,
    actor_email: SUPERADMIN_EMAIL,
    action_type: e.action,
    clinic_id:   allClinics?.[e.clinic]?.id ?? null,
    clinic_name: allClinics?.[e.clinic]?.name ?? null,
    details:     e.details,
    created_at:  daysAgo(e.daysAgo),
  }))
  const { error: auditErr } = await sb.from('platform_audit_log').insert(auditRows)
  if (auditErr) console.error('  Audit error:', auditErr.message)
  else console.log(`  ✓ ${auditRows.length} audit entries inserted`)

  // 5. Summary
  const { data: finalClinics } = await sb.from('clinics').select('subscription_status')
  const counts = (finalClinics ?? []).reduce((acc, c) => {
    acc[c.subscription_status] = (acc[c.subscription_status] ?? 0) + 1
    return acc
  }, {})

  console.log('\n=== ✅ Seed complete ===')
  console.log('Clinics by status:', counts)
  console.log('\nPlatform:  https://app.pacienteia.com/platform')
  console.log('Tenants:   https://app.pacienteia.com/platform/tenants')
  console.log('Trials:    https://app.pacienteia.com/platform/trials')
}

run().catch(console.error)
