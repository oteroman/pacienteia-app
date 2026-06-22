// Creates seed users via Supabase Auth Admin API
// Run: node scripts/create-seed-users.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hwuuuslpzxcgpfzdjrhz.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const SEED_USERS = [
  {
    email: 'owner@clinicabellaforma.com',
    password: 'Test1234!',
    full_name: 'María Fernández',
    // Fake ID used in seed SQL — needs to be remapped
    fakeSeedId: '11111111-0000-0000-0000-000000000001',
  },
  {
    email: 'admin@clinicabellaforma.com',
    password: 'Test1234!',
    full_name: 'Carlos Rodríguez',
    fakeSeedId: '11111111-0000-0000-0000-000000000002',
  },
  {
    email: 'staff@clinicabellaforma.com',
    password: 'Test1234!',
    full_name: 'Lucía Torres',
    fakeSeedId: '11111111-0000-0000-0000-000000000003',
  },
]

async function run() {
  // Step 1: fetch existing auth users to check who already exists
  const { data: { users: existingUsers }, error: listErr } = await supabase.auth.admin.listUsers()
  if (listErr) throw new Error(`listUsers failed: ${listErr.message}`)

  const existingByEmail = Object.fromEntries(existingUsers.map(u => [u.email, u]))
  console.log('Existing auth users:', existingUsers.map(u => u.email))

  const idMap = {} // fakeSeedId -> real UUID

  for (const seedUser of SEED_USERS) {
    let realId

    if (existingByEmail[seedUser.email]) {
      // User already exists — update their password
      realId = existingByEmail[seedUser.email].id
      console.log(`\nUpdating password for: ${seedUser.email} (id: ${realId})`)
      const { error } = await supabase.auth.admin.updateUserById(realId, {
        password: seedUser.password,
        email_confirm: true,
        user_metadata: { full_name: seedUser.full_name },
      })
      if (error) console.error(`  ERROR: ${error.message}`)
      else console.log(`  ✓ Password updated`)
    } else {
      // Create new user
      console.log(`\nCreating: ${seedUser.email}`)
      const { data, error } = await supabase.auth.admin.createUser({
        email: seedUser.email,
        password: seedUser.password,
        email_confirm: true,
        user_metadata: { full_name: seedUser.full_name },
      })
      if (error) { console.error(`  ERROR: ${error.message}`); continue }
      realId = data.user.id
      console.log(`  ✓ Created with id: ${realId}`)
    }

    idMap[seedUser.fakeSeedId] = realId
  }

  console.log('\n--- ID mapping (fake → real) ---')
  for (const [fake, real] of Object.entries(idMap)) {
    console.log(`  ${fake} → ${real}`)
  }

  // Step 2: fix profiles and clinic_members to use the real UUIDs
  for (const [fakeId, realId] of Object.entries(idMap)) {
    if (fakeId === realId) {
      console.log(`\n${fakeId}: IDs match, no migration needed`)
      continue
    }

    console.log(`\nMigrating data: ${fakeId} → ${realId}`)

    // Check if profile with fake ID exists
    const { data: oldProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', fakeId)
      .maybeSingle()

    if (oldProfile) {
      // Insert new profile with real ID
      const { error: insErr } = await supabase
        .from('profiles')
        .upsert({ ...oldProfile, id: realId })
      if (insErr) console.error(`  profiles upsert error: ${insErr.message}`)
      else {
        // Delete old profile
        await supabase.from('profiles').delete().eq('id', fakeId)
        console.log(`  ✓ profiles migrated`)
      }
    }

    // Update clinic_members user_id references
    const { error: cmErr } = await supabase
      .from('clinic_members')
      .update({ user_id: realId })
      .eq('user_id', fakeId)
    if (cmErr) console.error(`  clinic_members update error: ${cmErr.message}`)
    else console.log(`  ✓ clinic_members migrated`)
  }

  console.log('\n✅ Done. Test users:')
  for (const u of SEED_USERS) {
    console.log(`  ${u.email}  /  ${u.password}`)
  }
}

run().catch(console.error)
