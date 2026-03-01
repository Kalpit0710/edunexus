/**
 * One-time dev setup script — creates a school-admin test user.
 * Usage: node scripts/create-dev-user.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Load .env.local manually ──────────────────────────────────────────────────
const envPath = resolve(__dirname, '../.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.match(/^\s*[^#]\S+=.*/))
    .map(l => {
      const [k, ...v] = l.split('=')
      return [k.trim(), v.join('=').trim()]
    })
)

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY']
const SCHOOL_ID = '00000000-0000-0000-0000-000000000001'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local')
  process.exit(1)
}

// Test credentials — change if you like
const TEST_USERS = [
  { email: 'admin@demo.school', password: 'Admin@1234', role: 'school_admin', full_name: 'Demo Admin' },
  { email: 'teacher@demo.school', password: 'Teacher@1234', role: 'teacher', full_name: 'Demo Teacher' },
  { email: 'manager@demo.school', password: 'Manager@1234', role: 'manager', full_name: 'Demo Manager' },
]

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Ensure seed school exists ─────────────────────────────────────────────────
console.log('Ensuring seed school exists...')
const { error: schoolErr } = await adminClient.from('schools').upsert({
  id: SCHOOL_ID,
  name: 'Demo High School',
  code: 'DHS001',
  address: '123 School Street',
  phone: '+91 98765 43210',
  email: 'admin@demohighschool.edu',
  theme_color: '#3B82F6',
  academic_year_start_month: 4,
  is_active: true,
}, { onConflict: 'id' })
if (schoolErr) {
  console.error('  ✗ Could not insert school:', schoolErr.message)
  process.exit(1)
}
console.log('  ✓ Seed school ready (DHS001 — Demo High School)\n')

for (const u of TEST_USERS) {
  console.log(`\nCreating ${u.role}: ${u.email}`)

  // 1. Create auth user (or find existing)
  let userId = null
  const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
  })

  if (authErr) {
    if (authErr.message.includes('already been registered') || authErr.message.includes('already exists')) {
      console.log(`  ⚠ Already exists — looking up auth user...`)
      const { data: listData } = await adminClient.auth.admin.listUsers()
      const existing = listData?.users?.find(x => x.email === u.email)
      if (!existing) { console.error('  ✗ Could not find existing user'); continue }
      userId = existing.id
    } else {
      console.error(`  ✗ Auth error: ${authErr.message}`)
      continue
    }
  } else {
    userId = authData.user.id
  }
  console.log(`  ✓ Auth user: ${userId}`)

  // 2. Check if user_profile already exists
  const { data: existing } = await adminClient
    .from('user_profiles')
    .select('id')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (existing) {
    console.log(`  ⚠ user_profile already exists — skipping`)
    continue
  }

  // 3. Create user_profile
  const { error: profileErr } = await adminClient.from('user_profiles').insert({
    auth_user_id: userId,
    school_id: SCHOOL_ID,
    full_name: u.full_name,
    email: u.email,
    role: u.role,
    is_active: true,
  })

  if (profileErr) {
    console.error(`  ✗ Profile error: ${profileErr.message}`)
  } else {
    console.log(`  ✓ user_profile created — role: ${u.role}`)
  }
}

console.log('\n✅ Done! You can now log in at http://localhost:3001/login')
console.log('\nTest credentials:')
TEST_USERS.forEach(u => console.log(`  [${u.role}]  ${u.email}  /  ${u.password}`))
