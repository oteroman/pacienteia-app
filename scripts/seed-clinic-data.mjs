/**
 * Seed realistic clinic data: patients, appointments, metrics, gating events.
 * Targets the 3 test clinics (basico/pro/premium) + new Lima clinics.
 * Run: node scripts/seed-clinic-data.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = 'https://hwuuuslpzxcgpfzdjrhz.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3dXV1c2xwenhjZ3BmemRqcmh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3OTIyMiwiZXhwIjoyMDkzNTU1MjIyfQ.xmJLfRQUGjZtH6Va6hHr9YCDR4Pd4QUTesTR8EL0D8o'

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

// ── Lima female/male names pool ───────────────────────────────────────────────
const PATIENTS = [
  // Active patients
  { name: 'María Elena Torres Quispe',   phone: '+51 987 111 001', email: 'metorres@gmail.com',    status: 'active',   daysBack: 3  },
  { name: 'Carmen Rosa Flores Sánchez',  phone: '+51 987 111 002', email: 'crflores@gmail.com',    status: 'active',   daysBack: 7  },
  { name: 'Lucía Beatriz Vargas Pérez',  phone: '+51 987 111 003', email: 'lbvargas@gmail.com',    status: 'active',   daysBack: 12 },
  { name: 'Patricia Milagros Chávez',    phone: '+51 987 111 004', email: 'pmchavez@gmail.com',    status: 'active',   daysBack: 15 },
  { name: 'Ana Sofía Mendoza Castro',    phone: '+51 987 111 005', email: 'asmendoza@gmail.com',   status: 'active',   daysBack: 8  },
  { name: 'Rosa Isabel Huanca Mamani',   phone: '+51 987 111 006', email: null,                    status: 'active',   daysBack: 20 },
  { name: 'Valeria Cristina López Díaz', phone: '+51 987 111 007', email: 'vclopez@gmail.com',     status: 'active',   daysBack: 5  },
  { name: 'Sandra Milagros Ramos Vera',  phone: '+51 987 111 008', email: 'smramos@gmail.com',     status: 'active',   daysBack: 25 },
  { name: 'Karla Beatriz Núñez Rojas',   phone: '+51 987 111 009', email: 'kbnunez@gmail.com',     status: 'active',   daysBack: 10 },
  { name: 'Gabriela Soledad Arce',       phone: '+51 987 111 010', email: 'gsarce@gmail.com',      status: 'active',   daysBack: 18 },
  { name: 'Fátima del Pilar Quispe',     phone: '+51 987 111 011', email: null,                    status: 'active',   daysBack: 30 },
  { name: 'Mariana Esperanza Herrera',   phone: '+51 987 111 012', email: 'meherrera@gmail.com',   status: 'active',   daysBack: 2  },
  { name: 'Juana Cecilia Ponce Rivera',  phone: '+51 987 111 013', email: null,                    status: 'active',   daysBack: 45 },
  { name: 'Beatriz Alejandra Campos',    phone: '+51 987 111 014', email: 'bacampos@gmail.com',    status: 'active',   daysBack: 60 },
  { name: 'Diana Paola Morales Vega',    phone: '+51 987 111 015', email: 'dpmorales@gmail.com',   status: 'active',   daysBack: 14 },
  // Inactive patients
  { name: 'Elena Marisol Delgado',       phone: '+51 987 222 001', email: null,                    status: 'inactive', daysBack: 120 },
  { name: 'Nelly Aurora Gutiérrez',      phone: '+51 987 222 002', email: 'nagutz@gmail.com',      status: 'inactive', daysBack: 95  },
  { name: 'Pilar Rosario Mamani',        phone: '+51 987 222 003', email: null,                    status: 'inactive', daysBack: 180 },
  { name: 'Silvia Noemí Cotrina',        phone: '+51 987 222 004', email: 'sncotrina@gmail.com',   status: 'inactive', daysBack: 150 },
  { name: 'Teresa Amparo Yupanqui',      phone: '+51 987 222 005', email: null,                    status: 'inactive', daysBack: 200 },
  // Leads
  { name: 'Andrea Camila Salazar',       phone: '+51 987 333 001', email: 'acsalazar@gmail.com',   status: 'lead',     daysBack: null },
  { name: 'Jessica Paola Tello',         phone: '+51 987 333 002', email: 'jptello@gmail.com',     status: 'lead',     daysBack: null },
  { name: 'Natalia Xiomara Paredes',     phone: '+51 987 333 003', email: null,                    status: 'lead',     daysBack: null },
  { name: 'Claudia Rebeca Infantes',     phone: '+51 987 333 004', email: 'crinfantes@gmail.com',  status: 'lead',     daysBack: null },
  { name: 'Vanessa Lorena Suárez',       phone: '+51 987 333 005', email: 'vlsuarez@gmail.com',    status: 'lead',     daysBack: null },
]

const TREATMENTS = [
  'Botox frente',
  'Relleno labios (ácido hialurónico)',
  'Peeling químico',
  'Mesoterapia facial',
  'Lifting facial sin cirugía',
  'Hidratación profunda',
  'Consulta inicial gratuita',
  'Plasma rico en plaquetas (PRP)',
  'Láser fraccionado CO2',
  'Micropigmentación cejas',
  'Depilación láser',
  'Radiofrecuencia corporal',
  'Cavitación ultrasónica',
  'Rinomodelación',
  'Bichectomía con ácido',
]

const APT_STATUSES  = ['completed', 'completed', 'confirmed', 'scheduled', 'no_show', 'cancelled']
const PRICES        = [150, 200, 250, 300, 350, 400, 500, 600]

// ── Generate appointments spread over last 30 days + today ───────────────────
function makeAppointments(clinicId, patientRows, count) {
  const active = patientRows.filter(p => p.status === 'active')
  if (!active.length) return []

  const appts = []
  for (let i = 0; i < count; i++) {
    const patient   = active[i % active.length]
    const dBack     = i < 3 ? 0 : Math.floor(Math.random() * 30) + 1 // first 3 = today
    const hour      = 8 + (i % 9)  // 8..16
    const minute    = (i % 2) === 0 ? 0 : 30
    const status    = dBack === 0 ? 'confirmed' : APT_STATUSES[i % APT_STATUSES.length]
    appts.push({
      clinic_id:      clinicId,
      patient_id:     patient.id,
      treatment_type: TREATMENTS[i % TREATMENTS.length],
      scheduled_at:   daysAgo(dBack, hour, minute),
      status,
      price:          PRICES[i % PRICES.length],
    })
  }
  return appts
}

// ── Generate metrics_daily for last 14 days ───────────────────────────────────
function makeMetrics(clinicId, scale = 1) {
  const rows = []
  for (let d = 13; d >= 0; d--) {
    const base = Math.max(1, Math.round(scale * (3 + Math.random() * 4)))
    rows.push({
      clinic_id:                     clinicId,
      date:                          dateStr(d),
      appointments_scheduled:        base + 1,
      appointments_confirmed:        base,
      appointments_completed:        d > 0 ? base - 1 : 0,
      appointments_cancelled:        d > 0 ? Math.floor(Math.random() * 2) : 0,
      appointments_no_show:          d > 0 ? (Math.random() > 0.7 ? 1 : 0) : 0,
      new_patients:                  Math.floor(Math.random() * 2),
      reactivated_patients:          Math.random() > 0.8 ? 1 : 0,
      leads_captured:                Math.floor(Math.random() * 3),
      estimated_revenue_recovered:   (base * 250 * scale).toFixed(2),
    })
  }
  return rows
}

// ── Generate gating events (for Indicadores page) ────────────────────────────
function makeGatingEvents(clinicId, clinicPlan, count) {
  const events = []
  const resources  = ['leads', 'appointments', 'users']
  const gateStates = clinicPlan === 'basic'
    ? ['hard_blocked', 'hard_blocked', 'soft_blocked']
    : ['soft_blocked', 'soft_blocked', 'hard_blocked']
  const pages = ['/patients', '/appointments', '/leads', '/dashboard']

  for (let i = 0; i < count; i++) {
    const resource  = resources[i % resources.length]
    const gateState = gateStates[i % gateStates.length]
    const dBack     = Math.floor(Math.random() * 7)
    events.push({
      clinic_id:   clinicId,
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

// ── Clinic definitions ────────────────────────────────────────────────────────
const CLINICS = [
  {
    id:          'dddddddd-0000-0000-0000-000000000001',
    patientPrefix: 'bb000001',
    plan:  'basic',
    label: 'Test Básico (basico@)',
    aptCount: 20,
    metricScale: 1,
    gatingCount: 25,
    patientSlice: [0, 20],
  },
  {
    id:          'dddddddd-0000-0000-0000-000000000002',
    patientPrefix: 'bb000002',
    plan:  'pro',
    label: 'Test Pro (pro@)',
    aptCount: 35,
    metricScale: 2,
    gatingCount: 15,
    patientSlice: [0, 22],
  },
  {
    id:          'dddddddd-0000-0000-0000-000000000003',
    patientPrefix: 'bb000003',
    plan:  'premium',
    label: 'Test Premium (premium@)',
    aptCount: 50,
    metricScale: 3,
    gatingCount: 3,
    patientSlice: [0, 25],
  },
]

// ── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('=== PacienteIA Clinic Data Seed ===\n')

  // 0. Fix premium@ password (reset to Test1234!)
  console.log('Resetting premium@ password...')
  const { data: { users } } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const premiumUser = users.find(u => u.email === 'premium@test.pacienteia.com')
  if (premiumUser) {
    const { error } = await sb.auth.admin.updateUserById(premiumUser.id, {
      password: 'Test1234!',
      email_confirm: true,
    })
    if (error) console.error('  premium@ reset error:', error.message)
    else console.log(`  ✓ premium@ password reset → Test1234!`)
  } else {
    console.log('  ⚠ premium@ user not found in auth — run create-plan-users.mjs first')
  }

  // Process each clinic
  for (const clinic of CLINICS) {
    console.log(`\n── ${clinic.label} ─────────────────────────────────`)

    // 1. Upsert patients
    const slice = PATIENTS.slice(...clinic.patientSlice)
    const patientRows = []

    for (let i = 0; i < slice.length; i++) {
      const p  = slice[i]
      const pid = `${clinic.patientPrefix}-${String(i + 1).padStart(4, '0')}-0000-0000-000000000001`
      const { error } = await sb.from('patients').upsert({
        id:              pid,
        clinic_id:       clinic.id,
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

    // 2. Delete existing appointments then re-insert (avoid duplication)
    await sb.from('appointments').delete().eq('clinic_id', clinic.id)
    const appts = makeAppointments(clinic.id, patientRows, clinic.aptCount)
    if (appts.length) {
      const { error } = await sb.from('appointments').insert(appts)
      if (error) console.error(`  appointments error: ${error.message}`)
      else console.log(`  ✓ ${appts.length} appointments inserted (${appts.filter(a => a.scheduled_at.startsWith(todayStr.slice(0, 10))).length} today)`)
    }

    // 3. Upsert metrics_daily
    const metrics = makeMetrics(clinic.id, clinic.metricScale)
    const { error: mErr } = await sb.from('metrics_daily')
      .upsert(metrics, { onConflict: 'clinic_id,date' })
    if (mErr) console.error(`  metrics error: ${mErr.message}`)
    else console.log(`  ✓ ${metrics.length} days of metrics upserted`)

    // 4. Upsert gating events
    const gating = makeGatingEvents(clinic.id, clinic.plan, clinic.gatingCount)
    const { error: gErr } = await sb.from('gating_events').insert(gating)
    if (gErr) console.error(`  gating events error: ${gErr.message}`)
    else console.log(`  ✓ ${gating.length} gating events inserted`)
  }

  // Summary
  console.log('\n=== ✅ Done ===')
  console.log('\nTest login credentials:')
  console.log('  basico@test.pacienteia.com   / Test1234!')
  console.log('  pro@test.pacienteia.com      / Test1234!')
  console.log('  premium@test.pacienteia.com  / Test1234!')
  console.log('\nIndicadores: https://app.pacienteia.com/analytics/admin?key=pacienteia_admin_2026')
}

run().catch(console.error)
