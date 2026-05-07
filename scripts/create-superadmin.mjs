// Creates the system superadmin user and links them to all test clinics.
// Run: node scripts/create-superadmin.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = 'https://hwuuuslpzxcgpfzdjrhz.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3dXV1c2xwenhjZ3BmemRqcmh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk3OTIyMiwiZXhwIjoyMDkzNTU1MjIyfQ.xmJLfRQUGjZtH6Va6hHr9YCDR4Pd4QUTesTR8EL0D8o'

const ADMIN_EMAIL    = 'oteroman22@gmail.com'
const ADMIN_PASSWORD = 'Admin2026!'
const ADMIN_NAME     = 'PacienteIA Admin'

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function run() {
  console.log('=== PacienteIA Superadmin Setup ===\n')

  // 1. Create or update the admin user
  const { data: { users } } = await sb.auth.admin.listUsers()
  const existing = users.find(u => u.email === ADMIN_EMAIL)

  let adminId

  if (existing) {
    console.log(`User ${ADMIN_EMAIL} already exists. Resetting password...`)
    const { error } = await sb.auth.admin.updateUserById(existing.id, {
      password:      ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: ADMIN_NAME },
    })
    if (error) { console.error('  ERROR:', error.message); process.exit(1) }
    adminId = existing.id
    console.log('  ✓ Password updated')
  } else {
    console.log(`Creating user ${ADMIN_EMAIL}...`)
    const { data, error } = await sb.auth.admin.createUser({
      email:         ADMIN_EMAIL,
      password:      ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: ADMIN_NAME },
    })
    if (error) { console.error('  ERROR:', error.message); process.exit(1) }
    adminId = data.user.id
    console.log(`  ✓ Created with id: ${adminId}`)
  }

  // 2. Upsert profile with platform_role = 'superadmin'
  const { error: profileErr } = await sb.from('profiles').upsert({
    id: adminId,
    full_name: ADMIN_NAME,
    platform_role: 'superadmin',
  })
  if (profileErr) { console.error('  ERROR profile:', profileErr.message); process.exit(1) }
  console.log('  ✓ Profile upserted (platform_role = superadmin)')

  // 3. Link to all clinics as owner
  const { data: clinics } = await sb.from('clinics').select('id, name')
  console.log(`\nLinking to ${clinics?.length ?? 0} clinics...`)

  for (const clinic of (clinics ?? [])) {
    const { error } = await sb.from('clinic_members').upsert(
      { clinic_id: clinic.id, user_id: adminId, role: 'owner' },
      { onConflict: 'clinic_id,user_id' },
    )
    if (error) console.error(`  ERROR on ${clinic.name}:`, error.message)
    else       console.log(`  ✓ ${clinic.name}`)
  }

  console.log('\n=== ✅ Superadmin ready ===')
  console.log(`  Email:    ${ADMIN_EMAIL}`)
  console.log(`  Password: ${ADMIN_PASSWORD}`)
  console.log('\nPlatform console (login directo):')
  console.log('  /platform         — consola de plataforma (tenants, auditoría)')
  console.log('  /platform/tenants — lista de todas las clínicas')
  console.log('  /platform/audit   — log de acciones de plataforma')
  console.log('\nPara acceder a una clínica específica:')
  console.log('  1. Ir a /platform/tenants/<clinic_id>')
  console.log('  2. Click "Entrar como soporte" — se muestra barra ámbar')
  console.log('  3. Click "Salir del modo soporte" para volver a /platform')
}

run().catch(console.error)
