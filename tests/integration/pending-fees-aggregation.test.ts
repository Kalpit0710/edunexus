/**
 * Pending Fees Aggregation — Integration Test (QA Hardening Chunk 4.2)
 * -------------------------------------------------------------------
 * Verifies the `get_pending_fees` RPC, which moved the pending-fee
 * aggregation from in-memory JS into SQL:
 *   - returns only students with a positive balance,
 *   - computes totalFee (class fee structures) − totalPaid (all payments),
 *   - excludes fully-paid and inactive students,
 *   - is permission-scoped to the caller's school (tenant isolation).
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
const adminEmail = `pf.admin.${suffix}@e2e.local`
const adminPassword = 'PfTest@1234'

let admin: SupabaseClient
let anonClient: SupabaseClient
let userClient: SupabaseClient // RLS-scoped, signed-in school admin
let adminAuthUserId: string | null = null
let profileId = ''
let classId = ''
let sectionId = ''
let studentOwes = '' // partial payment → should appear
let studentPaid = '' // fully paid → should NOT appear
let studentInactive = '' // owes but inactive → should NOT appear

interface PendingRow {
  student_id: string
  student_name: string
  admission_number: string
  class_name: string
  section_name: string
  total_fee: number | string
  total_paid: number | string
  balance: number | string
}

async function callPendingFees(client: SupabaseClient, sid: string) {
  return (client as unknown as { rpc: Function }).rpc('get_pending_fees', { p_school_id: sid }) as Promise<{
    data: PendingRow[] | null
    error: { message: string } | null
  }>
}

describe.skipIf(!hasCreds)('get_pending_fees RPC', () => {
  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { error: schoolErr } = await admin
      .from('schools')
      .insert({ id: schoolId, name: `PF School ${suffix}`, code: `PF${suffix}`, is_active: true })
    if (schoolErr) throw new Error(`Seed school failed: ${schoolErr.message}`)

    const { data: year, error: yearErr } = await admin
      .from('academic_years')
      .insert({
        school_id: schoolId,
        name: `Year ${suffix}`,
        start_date: '2026-04-01',
        end_date: '2027-03-31',
        is_current: true,
      })
      .select('id')
      .single()
    if (yearErr || !year) throw new Error(`Seed academic year failed: ${yearErr?.message}`)
    const yearId = year.id

    const { data: category, error: catErr } = await admin
      .from('fee_categories')
      .insert({ school_id: schoolId, name: `Tuition ${suffix}` })
      .select('id')
      .single()
    if (catErr || !category) throw new Error(`Seed fee category failed: ${catErr?.message}`)

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

    // Class fee = 1000 (single structure for this class/year).
    const { error: fsErr } = await admin.from('fee_structures').insert({
      school_id: schoolId,
      class_id: classId,
      category_id: category.id,
      academic_year_id: yearId,
      amount: 1000,
      is_active: true,
    })
    if (fsErr) throw new Error(`Seed fee structure failed: ${fsErr.message}`)

    const { data: studs, error: studErr } = await admin
      .from('students')
      .insert([
        { school_id: schoolId, admission_number: `OWE-${suffix}`, full_name: 'Owes Money', class_id: classId, section_id: sectionId, is_active: true },
        { school_id: schoolId, admission_number: `PAID-${suffix}`, full_name: 'Fully Paid', class_id: classId, section_id: sectionId, is_active: true },
        { school_id: schoolId, admission_number: `INACT-${suffix}`, full_name: 'Inactive Owes', class_id: classId, section_id: sectionId, is_active: false },
      ])
      .select('id, admission_number')
    if (studErr || !studs) throw new Error(`Seed students failed: ${studErr?.message}`)
    studentOwes = studs.find((s) => s.admission_number === `OWE-${suffix}`)!.id
    studentPaid = studs.find((s) => s.admission_number === `PAID-${suffix}`)!.id
    studentInactive = studs.find((s) => s.admission_number === `INACT-${suffix}`)!.id

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
        full_name: 'PF School Admin',
        email: adminEmail,
        role: 'school_admin',
        is_active: true,
      })
      .select('id')
      .single()
    if (profileErr || !profile) throw new Error(`Create profile failed: ${profileErr?.message}`)
    profileId = profile.id

    // Payments: Owes pays 400 (balance 600); Paid pays full 1000 (balance 0);
    // Inactive pays nothing (owes 1000 but is inactive → excluded).
    const { error: payErr } = await admin.from('fee_payments').insert([
      {
        school_id: schoolId, student_id: studentOwes, receipt_number: `RCPT-${suffix}-1`,
        total_amount: 400, paid_amount: 400, payment_mode: 'cash', payment_date: '2026-05-01', collected_by: profileId,
      },
      {
        school_id: schoolId, student_id: studentPaid, receipt_number: `RCPT-${suffix}-2`,
        total_amount: 1000, paid_amount: 1000, payment_mode: 'cash', payment_date: '2026-05-02', collected_by: profileId,
      },
    ])
    if (payErr) throw new Error(`Seed payments failed: ${payErr.message}`)

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
    await admin.from('fee_payments').delete().eq('school_id', schoolId)
    await admin.from('user_profiles').delete().eq('auth_user_id', adminAuthUserId)
    await admin.from('schools').delete().eq('id', schoolId)
    if (adminAuthUserId) await admin.auth.admin.deleteUser(adminAuthUserId)
  }, 60000)

  it('returns only the student with a positive balance, with correct totals', async () => {
    const { data, error } = await callPendingFees(userClient, schoolId)
    expect(error).toBeNull()
    const rows = data ?? []

    const owes = rows.find((r) => r.student_id === studentOwes)
    expect(owes).toBeTruthy()
    expect(Number(owes!.total_fee)).toBe(1000)
    expect(Number(owes!.total_paid)).toBe(400)
    expect(Number(owes!.balance)).toBe(600)
    expect(owes!.class_name).toContain('Class')
  })

  it('excludes a fully-paid student', async () => {
    const { data } = await callPendingFees(userClient, schoolId)
    expect((data ?? []).some((r) => r.student_id === studentPaid)).toBe(false)
  })

  it('excludes an inactive student even if they owe', async () => {
    const { data } = await callPendingFees(userClient, schoolId)
    expect((data ?? []).some((r) => r.student_id === studentInactive)).toBe(false)
  })

  it('blocks reading another school’s pending fees (tenant isolation)', async () => {
    const { error } = await callPendingFees(userClient, crypto.randomUUID())
    expect(error).not.toBeNull()
    expect(error?.message ?? '').toMatch(/another school/i)
  })
})
