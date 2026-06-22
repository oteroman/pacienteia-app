/**
 * Creates 3 test clinics (basic, pro, premium) with seed data.
 * Run: node scripts/create-plan-users.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hwuuuslpzxcgpfzdjrhz.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ── Config ───────────────────────────────────────────────────
const PERIOD_START = '2026-05-01'
const FUTURE_DATE  = '2027-12-31T00:00:00Z'

const PLANS = [
  {
    email:    'basico@test.pacienteia.com',
    password: 'Test1234!',
    name:     'Test Básico',
    clinicId: 'dddddddd-0000-0000-0000-000000000001',
    clinic: {
      name:                'Clínica Test Básico',
      slug:                'test-basico',
      phone:               '+51 1 111 1111',
      address:             'Av. Test 100, Miraflores',
      city:                'Lima',
      plan:                'basic',
      subscription_status: 'active',
      trial_ends_at:       FUTURE_DATE,
      current_period_end:  FUTURE_DATE,
    },
    // Hard blocked: at 100% on leads and appointments
    usage: { leads_count: 50, appointments_count: 150, active_users: 1 },
    patients: [
      { name: 'Paciente Básico 1', phone: '+51 900 001 001', status: 'active',   lastVisit: '2026-04-20' },
      { name: 'Paciente Básico 2', phone: '+51 900 001 002', status: 'inactive', lastVisit: '2025-10-15' },
      { name: 'Lead Básico A',     phone: '+51 900 001 003', status: 'lead',     lastVisit: null },
    ],
    appointmentCount: 6,
  },
  {
    email:    'pro@test.pacienteia.com',
    password: 'Test1234!',
    name:     'Test Pro',
    clinicId: 'dddddddd-0000-0000-0000-000000000002',
    clinic: {
      name:                'Clínica Test Pro',
      slug:                'test-pro',
      phone:               '+51 1 222 2222',
      address:             'Av. Test 200, San Isidro',
      city:                'Lima',
      plan:                'pro',
      subscription_status: 'active',
      trial_ends_at:       FUTURE_DATE,
      current_period_end:  FUTURE_DATE,
    },
    // Soft blocked: 85% on leads, 84% on appointments
    usage: { leads_count: 170, appointments_count: 420, active_users: 2 },
    patients: [
      { name: 'Paciente Pro 1',  phone: '+51 900 002 001', status: 'active',   lastVisit: '2026-04-28' },
      { name: 'Paciente Pro 2',  phone: '+51 900 002 002', status: 'active',   lastVisit: '2026-04-10' },
      { name: 'Paciente Pro 3',  phone: '+51 900 002 003', status: 'inactive', lastVisit: '2025-11-20' },
      { name: 'Lead Pro A',      phone: '+51 900 002 004', status: 'lead',     lastVisit: null },
      { name: 'Lead Pro B',      phone: '+51 900 002 005', status: 'lead',     lastVisit: null },
    ],
    appointmentCount: 10,
  },
  {
    email:    'premium@test.pacienteia.com',
    password: 'Test1234!',
    name:     'Test Premium',
    clinicId: 'dddddddd-0000-0000-0000-000000000003',
    clinic: {
      name:                'Clínica Test Premium',
      slug:                'test-premium',
      phone:               '+51 1 333 3333',
      address:             'Av. Test 300, La Molina',
      city:                'Lima',
      plan:                'premium',
      subscription_status: 'active',
      trial_ends_at:       FUTURE_DATE,
      current_period_end:  FUTURE_DATE,
    },
    // Comfortable: 5% usage, no blocks
    usage: { leads_count: 50, appointments_count: 200, active_users: 3 },
    patients: [
      { name: 'Paciente Premium 1', phone: '+51 900 003 001', status: 'active',   lastVisit: '2026-05-01' },
      { name: 'Paciente Premium 2', phone: '+51 900 003 002', status: 'active',   lastVisit: '2026-04-25' },
      { name: 'Paciente Premium 3', phone: '+51 900 003 003', status: 'active',   lastVisit: '2026-04-18' },
      { name: 'Paciente Premium 4', phone: '+51 900 003 004', status: 'inactive', lastVisit: '2025-12-01' },
      { name: 'Lead Premium A',     phone: '+51 900 003 005', status: 'lead',     lastVisit: null },
      { name: 'Lead Premium B',     phone: '+51 900 003 006', status: 'lead',     lastVisit: null },
      { name: 'Lead Premium C',     phone: '+51 900 003 007', status: 'lead',     lastVisit: null },
    ],
    appointmentCount: 15,
  },
]

// ── Helpers ──────────────────────────────────────────────────
function uuid(prefix, n) {
  return `${prefix}-0000-0000-${String(n).padStart(4, '0')}-000000000001`
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

// ── Main ─────────────────────────────────────────────────────
async function run() {
  console.log('🌱 PacienteIA — Plan test users seed\n')

  const { data: { users: existingUsers } } = await supabase.auth.admin.listUsers()
  const existingByEmail = Object.fromEntries((existingUsers ?? []).map(u => [u.email, u]))

  for (const plan of PLANS) {
    console.log(`\n── ${plan.clinic.plan.toUpperCase()} ─────────────────────────`)

    // 1. Auth user
    let userId
    if (existingByEmail[plan.email]) {
      userId = existingByEmail[plan.email].id
      await supabase.auth.admin.updateUserById(userId, {
        password: plan.password,
        email_confirm: true,
        user_metadata: { full_name: plan.name },
      })
      console.log(`  ✓ Auth user exists: ${plan.email} (${userId})`)
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: plan.email,
        password: plan.password,
        email_confirm: true,
        user_metadata: { full_name: plan.name },
      })
      if (error) { console.error(`  ✗ Auth create failed: ${error.message}`); continue }
      userId = data.user.id
      console.log(`  ✓ Auth user created: ${plan.email} (${userId})`)
    }

    // 2. Clinic
    const { error: clinicErr } = await supabase
      .from('clinics')
      .upsert({ id: plan.clinicId, ...plan.clinic }, { onConflict: 'id' })
    if (clinicErr) { console.error(`  ✗ Clinic upsert failed: ${clinicErr.message}`); continue }
    console.log(`  ✓ Clinic: ${plan.clinic.name}`)

    // 3. Clinic member (owner)
    const { error: memberErr } = await supabase
      .from('clinic_members')
      .upsert({ clinic_id: plan.clinicId, user_id: userId, role: 'owner' }, { onConflict: 'clinic_id,user_id' })
    if (memberErr) console.error(`  ✗ Member upsert: ${memberErr.message}`)
    else console.log(`  ✓ clinic_members linked`)

    // 4. Subscription usage (current month)
    const { error: usageErr } = await supabase
      .from('subscription_usage')
      .upsert({
        clinic_id:          plan.clinicId,
        period_start:       PERIOD_START,
        leads_count:        plan.usage.leads_count,
        appointments_count: plan.usage.appointments_count,
        active_users:       plan.usage.active_users,
      }, { onConflict: 'clinic_id,period_start' })
    if (usageErr) console.error(`  ✗ Usage upsert: ${usageErr.message}`)
    else console.log(`  ✓ subscription_usage: leads=${plan.usage.leads_count}, appointments=${plan.usage.appointments_count}`)

    // 5. Patients
    const patientIds = []
    for (let i = 0; i < plan.patients.length; i++) {
      const p = plan.patients[i]
      const pid = `eeeeeeee-${plan.clinicId.slice(9, 13)}-0000-0000-${String(i + 1).padStart(12, '0')}`
      const { error: pErr } = await supabase
        .from('patients')
        .upsert({
          id:              pid,
          clinic_id:       plan.clinicId,
          full_name:       p.name,
          phone:           p.phone,
          status:          p.status,
          last_visit_date: p.lastVisit,
        }, { onConflict: 'id' })
      if (pErr) console.error(`  ✗ Patient "${p.name}": ${pErr.message}`)
      else patientIds.push({ id: pid, status: p.status })
    }
    console.log(`  ✓ patients: ${patientIds.length} inserted`)

    // 6. Appointments (use active patients only)
    const activePatients = patientIds.filter(p => p.status === 'active')
    if (activePatients.length > 0) {
      const treatments = [
        'Botox frente', 'Peeling químico', 'Relleno labios', 'Mesoterapia',
        'Consulta inicial', 'Hidratación profunda', 'Lifting facial',
      ]
      const statuses = ['confirmed', 'completed', 'scheduled', 'completed', 'confirmed']
      const appts = []
      for (let i = 0; i < Math.min(plan.appointmentCount, 20); i++) {
        const patient = activePatients[i % activePatients.length]
        appts.push({
          clinic_id:    plan.clinicId,
          patient_id:   patient.id,
          treatment_type: treatments[i % treatments.length],
          scheduled_at: daysAgo(i % 14),
          status:       statuses[i % statuses.length],
          price:        [150, 200, 250, 300, 350, 400][i % 6],
        })
      }
      const { error: apptErr } = await supabase.from('appointments').insert(appts)
      if (apptErr) console.error(`  ✗ Appointments: ${apptErr.message}`)
      else console.log(`  ✓ appointments: ${appts.length} inserted`)
    }

    console.log(`  ✅ Done — login: ${plan.email} / ${plan.password}`)
  }

  console.log('\n\n═══════════════════════════════════════════')
  console.log('TEST USERS SUMMARY')
  console.log('═══════════════════════════════════════════')
  for (const p of PLANS) {
    const state = p.clinic.plan === 'basic' ? '🔴 HARD BLOCKED (100%)' :
                  p.clinic.plan === 'pro'   ? '🟡 SOFT BLOCKED (85%)' :
                                              '🟢 SIN BLOQUEOS (5%)'
    console.log(`\n  ${state}`)
    console.log(`  Plan:  ${p.clinic.plan}`)
    console.log(`  Email: ${p.email}`)
    console.log(`  Clave: ${p.password}`)
    console.log(`  Clínica: ${p.clinic.name}`)
  }
  console.log('\n═══════════════════════════════════════════\n')
}

run().catch(console.error)
