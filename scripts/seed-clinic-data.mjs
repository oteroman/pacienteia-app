/**
 * Seed demo data: organizations, branches, patients, appointments, gating events.
 * Targets 3 test accounts (basic/pro/premium) for the new org+branch schema.
 * Run: node scripts/seed-clinic-data.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL     || 'https://hwuuuslpzxcgpfzdjrhz.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY    || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3dXV1c2xwenhjZ3BmemRqcmh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3OTIyMiwiZXhwIjoyMDkzNTU1MjIyfQ.xmJLfRQUGjZtH6Va6hHr9YCDR4Pd4QUTesTR8EL0D8o'

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ── Time helpers ─────────────────────────────────────────────────────────────
const now = new Date()
const todayStr = now.toISOString().split('T')[0]

function daysAgo(n, hour = 10, minute = 0) {
  const d = new Date(now)
  d.setUTCDate(d.getUTCDate() - n)
  d.setUTCHours(hour, minute, 0, 0)
  return d.toISOString()
}
function dateStr(daysBack) {
  const d = new Date(now)
  d.setUTCDate(d.getUTCDate() - daysBack)
  return d.toISOString().split('T')[0]
}

// ── Lima patient pool ────────────────────────────────────────────────────────
const PATIENTS = [
  { name: 'María Elena Torres Quispe',   phone: '+51987111001', email: 'metorres@gmail.com',   status: 'active',   daysBack: 3   },
  { name: 'Carmen Rosa Flores Sánchez',  phone: '+51987111002', email: 'crflores@gmail.com',   status: 'active',   daysBack: 7   },
  { name: 'Lucía Beatriz Vargas Pérez',  phone: '+51987111003', email: 'lbvargas@gmail.com',   status: 'active',   daysBack: 12  },
  { name: 'Patricia Milagros Chávez',    phone: '+51987111004', email: 'pmchavez@gmail.com',   status: 'active',   daysBack: 15  },
  { name: 'Ana Sofía Mendoza Castro',    phone: '+51987111005', email: 'asmendoza@gmail.com',  status: 'active',   daysBack: 8   },
  { name: 'Rosa Isabel Huanca Mamani',   phone: '+51987111006', email: null,                   status: 'active',   daysBack: 20  },
  { name: 'Valeria Cristina López Díaz', phone: '+51987111007', email: 'vclopez@gmail.com',    status: 'active',   daysBack: 5   },
  { name: 'Sandra Milagros Ramos Vera',  phone: '+51987111008', email: 'smramos@gmail.com',    status: 'active',   daysBack: 25  },
  { name: 'Karla Beatriz Núñez Rojas',   phone: '+51987111009', email: 'kbnunez@gmail.com',    status: 'active',   daysBack: 10  },
  { name: 'Gabriela Soledad Arce',       phone: '+51987111010', email: 'gsarce@gmail.com',     status: 'active',   daysBack: 18  },
  { name: 'Fátima del Pilar Quispe',     phone: '+51987111011', email: null,                   status: 'active',   daysBack: 30  },
  { name: 'Mariana Esperanza Herrera',   phone: '+51987111012', email: 'meherrera@gmail.com',  status: 'active',   daysBack: 2   },
  { name: 'Juana Cecilia Ponce Rivera',  phone: '+51987111013', email: null,                   status: 'active',   daysBack: 45  },
  { name: 'Beatriz Alejandra Campos',    phone: '+51987111014', email: 'bacampos@gmail.com',   status: 'active',   daysBack: 60  },
  { name: 'Diana Paola Morales Vega',    phone: '+51987111015', email: 'dpmorales@gmail.com',  status: 'active',   daysBack: 14  },
  { name: 'Elena Marisol Delgado',       phone: '+51987222001', email: null,                   status: 'inactive', daysBack: 120 },
  { name: 'Nelly Aurora Gutiérrez',      phone: '+51987222002', email: 'nagutz@gmail.com',     status: 'inactive', daysBack: 95  },
  { name: 'Pilar Rosario Mamani',        phone: '+51987222003', email: null,                   status: 'inactive', daysBack: 180 },
  { name: 'Silvia Noemí Cotrina',        phone: '+51987222004', email: 'sncotrina@gmail.com',  status: 'inactive', daysBack: 150 },
  { name: 'Teresa Amparo Yupanqui',      phone: '+51987222005', email: null,                   status: 'inactive', daysBack: 200 },
  { name: 'Andrea Camila Salazar',       phone: '+51987333001', email: 'acsalazar@gmail.com',  status: 'lead',     daysBack: null },
  { name: 'Jessica Paola Tello',         phone: '+51987333002', email: 'jptello@gmail.com',    status: 'lead',     daysBack: null },
  { name: 'Natalia Xiomara Paredes',     phone: '+51987333003', email: null,                   status: 'lead',     daysBack: null },
  { name: 'Claudia Rebeca Infantes',     phone: '+51987333004', email: 'crinfantes@gmail.com', status: 'lead',     daysBack: null },
  { name: 'Vanessa Lorena Suárez',       phone: '+51987333005', email: 'vlsuarez@gmail.com',   status: 'lead',     daysBack: null },
]

const TREATMENTS = [
  'Botox frente', 'Relleno labios', 'Peeling químico', 'Mesoterapia facial',
  'Lifting facial', 'Hidratación profunda', 'Consulta inicial gratuita',
  'Plasma rico en plaquetas (PRP)', 'Láser fraccionado CO2', 'Micropigmentación cejas',
  'Depilación láser', 'Radiofrecuencia corporal', 'Cavitación ultrasónica',
  'Rinomodelación', 'Bichectomía con ácido',
]

const APT_STATUSES = ['completed', 'completed', 'confirmed', 'scheduled', 'no_show', 'cancelled']
const PRICES       = [150, 200, 250, 300, 350, 400, 500, 600]

function makeAppointments(orgId, branchId, patientRows, count) {
  const active = patientRows.filter(p => p.status === 'active')
  if (!active.length) return []
  const appts = []
  for (let i = 0; i < count; i++) {
    const patient = active[i % active.length]
    const dBack   = i < 3 ? 0 : Math.floor(Math.random() * 30) + 1
    const hour    = 8 + (i % 9)
    const minute  = (i % 2) === 0 ? 0 : 30
    const status  = dBack === 0 ? 'confirmed' : APT_STATUSES[i % APT_STATUSES.length]
    appts.push({
      organization_id: orgId,
      branch_id:       branchId,
      patient_id:      patient.id,
      treatment_type:  TREATMENTS[i % TREATMENTS.length],
      scheduled_at:    daysAgo(dBack, hour, minute),
      status,
      price:           PRICES[i % PRICES.length],
    })
  }
  return appts
}

function makeGatingEvents(orgId, plan, count) {
  const resources  = ['leads', 'appointments', 'users']
  const gateStates = plan === 'basic'
    ? ['hard_blocked', 'hard_blocked', 'soft_blocked']
    : ['soft_blocked', 'soft_blocked', 'hard_blocked']
  const pages  = ['/patients', '/appointments', '/leads', '/dashboard']
  const events = []
  for (let i = 0; i < count; i++) {
    const resource  = resources[i % resources.length]
    const gateState = gateStates[i % gateStates.length]
    const dBack     = Math.floor(Math.random() * 7)
    events.push({
      organization_id: orgId,
      event:       i % 3 === 0 ? 'modal_opened' :
                   i % 3 === 1 ? 'blocked_action_attempted' : 'cta_primary_clicked',
      resource,
      gate_state:  gateState,
      source_page: pages[i % pages.length],
      created_at:  daysAgo(dBack, 9 + (i % 8), (i % 2) * 30),
    })
  }
  return events
}

// ── Test org definitions ────────────────────────────────────────────────────
const ORGS = [
  {
    id:      'aaaaaaaa-0001-0000-0000-000000000001',
    branchId:'bbbbbbbb-0001-0000-0000-000000000001',
    email:   'basico@test.pacienteia.com',
    name:    'Clínica Lumina Estética',
    slug:    'lumina-estetica',
    plan:    'basic',
    aptCount: 20,
    gatingCount: 25,
    patientSlice: [0, 20],
  },
  {
    id:      'aaaaaaaa-0002-0000-0000-000000000001',
    branchId:'bbbbbbbb-0002-0000-0000-000000000001',
    email:   'pro@test.pacienteia.com',
    name:    'Centro Médico Estético Vita',
    slug:    'vita-estetica',
    plan:    'pro',
    aptCount: 35,
    gatingCount: 15,
    patientSlice: [0, 22],
  },
  {
    id:      'aaaaaaaa-0003-0000-0000-000000000001',
    branchId:'bbbbbbbb-0003-0000-0000-000000000001',
    email:   'premium@test.pacienteia.com',
    name:    'Clínica Bella Lima Premium',
    slug:    'bella-lima-premium',
    plan:    'premium',
    aptCount: 50,
    gatingCount: 3,
    patientSlice: [0, 25],
  },
]

// ── Main ────────────────────────────────────────────────────────────────────
async function run() {
  console.log('=== PacienteIA Demo Data Seed (v2 schema) ===\n')

  // List all auth users for lookup
  const { data: { users } } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const usersByEmail = Object.fromEntries(users.map(u => [u.email, u]))

  // Reset premium@ password
  const premiumUser = usersByEmail['premium@test.pacienteia.com']
  if (premiumUser) {
    await sb.auth.admin.updateUserById(premiumUser.id, { password: 'Test1234!', email_confirm: true })
    console.log('✓ premium@ password reset → Test1234!')
  } else {
    console.log('⚠ premium@ not found — run create-plan-users.mjs first')
  }

  for (const org of ORGS) {
    console.log(`\n── ${org.name} (${org.plan}) ─────────`)

    const owner = usersByEmail[org.email]
    if (!owner) {
      console.log(`  ⚠ user ${org.email} not found — skipping`)
      continue
    }

    // 1. Upsert organization
    const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()
    const { error: orgErr } = await sb.from('organizations').upsert({
      id:                  org.id,
      owner_user_id:       owner.id,
      name:                org.name,
      slug:                org.slug,
      industry:            'estetica',
      plan:                org.plan,
      subscription_status: 'trialing',
      trial_ends_at:       trialEndsAt,
      onboarding_status:   'first_flow_active',
    }, { onConflict: 'id' })
    if (orgErr) { console.error(`  org error: ${orgErr.message}`); continue }
    console.log(`  ✓ organization upserted`)

    // 2. Upsert branch
    const { error: brErr } = await sb.from('branches').upsert({
      id:              org.branchId,
      organization_id: org.id,
      name:            'Sede Principal',
      slug:            'sede-principal',
      city:            'Lima',
    }, { onConflict: 'id' })
    if (brErr) { console.error(`  branch error: ${brErr.message}`); continue }
    console.log(`  ✓ branch upserted`)

    // 3. Upsert org_member (owner)
    const { error: memErr } = await sb.from('org_members').upsert({
      organization_id: org.id,
      user_id:         owner.id,
      role:            'owner',
      status:          'active',
    }, { onConflict: 'organization_id,user_id' })
    if (memErr) console.error(`  member error: ${memErr.message}`)
    else console.log(`  ✓ owner membership upserted`)

    // 4. Upsert subscription_usage
    const periodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    await sb.from('subscription_usage').upsert({
      organization_id: org.id,
      period_start:    periodStart,
      leads:           Math.floor(Math.random() * 15),
      appointments:    Math.floor(Math.random() * 30),
      ai_messages:     Math.floor(Math.random() * 50),
      active_users:    1,
    }, { onConflict: 'organization_id,period_start' })
    console.log(`  ✓ subscription_usage upserted`)

    // 5. Upsert patients
    const slice = PATIENTS.slice(...org.patientSlice)
    const patientRows = []
    for (let i = 0; i < slice.length; i++) {
      const p   = slice[i]
      const pid = `${org.id.slice(0, 8)}-00${String(i + 1).padStart(2, '0')}-0000-0000-000000000001`
      const { error } = await sb.from('patients').upsert({
        id:              pid,
        organization_id: org.id,
        full_name:       p.name,
        phone:           p.phone,
        email:           p.email,
        status:          p.status,
        last_visit_date: p.daysBack !== null ? dateStr(p.daysBack) : null,
      }, { onConflict: 'id' })
      if (error) console.error(`  patient error: ${p.name} — ${error.message}`)
      else patientRows.push({ id: pid, status: p.status })
    }
    console.log(`  ✓ ${patientRows.length} patients upserted`)

    // 6. Delete old appointments and re-insert
    await sb.from('appointments').delete().eq('organization_id', org.id)
    const appts = makeAppointments(org.id, org.branchId, patientRows, org.aptCount)
    if (appts.length) {
      const { error } = await sb.from('appointments').insert(appts)
      if (error) console.error(`  appointments error: ${error.message}`)
      else console.log(`  ✓ ${appts.length} appointments inserted`)
    }

    // 7. Gating events
    const gating = makeGatingEvents(org.id, org.plan, org.gatingCount)
    const { error: gErr } = await sb.from('gating_events').insert(gating)
    if (gErr) console.error(`  gating events error: ${gErr.message}`)
    else console.log(`  ✓ ${gating.length} gating events inserted`)
  }

  console.log('\n=== ✅ Done ===')
  console.log('\nTest credentials:')
  console.log('  basico@test.pacienteia.com   / Test1234!  (plan: basic)')
  console.log('  pro@test.pacienteia.com      / Test1234!  (plan: pro)')
  console.log('  premium@test.pacienteia.com  / Test1234!  (plan: premium)')
  console.log('\nAdmin dashboard: /analytics/admin?key=pacienteia_admin_2026')
}

run().catch(console.error)
