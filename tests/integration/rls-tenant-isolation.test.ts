/**
 * RLS Tenant-Isolation Integration Tests
 * ----------------------------------------
 * These tests run against the live Supabase project configured in `.env.local`.
 * They provision two isolated schools (A and B), sign in as a School A admin,
 * and assert that PostgreSQL Row-Level Security prevents any cross-tenant access.
 *
 * The suite self-skips when Supabase credentials are not available (e.g. CI
 * without secrets) and fully cleans up every row + auth user it creates.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// ── Load .env.local (vitest does not load it automatically) ─────────────────
function loadEnv(): Record<string, string> {
  try {
    const envPath = resolve(process.cwd(), '.env.local')
    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)
    return Object.fromEntries(
      lines
        .filter((line) => /^\s*[^#]\S+=/.test(line))
        .map((line) => {
          const [key = '', ...value] = line.split('=')
          return [key.trim(), value.join('=').trim()]
        })
    )
  } catch {
    return {}
  }
}

const env = loadEnv()
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const SERVICE_ROLE_KEY =
  env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const hasCreds = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY)

// Unique suffix so parallel/repeat runs never collide on UNIQUE constraints.
const suffix = `${Date.now()}${Math.floor(Math.random() * 100000)}`

const schoolA = crypto.randomUUID()
const schoolB = crypto.randomUUID()
const adminEmail = `rls.admin.${suffix}@e2e.local`
const adminPassword = 'RlsTest@1234'

let admin: SupabaseClient
let userClient: SupabaseClient // School A admin, RLS-scoped
let anonClient: SupabaseClient // unauthenticated
let adminAuthUserId: string | null = null
let classAId = ''
let classBId = ''

describe.skipIf(!hasCreds)('RLS tenant isolation', () => {
  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1) Two isolated schools.
    const { error: schoolErr } = await admin.from('schools').insert([
      { id: schoolA, name: `RLS School A ${suffix}`, code: `RLSA${suffix}`, is_active: true },
      { id: schoolB, name: `RLS School B ${suffix}`, code: `RLSB${suffix}`, is_active: true },
    ])
    if (schoolErr) throw new Error(`Seed schools failed: ${schoolErr.message}`)

    // 2) A class + student in each school.
    const { data: classes, error: classErr } = await admin
      .from('classes')
      .insert([
        { school_id: schoolA, name: `Class A ${suffix}` },
        { school_id: schoolB, name: `Class B ${suffix}` },
      ])
      .select('id, school_id')
    if (classErr || !classes) throw new Error(`Seed classes failed: ${classErr?.message}`)
    classAId = classes.find((c) => c.school_id === schoolA)!.id
    classBId = classes.find((c) => c.school_id === schoolB)!.id

    const { error: studentErr } = await admin.from('students').insert([
      { school_id: schoolA, admission_number: `A-${suffix}`, full_name: 'Alice A', class_id: classAId },
      { school_id: schoolB, admission_number: `B-${suffix}`, full_name: 'Bob B', class_id: classBId },
    ])
    if (studentErr) throw new Error(`Seed students failed: ${studentErr.message}`)

    // 3) Auth user + profile as School A admin.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      app_metadata: { role: 'school_admin' },
    })
    if (createErr || !created.user) throw new Error(`Create auth user failed: ${createErr?.message}`)
    adminAuthUserId = created.user.id

    const { error: profileErr } = await admin.from('user_profiles').insert({
      auth_user_id: adminAuthUserId,
      school_id: schoolA,
      full_name: 'RLS School A Admin',
      email: adminEmail,
      role: 'school_admin',
      is_active: true,
    })
    if (profileErr) throw new Error(`Create profile failed: ${profileErr.message}`)

    // 4) Sign in → build an RLS-scoped client carrying the user's JWT.
    const { data: session, error: signInErr } = await anonClient.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    })
    if (signInErr || !session.session) throw new Error(`Sign in failed: ${signInErr?.message}`)

    userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${session.session.access_token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }, 60000)

  afterAll(async () => {
    if (!hasCreds || !admin) return
    // Schools cascade-delete classes/students/sections; remove profile + auth user explicitly.
    await admin.from('user_profiles').delete().eq('auth_user_id', adminAuthUserId)
    await admin.from('schools').delete().in('id', [schoolA, schoolB])
    if (adminAuthUserId) await admin.auth.admin.deleteUser(adminAuthUserId)
  }, 60000)

  it('lets a school admin read their OWN school', async () => {
    const { data, error } = await userClient.from('schools').select('id').eq('id', schoolA)
    expect(error).toBeNull()
    expect(data?.map((r) => r.id)).toContain(schoolA)
  })

  it('blocks reading ANOTHER school row', async () => {
    const { data, error } = await userClient.from('schools').select('id').eq('id', schoolB)
    expect(error).toBeNull()
    expect(data).toEqual([]) // RLS filters out the other tenant
  })

  it('only returns own school when listing all schools', async () => {
    const { data, error } = await userClient.from('schools').select('id')
    expect(error).toBeNull()
    const ids = data?.map((r) => r.id) ?? []
    expect(ids).toContain(schoolA)
    expect(ids).not.toContain(schoolB)
  })

  it('reads own classes but not the other tenant classes', async () => {
    const own = await userClient.from('classes').select('id').eq('school_id', schoolA)
    expect(own.error).toBeNull()
    expect(own.data?.map((r) => r.id)).toContain(classAId)

    const other = await userClient.from('classes').select('id').eq('school_id', schoolB)
    expect(other.error).toBeNull()
    expect(other.data).toEqual([])
  })

  it('reads own students but not the other tenant students', async () => {
    const own = await userClient.from('students').select('id, admission_number').eq('school_id', schoolA)
    expect(own.error).toBeNull()
    expect(own.data?.length).toBe(1)

    const other = await userClient.from('students').select('id').eq('school_id', schoolB)
    expect(other.error).toBeNull()
    expect(other.data).toEqual([])
  })

  it('forbids INSERTING a class into another school (RLS WITH CHECK)', async () => {
    const { data, error } = await userClient
      .from('classes')
      .insert({ school_id: schoolB, name: `Intruder ${suffix}` })
      .select('id')
    // RLS must reject: either an error is returned or no row is inserted.
    expect(error === null && (data?.length ?? 0) > 0).toBe(false)

    // Confirm via service role that nothing landed in school B.
    const { data: check } = await admin
      .from('classes')
      .select('id')
      .eq('school_id', schoolB)
      .eq('name', `Intruder ${suffix}`)
    expect(check).toEqual([])
  })

  it('returns NOTHING to an unauthenticated client', async () => {
    // Brand-new client that has never signed in (anonClient holds the admin's
    // in-memory session from the sign-in step, so it is not anonymous).
    const freshAnon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await freshAnon.from('schools').select('id').eq('id', schoolA)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })
})

// ── Cross-role authorization (RLS by role within a tenant) ───────────────────
describe.skipIf(!hasCreds)('RLS role authorization', () => {
  const roleSchoolId = crypto.randomUUID()
  const parentEmail = `rls.parent.${suffix}@e2e.local`
  const parentPassword = 'RlsParent@1234'
  let roleAdmin: SupabaseClient
  let parentClient: SupabaseClient
  let parentAuthId: string | null = null

  beforeAll(async () => {
    roleAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    await roleAdmin
      .from('schools')
      .insert({ id: roleSchoolId, name: `RLS Role School ${suffix}`, code: `RLSR${suffix}`, is_active: true })

    const { data: created, error: createErr } = await roleAdmin.auth.admin.createUser({
      email: parentEmail,
      password: parentPassword,
      email_confirm: true,
      app_metadata: { role: 'parent' },
    })
    if (createErr || !created.user) throw new Error(`Create parent failed: ${createErr?.message}`)
    parentAuthId = created.user.id

    const { error: profileErr } = await roleAdmin.from('user_profiles').insert({
      auth_user_id: parentAuthId,
      school_id: roleSchoolId,
      full_name: 'RLS Parent',
      email: parentEmail,
      role: 'parent',
      is_active: true,
    })
    if (profileErr) throw new Error(`Create parent profile failed: ${profileErr.message}`)

    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: session, error: signErr } = await anon.auth.signInWithPassword({
      email: parentEmail,
      password: parentPassword,
    })
    if (signErr || !session.session) throw new Error(`Parent sign in failed: ${signErr?.message}`)

    parentClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${session.session.access_token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }, 60000)

  afterAll(async () => {
    if (!hasCreds || !roleAdmin) return
    await roleAdmin.from('user_profiles').delete().eq('auth_user_id', parentAuthId)
    await roleAdmin.from('schools').delete().eq('id', roleSchoolId)
    if (parentAuthId) await roleAdmin.auth.admin.deleteUser(parentAuthId)
  }, 60000)

  it('forbids a parent from creating a report subject config (role RLS WITH CHECK)', async () => {
    const { data, error } = await parentClient
      .from('report_subject_configs')
      .insert({ school_id: roleSchoolId, class_id: roleSchoolId, subject_id: roleSchoolId })
      .select('id')
    expect(error === null && (data?.length ?? 0) > 0).toBe(false)

    const { data: check } = await roleAdmin
      .from('report_subject_configs')
      .select('id')
      .eq('school_id', roleSchoolId)
    expect(check).toEqual([])
  })

  it('forbids a parent from creating an inventory item (role RLS WITH CHECK)', async () => {
    const { data, error } = await parentClient
      .from('inventory_items')
      .insert({ school_id: roleSchoolId, name: `Hack Item ${suffix}`, unit_price: 1 })
      .select('id')
    expect(error === null && (data?.length ?? 0) > 0).toBe(false)

    const { data: check } = await roleAdmin
      .from('inventory_items')
      .select('id')
      .eq('school_id', roleSchoolId)
    expect(check).toEqual([])
  })
})
