import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  const envPath = resolve(__dirname, '../.env.local')
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)
  return Object.fromEntries(
    lines
      .filter((line) => /^\s*[^#]\S+=/.test(line))
      .map((line) => {
        const [key, ...value] = line.split('=')
        return [key.trim(), value.join('=').trim()]
      })
  )
}

const env = loadEnv()
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const SCHOOL_ID = '00000000-0000-0000-0000-000000000001'

const users = [
  {
    key: 'schoolAdmin',
    baseEmail: 'admin',
    password: 'Admin@1234',
    role: 'school_admin',
    fullName: 'Demo School Admin',
  },
  {
    key: 'teacher',
    baseEmail: 'teacher',
    password: 'Teacher@1234',
    role: 'teacher',
    fullName: 'Demo Teacher',
  },
  {
    key: 'manager',
    baseEmail: 'manager',
    password: 'Manager@1234',
    role: 'manager',
    fullName: 'Demo Manager',
  },
]

const runtimeCredentialsPath = resolve(__dirname, '../tests/e2e/.auth/runtime-credentials.json')

async function ensureSchool() {
  const { error } = await admin.from('schools').upsert(
    {
      id: SCHOOL_ID,
      name: 'Demo High School',
      code: 'DHS001',
      address: '123 School Street',
      phone: '+91 98765 43210',
      email: 'admin@demohighschool.edu',
      theme_color: '#3B82F6',
      academic_year_start_month: 4,
      is_active: true,
    },
    { onConflict: 'id' }
  )

  if (error) throw new Error(`Failed ensuring school: ${error.message}`)
}

async function getProfileForRole(role) {
  const { data, error } = await admin
    .from('user_profiles')
    .select('id, auth_user_id')
    .eq('school_id', SCHOOL_ID)
    .eq('role', role)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed loading ${role} profile: ${error.message}`)
  if (!data?.id || !data?.auth_user_id) {
    throw new Error(`No ${role} profile found for demo school; run dev seed first`) 
  }

  return data
}

async function createFreshAuthUser(user) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 10000)}`
  const email = `${user.baseEmail}.${suffix}@e2e.demo.school`

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: user.password,
    email_confirm: true,
    user_metadata: { role: user.role, full_name: user.fullName },
    app_metadata: { role: user.role },
  })

  if (error || !data.user?.id) {
    throw new Error(`Failed creating auth user for ${user.role}: ${error?.message ?? 'unknown error'}`)
  }

  return { authUserId: data.user.id, email }
}

async function updateProfile(user, profileId, authUserId) {
  const { error } = await admin
    .from('user_profiles')
    .update({
      auth_user_id: authUserId,
      full_name: user.fullName,
      role: user.role,
      is_active: true,
    })
    .eq('id', profileId)

  if (error) throw new Error(`Failed updating profile (${user.role}): ${error.message}`)
}

async function updateProfileEmail(profileId, email) {
  const { error } = await admin
    .from('user_profiles')
    .update({ email })
    .eq('id', profileId)

  if (error) throw new Error(`Failed updating profile email: ${error.message}`)
}

async function main() {
  await ensureSchool()
  mkdirSync(resolve(__dirname, '../tests/e2e/.auth'), { recursive: true })

  const runtimeCredentials = {
    schoolAdmin: null,
    teacher: null,
    manager: null,
  }

  for (const user of users) {
    const profile = await getProfileForRole(user.role)
    const { authUserId, email } = await createFreshAuthUser(user)
    await updateProfile(user, profile.id, authUserId)
    await updateProfileEmail(profile.id, email)

    runtimeCredentials[user.key] = {
      email,
      password: user.password,
    }

    process.stdout.write(`Ready: ${user.role} -> ${email}\n`)
  }

  writeFileSync(runtimeCredentialsPath, JSON.stringify(runtimeCredentials, null, 2))

  process.stdout.write('E2E auth seed completed.\n')
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
