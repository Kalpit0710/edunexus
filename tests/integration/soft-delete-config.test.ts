/**
 * Soft-delete + Restore for config entities — Integration Test (QA Hardening Chunk 1.2)
 * ------------------------------------------------------------------------------------
 * Verifies that soft-deleting a school-configuration row:
 *   - hides it from the owning school-admin's RLS-scoped reads,
 *   - can be restored (clears `deleted_at`) and becomes visible again,
 *   - frees the (school_id, name) slot so the name can be reused while deleted
 *     (partial unique index), and
 *   - never leaks across tenants.
 *
 * The mutations use the service-role client (as the server actions do); the
 * RLS-scoped reads use a signed-in school-admin to prove the policy predicate.
 *
 * Runs against the live Supabase project in `.env.local`; self-skips without
 * credentials and cleans up everything it creates.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

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

const suffix = `${Date.now()}${Math.floor(Math.random() * 100000)}`
const schoolId = crypto.randomUUID()
const otherSchoolId = crypto.randomUUID()
const adminEmail = `sd.admin.${suffix}@e2e.local`
const adminPassword = 'SdTest@1234'
const CLASS_NAME = `Grade ${suffix}`

let admin: SupabaseClient
let anonClient: SupabaseClient
let userClient: SupabaseClient // RLS-scoped, signed-in school admin
let adminAuthUserId: string | null = null
let classId = ''
let otherClassId = ''

/** Can the signed-in school-admin currently SELECT this class (i.e. it is not hidden)? */
async function adminCanSeeClass(id: string): Promise<boolean> {
  const { data, error } = await userClient.from('classes').select('id').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

/** Retry a boolean predicate a few times to absorb any read-after-write propagation. */
async function eventually(predicate: () => Promise<boolean>, expected: boolean): Promise<boolean> {
  for (let attempt = 0; attempt < 5; attempt++) {
    if ((await predicate()) === expected) return expected
    await new Promise((r) => setTimeout(r, 150))
  }
  return predicate()
}

describe.skipIf(!hasCreds)('soft-delete + restore (config entities)', () => {
  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { error: schoolErr } = await admin
      .from('schools')
      .insert([
        { id: schoolId, name: `SD School ${suffix}`, code: `SD${suffix}`, is_active: true },
        { id: otherSchoolId, name: `SD Other ${suffix}`, code: `SDO${suffix}`, is_active: true },
      ])
    if (schoolErr) throw new Error(`Seed schools failed: ${schoolErr.message}`)

    const { data: cls, error: clsErr } = await admin
      .from('classes')
      .insert({ school_id: schoolId, name: CLASS_NAME })
      .select('id')
      .single()
    if (clsErr || !cls) throw new Error(`Seed class failed: ${clsErr?.message}`)
    classId = cls.id

    // A class in a different school, used to prove tenant isolation.
    const { data: oCls, error: oErr } = await admin
      .from('classes')
      .insert({ school_id: otherSchoolId, name: `Other ${suffix}` })
      .select('id')
      .single()
    if (oErr || !oCls) throw new Error(`Seed other class failed: ${oErr?.message}`)
    otherClassId = oCls.id

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
      school_id: schoolId,
      full_name: 'SD School Admin',
      email: adminEmail,
      role: 'school_admin',
      is_active: true,
    })
    if (profileErr) throw new Error(`Create profile failed: ${profileErr.message}`)

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
    await admin.from('classes').delete().eq('school_id', schoolId)
    await admin.from('classes').delete().eq('school_id', otherSchoolId)
    await admin.from('user_profiles').delete().eq('auth_user_id', adminAuthUserId)
    await admin.from('schools').delete().eq('id', schoolId)
    await admin.from('schools').delete().eq('id', otherSchoolId)
    if (adminAuthUserId) await admin.auth.admin.deleteUser(adminAuthUserId)
  }, 60000)

  it('shows a live class to its school-admin', async () => {
    expect(await eventually(() => adminCanSeeClass(classId), true)).toBe(true)
  })

  it('hides the row after soft-delete, then shows it again after restore', async () => {
    // Soft-delete (service-role, school-scoped — as the action does).
    const { error: delErr } = await admin
      .from('classes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', classId)
      .eq('school_id', schoolId)
    expect(delErr).toBeNull()

    expect(await eventually(() => adminCanSeeClass(classId), false)).toBe(false)

    // Restore.
    const { error: resErr } = await admin
      .from('classes')
      .update({ deleted_at: null })
      .eq('id', classId)
      .eq('school_id', schoolId)
    expect(resErr).toBeNull()

    expect(await eventually(() => adminCanSeeClass(classId), true)).toBe(true)
  })

  it('frees the (school_id, name) slot so a deleted name can be reused', async () => {
    // Soft-delete the original.
    const { error: delErr } = await admin
      .from('classes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', classId)
      .eq('school_id', schoolId)
    expect(delErr).toBeNull()

    // Creating another class with the SAME name must now succeed.
    const { data: dup, error: dupErr } = await admin
      .from('classes')
      .insert({ school_id: schoolId, name: CLASS_NAME })
      .select('id')
      .single()
    expect(dupErr).toBeNull()
    expect(dup?.id).toBeTruthy()
  })

  it('never exposes another school\'s class to this admin', async () => {
    expect(await adminCanSeeClass(otherClassId)).toBe(false)
  })
})
