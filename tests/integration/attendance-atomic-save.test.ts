/**
 * Atomic Attendance Save — Integration Test (QA Hardening Chunk 1.1)
 * ------------------------------------------------------------------
 * Verifies the `save_attendance_atomic` RPC performs a clean, transactional
 * delete-then-insert for a given date/class/section:
 *   - first save inserts all submitted rows,
 *   - a re-save REPLACES the day (no stale rows for deselected students),
 *   - an empty payload clears the day,
 *   - it is permission-scoped to the caller's school.
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
const adminEmail = `att.admin.${suffix}@e2e.local`
const adminPassword = 'AttTest@1234'
const TEST_DATE = '2026-06-01'

let admin: SupabaseClient
let anonClient: SupabaseClient
let userClient: SupabaseClient // RLS-scoped, signed-in school admin
let adminAuthUserId: string | null = null
let markedBy = '' // user_profiles.id
let classId = ''
let sectionId = ''
let studentA = ''
let studentB = ''

// Read back through the SAME signed-in client that performed the write to get
// read-your-writes consistency (avoids cross-client read-after-write lag).
async function countForDay(): Promise<number> {
  const { count, error } = await userClient
    .from('attendance_records')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('section_id', sectionId)
    .eq('date', TEST_DATE)
  if (error) throw new Error(error.message)
  return count ?? 0
}

describe.skipIf(!hasCreds)('save_attendance_atomic RPC', () => {
  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { error: schoolErr } = await admin
      .from('schools')
      .insert({ id: schoolId, name: `Att School ${suffix}`, code: `ATT${suffix}`, is_active: true })
    if (schoolErr) throw new Error(`Seed school failed: ${schoolErr.message}`)

    const { data: cls, error: clsErr } = await admin
      .from('classes')
      .insert({ school_id: schoolId, name: `Class ${suffix}` })
      .select('id')
      .single()
    if (clsErr || !cls) throw new Error(`Seed class failed: ${clsErr?.message}`)
    classId = cls.id

    const { data: sec, error: secErr } = await admin
      .from('sections')
      .insert({ school_id: schoolId, class_id: classId, name: `Sec ${suffix}` })
      .select('id')
      .single()
    if (secErr || !sec) throw new Error(`Seed section failed: ${secErr?.message}`)
    sectionId = sec.id

    const { data: studs, error: studErr } = await admin
      .from('students')
      .insert([
        { school_id: schoolId, admission_number: `A-${suffix}`, full_name: 'Alice A', class_id: classId, section_id: sectionId },
        { school_id: schoolId, admission_number: `B-${suffix}`, full_name: 'Bob B', class_id: classId, section_id: sectionId },
      ])
      .select('id, admission_number')
    if (studErr || !studs) throw new Error(`Seed students failed: ${studErr?.message}`)
    studentA = studs.find((s) => s.admission_number === `A-${suffix}`)!.id
    studentB = studs.find((s) => s.admission_number === `B-${suffix}`)!.id

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      app_metadata: { role: 'school_admin' },
    })
    if (createErr || !created.user) throw new Error(`Create auth user failed: ${createErr?.message}`)
    adminAuthUserId = created.user.id

    const { data: profile, error: profileErr } = await admin
      .from('user_profiles')
      .insert({
        auth_user_id: adminAuthUserId,
        school_id: schoolId,
        full_name: 'Att School Admin',
        email: adminEmail,
        role: 'school_admin',
        is_active: true,
      })
      .select('id')
      .single()
    if (profileErr || !profile) throw new Error(`Create profile failed: ${profileErr?.message}`)
    markedBy = profile.id

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
    await admin.from('attendance_records').delete().eq('school_id', schoolId)
    await admin.from('user_profiles').delete().eq('auth_user_id', adminAuthUserId)
    await admin.from('schools').delete().eq('id', schoolId)
    if (adminAuthUserId) await admin.auth.admin.deleteUser(adminAuthUserId)
  }, 60000)

  it('inserts all submitted rows on first save', async () => {
    const { error } = await (userClient as unknown as { rpc: Function }).rpc('save_attendance_atomic', {
      p_school_id: schoolId,
      p_class_id: classId,
      p_section_id: sectionId,
      p_date: TEST_DATE,
      p_marked_by: markedBy,
      p_records: [
        { student_id: studentA, status: 'present', remarks: null },
        { student_id: studentB, status: 'absent', remarks: 'Sick' },
      ],
    })
    expect(error).toBeNull()
    expect(await countForDay()).toBe(2)
  })

  it('REPLACES the day on re-save (no stale rows for deselected students)', async () => {
    const { error } = await (userClient as unknown as { rpc: Function }).rpc('save_attendance_atomic', {
      p_school_id: schoolId,
      p_class_id: classId,
      p_section_id: sectionId,
      p_date: TEST_DATE,
      p_marked_by: markedBy,
      p_records: [{ student_id: studentA, status: 'late', remarks: null }],
    })
    expect(error).toBeNull()
    expect(await countForDay()).toBe(1)

    const { data } = await userClient
      .from('attendance_records')
      .select('student_id, status')
      .eq('school_id', schoolId)
      .eq('section_id', sectionId)
      .eq('date', TEST_DATE)
    expect(data).toEqual([{ student_id: studentA, status: 'late' }])
  })

  it('clears the day when given an empty payload', async () => {
    const { error } = await (userClient as unknown as { rpc: Function }).rpc('save_attendance_atomic', {
      p_school_id: schoolId,
      p_class_id: classId,
      p_section_id: sectionId,
      p_date: TEST_DATE,
      p_marked_by: markedBy,
      p_records: [],
    })
    expect(error).toBeNull()
    expect(await countForDay()).toBe(0)
  })

  it('forbids saving attendance for another school', async () => {
    const otherSchool = crypto.randomUUID()
    const { error } = await (userClient as unknown as { rpc: Function }).rpc('save_attendance_atomic', {
      p_school_id: otherSchool,
      p_class_id: classId,
      p_section_id: sectionId,
      p_date: TEST_DATE,
      p_marked_by: markedBy,
      p_records: [{ student_id: studentA, status: 'present', remarks: null }],
    })
    expect(error).not.toBeNull()
  })
})
