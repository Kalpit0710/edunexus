import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
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
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const anon = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const demoUsers = [
  {
    profileId: '20000000-0000-0000-0000-000000000001',
    oldAuthId: '10000000-0000-0000-0000-000000000001',
    email: 'superadmin@edunexus.demo',
    loginEmail: 'superadmin.login@edunexus.demo',
    password: 'SuperAdmin@123',
    fullName: 'Platform Super Admin',
    role: 'super_admin',
    patchParents: false,
  },
  {
    profileId: '20000000-0000-0000-0000-000000000002',
    oldAuthId: '10000000-0000-0000-0000-000000000002',
    email: 'admin@demo.school',
    loginEmail: 'admin.login@demo.school',
    password: 'Admin@1234',
    fullName: 'Demo School Admin',
    role: 'school_admin',
    patchParents: false,
  },
  {
    profileId: '20000000-0000-0000-0000-000000000003',
    oldAuthId: '10000000-0000-0000-0000-000000000003',
    email: 'teacher1@demo.school',
    loginEmail: 'teacher1.login@demo.school',
    password: 'Teacher@1234',
    fullName: 'Rhea Sharma',
    role: 'teacher',
    patchParents: false,
  },
  {
    profileId: '20000000-0000-0000-0000-000000000007',
    oldAuthId: '10000000-0000-0000-0000-000000000007',
    email: 'teacher2@demo.school',
    loginEmail: 'teacher2.login@demo.school',
    password: 'Teacher2@1234',
    fullName: 'Isha Nair',
    role: 'teacher',
    patchParents: false,
  },
  {
    profileId: '20000000-0000-0000-0000-000000000004',
    oldAuthId: '10000000-0000-0000-0000-000000000004',
    email: 'manager@demo.school',
    loginEmail: 'manager.login@demo.school',
    password: 'Manager@1234',
    fullName: 'Karan Verma',
    role: 'manager',
    patchParents: false,
  },
  {
    profileId: '20000000-0000-0000-0000-000000000005',
    oldAuthId: '10000000-0000-0000-0000-000000000005',
    email: 'cashier@demo.school',
    loginEmail: 'cashier.login@demo.school',
    password: 'Cashier@1234',
    fullName: 'Amit Joshi',
    role: 'cashier',
    patchParents: false,
  },
  {
    profileId: '20000000-0000-0000-0000-000000000006',
    oldAuthId: '10000000-0000-0000-0000-000000000006',
    email: 'parent@demo.school',
    loginEmail: 'parent.login@demo.school',
    password: 'Parent@1234',
    fullName: 'Neha Sharma',
    role: 'parent',
    patchParents: true,
  },
]

async function createLoginUser(user) {
  let attempts = 0
  let lastError = null

  while (attempts < 5) {
    attempts += 1
    const loginEmail = attempts === 1
      ? user.loginEmail
      : user.loginEmail.replace('@', `+${attempts - 1}@`)

    const { data, error } = await admin.auth.admin.createUser({
      email: loginEmail,
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.fullName },
      app_metadata: { role: user.role },
    })

    if (!error && data?.user?.id) {
      return { id: data.user.id, loginEmail }
    }

    lastError = error
  }

  throw new Error(`Unable to create login auth user for ${user.email}: ${lastError?.message ?? 'unknown error'}`)
}

async function relinkProfile(user, newAuthId, loginEmail) {
  const { error } = await admin
    .from('user_profiles')
    .update({
      auth_user_id: newAuthId,
      email: loginEmail,
      full_name: user.fullName,
    })
    .eq('id', user.profileId)

  if (error) {
    throw new Error(`Failed to relink profile ${user.profileId}: ${error.message}`)
  }
}

async function relinkParentRows(user, newAuthId, loginEmail) {
  if (!user.patchParents) return

  const { error } = await admin
    .from('parents')
    .update({ auth_user_id: newAuthId, email: loginEmail })
    .eq('auth_user_id', user.oldAuthId)

  if (error) {
    throw new Error(`Failed to relink parent row for ${user.email}: ${error.message}`)
  }
}

async function verifyLogins() {
  const checks = demoUsers.filter((u) => u.role !== 'super_admin')

  for (const check of checks) {
    const { error } = await anon.auth.signInWithPassword({
      email: check.loginEmail,
      password: check.password,
    })

    if (error) {
      throw new Error(`Login verification failed for ${check.loginEmail}: ${error.message}`)
    }

    await anon.auth.signOut()
  }
}

async function main() {
  for (const user of demoUsers) {
    const created = await createLoginUser(user)
    await relinkProfile(user, created.id, created.loginEmail)
    await relinkParentRows(user, created.id, created.loginEmail)
    process.stdout.write(`Repaired auth mapping for ${user.email} -> ${created.loginEmail}\n`)
  }

  await verifyLogins()
  process.stdout.write('All demo logins verified successfully\n')
  process.stdout.write('Working credentials:\n')
  for (const user of demoUsers) {
    process.stdout.write(`  ${user.loginEmail} / ${user.password}\n`)
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})