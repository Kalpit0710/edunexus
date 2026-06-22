'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { schoolToday } from '@/lib/date-utils'
import {
  weeklyWindow,
  summarizeCollections,
  percent,
  formatINR,
  topDefaulters,
  type DailyAmount,
} from '@/lib/digest-utils'
import { notify } from '@/lib/notifications'
import { WeeklyDigestEmail } from '@/emails/WeeklyDigestEmail'

export interface WeeklyDigestDefaulter {
  studentName: string
  className: string
  balance: number
}

export interface WeeklyDigest {
  schoolName: string
  rangeLabel: string
  start: string
  end: string
  totalCollected: number
  collectionSeries: DailyAmount[]
  attendancePct: number
  totalPendingFees: number
  activeStudents: number
  activeTeachers: number
  topDefaulters: WeeklyDigestDefaulter[]
}

/** "16 – 22 Jun 2026" / cross-month aware label for the 7-day window. */
function rangeLabel(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00Z`)
  const e = new Date(`${end}T00:00:00Z`)
  const opts: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }
  const sameMonth = s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear()
  if (sameMonth) {
    return `${s.getUTCDate()} – ${e.toLocaleDateString('en-IN', opts)}`
  }
  return `${s.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })} – ${e.toLocaleDateString('en-IN', opts)}`
}

/**
 * Build the principal/owner weekly digest for a school (E2.4). Uses the
 * service-role client so it works both from an authenticated dashboard call and
 * from the scheduled cron (no session). Callers that originate from the UI must
 * verify the caller first — see `getWeeklyDigest` / `sendWeeklyDigestEmail`.
 */
async function buildWeeklyDigest(schoolId: string): Promise<WeeklyDigest> {
  const admin = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  const today = schoolToday()
  const { start, end, days } = weeklyWindow(today)

  const [schoolRes, paymentsRes, attendanceRes, studentsRes, teachersRes, pendingRes] =
    await Promise.all([
      db.from('schools').select('name').eq('id', schoolId).maybeSingle(),
      db
        .from('fee_payments')
        .select('payment_date, paid_amount')
        .eq('school_id', schoolId)
        .gte('payment_date', start)
        .lte('payment_date', end),
      db
        .from('attendance_records')
        .select('status')
        .eq('school_id', schoolId)
        .gte('date', start)
        .lte('date', end),
      db
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('is_active', true),
      db
        .from('teachers')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('is_active', true),
      // Aggregated in the DB; the service-role client bypasses RLS so this also
      // works from the session-less cron path.
      db.rpc('get_pending_fees', { p_school_id: schoolId }),
    ])

  const { total: totalCollected, series: collectionSeries } = summarizeCollections(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (paymentsRes.data ?? []) as any[],
    days,
  )

  const attendanceRows = (attendanceRes.data ?? []) as { status: string }[]
  const present = attendanceRows.filter((r) => r.status === 'present').length
  const attendancePct = percent(present, attendanceRows.length)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const defaulters = ((pendingRes.data ?? []) as any[]).map((r) => ({
    studentName: r.student_name as string,
    className: (r.class_name ?? '') as string,
    balance: Number(r.balance),
  }))
  const totalPendingFees = defaulters.reduce((s, d) => s + d.balance, 0)
  const top = topDefaulters(defaulters, 5)

  return {
    schoolName: schoolRes.data?.name ?? 'Your school',
    rangeLabel: rangeLabel(start, end),
    start,
    end,
    totalCollected,
    collectionSeries,
    attendancePct,
    totalPendingFees,
    activeStudents: studentsRes.count ?? 0,
    activeTeachers: teachersRes.count ?? 0,
    topDefaulters: top,
  }
}

/** Verify the session user is an active school_admin of `schoolId`; returns their email. */
async function requireSchoolAdmin(schoolId: string): Promise<{ email: string; recipientId: string }> {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user) throw new Error('Not authenticated.')

  const { data: profile } = await session
    .from('user_profiles')
    .select('id, email, role, school_id, is_active')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (
    !profile ||
    profile.role !== 'school_admin' ||
    profile.school_id !== schoolId ||
    !profile.is_active
  ) {
    throw new Error('Not authorized for this school.')
  }
  return { email: profile.email, recipientId: profile.id }
}

/** On-demand digest for the school-admin dashboard (verifies the caller). */
export async function getWeeklyDigest(schoolId: string): Promise<WeeklyDigest> {
  await requireSchoolAdmin(schoolId)
  return buildWeeklyDigest(schoolId)
}

export interface SendDigestResult {
  success: boolean
  skipped?: boolean
  to?: string
  error?: string
}

/** Email the weekly digest to the requesting school admin. */
export async function sendWeeklyDigestEmail(schoolId: string): Promise<SendDigestResult> {
  let admin: { email: string; recipientId: string }
  try {
    admin = await requireSchoolAdmin(schoolId)
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Not authorized.' }
  }

  const digest = await buildWeeklyDigest(schoolId)

  const result = await notify({
    channel: 'email',
    to: admin.email,
    subject: `Weekly summary — ${digest.schoolName} (${digest.rangeLabel})`,
    react: WeeklyDigestEmail({
      schoolName: digest.schoolName,
      rangeLabel: digest.rangeLabel,
      totalCollected: formatINR(digest.totalCollected),
      attendancePct: digest.attendancePct,
      totalPendingFees: formatINR(digest.totalPendingFees),
      activeStudents: digest.activeStudents,
      activeTeachers: digest.activeTeachers,
      topDefaulters: digest.topDefaulters,
    }),
    schoolId,
    recipientId: admin.recipientId,
    event: 'weekly_digest',
  })

  return { success: result.success, skipped: result.skipped, to: admin.email, error: result.error }
}

/**
 * Cron entry point: build + email the digest for every active school to its
 * active school admins. Guarded by the caller (see the cron route). Uses the
 * service-role client so it runs without a user session.
 */
export async function dispatchAllWeeklyDigests(): Promise<{ schools: number; emailsSent: number }> {
  const admin = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  const { data: schools } = await db
    .from('schools')
    .select('id')
    .eq('is_active', true)
    .neq('subscription_status', 'suspended')

  let emailsSent = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schoolRows = (schools ?? []) as { id: string }[]

  for (const school of schoolRows) {
    const digest = await buildWeeklyDigest(school.id)

    const { data: admins } = await db
      .from('user_profiles')
      .select('id, email')
      .eq('school_id', school.id)
      .eq('role', 'school_admin')
      .eq('is_active', true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const recipient of (admins ?? []) as { id: string; email: string }[]) {
      const result = await notify({
        channel: 'email',
        to: recipient.email,
        subject: `Weekly summary — ${digest.schoolName} (${digest.rangeLabel})`,
        react: WeeklyDigestEmail({
          schoolName: digest.schoolName,
          rangeLabel: digest.rangeLabel,
          totalCollected: formatINR(digest.totalCollected),
          attendancePct: digest.attendancePct,
          totalPendingFees: formatINR(digest.totalPendingFees),
          activeStudents: digest.activeStudents,
          activeTeachers: digest.activeTeachers,
          topDefaulters: digest.topDefaulters,
        }),
        schoolId: school.id,
        recipientId: recipient.id,
        event: 'weekly_digest',
      })
      if (result.success) emailsSent += 1
    }
  }

  return { schools: schoolRows.length, emailsSent }
}
