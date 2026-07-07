'use server'

/**
 * Fee-reminder dispatch (rebuild of the deleted B0.2 cron, done properly).
 *
 * Sources outstanding balances from the `get_pending_fees` RPC (the same
 * aggregation the dashboard/digest uses) and emails each defaulter's parent via
 * the channel-agnostic `notify()` dispatcher. Uses the service-role client so it
 * runs both from an authenticated dashboard button and from the session-less
 * cron; UI entry points re-verify the caller first.
 *
 * Pure list/format/summarize logic lives in `@/lib/fee-reminder-utils` (unit
 * tested). WhatsApp delivery is a drop-in once that channel is configured
 * (Part 6) — switch `channel: 'email'` to fan out, no other change needed.
 */
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { notify, type NotificationChannel } from '@/lib/notifications'
import { FeeReminderEmail } from '@/emails/FeeReminderEmail'
import {
  pickReminderRecipient,
  formatReminderAmount,
  summarizeReminderRun,
  type ReminderParent,
  type ReminderRunResult,
} from '@/lib/fee-reminder-utils'

interface PendingFeeRow {
  student_id: string
  student_name: string
  class_name: string | null
  balance: number
}

interface ReminderParentContact extends ReminderParent {
  phone: string | null
}

function pickReminderPhoneRecipient(parents: ReminderParentContact[]): { name: string; phone: string } | null {
  const primary = parents.find((parent) => parent.is_primary && parent.phone)
  if (primary?.phone) {
    return { name: primary.full_name || 'Parent', phone: primary.phone }
  }

  const fallback = parents.find((parent) => parent.phone)
  return fallback?.phone ? { name: fallback.full_name || 'Parent', phone: fallback.phone } : null
}

/**
 * Build + send fee reminders for one school. Service-role (no session) so it is
 * safe to call from the cron. Callers from the UI must verify the user first.
 */
async function sendSchoolFeeReminders(
  schoolId: string,
  channels: NotificationChannel[] = ['email'],
): Promise<ReminderRunResult> {
  const admin = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  const [schoolRes, pendingRes] = await Promise.all([
    db.from('schools').select('name, currency_symbol').eq('id', schoolId).maybeSingle(),
    db.rpc('get_pending_fees', { p_school_id: schoolId }),
  ])

  const schoolName = (schoolRes.data?.name as string) ?? 'Your school'
  const symbol = (schoolRes.data?.currency_symbol as string) ?? '₹'
  const pending = (pendingRes.data ?? []) as PendingFeeRow[]
  if (pending.length === 0) return { sent: 0, skipped: 0, failed: 0 }

  const studentIds = pending.map((p) => p.student_id)
  const { data: parentRows } = await db
    .from('parents')
    .select('student_id, full_name, email, phone, is_primary')
    .eq('school_id', schoolId)
    .in('student_id', studentIds)

  const parentsByStudent = new Map<string, ReminderParentContact[]>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (parentRows ?? []) as any[]) {
    const list = parentsByStudent.get(r.student_id) ?? []
    list.push({ full_name: r.full_name, email: r.email, phone: r.phone, is_primary: r.is_primary })
    parentsByStudent.set(r.student_id, list)
  }

  const outcomes: { success: boolean; skipped?: boolean }[] = []
  for (const row of pending) {
    const parents = parentsByStudent.get(row.student_id) ?? []

    if (channels.includes('email')) {
      const recipient = pickReminderRecipient(parents)
      if (!recipient) {
        outcomes.push({ success: false, skipped: true })
      } else {
        const result = await notify({
          channel: 'email',
          to: recipient.email,
          subject: `Fee reminder — ${row.student_name} (${schoolName})`,
          react: FeeReminderEmail({
            parentName: recipient.name,
            studentName: row.student_name,
            schoolName,
            feeName: 'Total Outstanding Fees',
            amountDue: formatReminderAmount(Number(row.balance), symbol),
            dueDate: 'At your earliest convenience',
          }),
          schoolId,
          event: 'fee_reminder',
        })
        outcomes.push({ success: result.success, skipped: result.skipped })
      }
    }

    if (channels.includes('whatsapp')) {
      const recipient = pickReminderPhoneRecipient(parents)
      if (!recipient) {
        outcomes.push({ success: false, skipped: true })
      } else {
        const result = await notify({
          channel: 'whatsapp',
          to: recipient.phone,
          body: `${schoolName}: ${row.student_name} has an outstanding balance of ${formatReminderAmount(Number(row.balance), symbol)}. Please clear it at your earliest convenience.`,
          schoolId,
          event: 'fee_reminder',
        })
        outcomes.push({ success: result.success, skipped: result.skipped })
      }
    }
  }

  return summarizeReminderRun(outcomes)
}

/** Verify the session user is an active school_admin of `schoolId`. */
async function requireSchoolAdmin(schoolId: string): Promise<void> {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user) throw new Error('Not authenticated.')

  const { data: profile } = await session
    .from('user_profiles')
    .select('role, school_id, is_active')
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
}

export interface SendRemindersResult extends ReminderRunResult {
  success: boolean
  error?: string
}

/**
 * On-demand fee reminders for the school-admin dashboard (verifies the caller).
 * Emails every current defaulter's parent and returns a run summary.
 */
import { ensureRateLimit } from '@/lib/rate-limit'
export async function sendFeeRemindersNow(
  schoolId: string,
  channels: NotificationChannel[] = ['email'],
): Promise<SendRemindersResult> {
  let authUserId: string | null = null
  try {
    await requireSchoolAdmin(schoolId)
    const session = await createClient()
    const {
      data: { user },
    } = await session.auth.getUser()
    authUserId = user?.id ?? null
  } catch (err) {
    return {
      success: false,
      sent: 0,
      skipped: 0,
      failed: 0,
      error: err instanceof Error ? err.message : 'Not authorized.',
    }
  }

  try {
    if (authUserId) {
      await ensureRateLimit(`${authUserId}:${schoolId}`, {
        name: 'fee-reminders',
        limit: 3,
        windowSeconds: 600,
        message: 'Fee reminders were sent recently. Please wait a few minutes before sending again.',
      })
    }
    const summary = await sendSchoolFeeReminders(schoolId, channels)
    return { success: true, ...summary }
  } catch (err) {
    return {
      success: false,
      sent: 0,
      skipped: 0,
      failed: 0,
      error: err instanceof Error ? err.message : 'Failed to send reminders.',
    }
  }
}

/**
 * Cron entry point: send fee reminders for every active, non-suspended school.
 * Guarded by the caller (see the cron route). Service-role, session-less.
 */
export async function dispatchAllFeeReminders(): Promise<{
  schools: number
  sent: number
  skipped: number
  failed: number
}> {
  const admin = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  const { data: schools } = await db
    .from('schools')
    .select('id')
    .eq('is_active', true)
    .neq('subscription_status', 'suspended')

  const schoolRows = (schools ?? []) as { id: string }[]
  let sent = 0
  let skipped = 0
  let failed = 0

  for (const school of schoolRows) {
    const summary = await sendSchoolFeeReminders(school.id, ['email'])
    sent += summary.sent
    skipped += summary.skipped
    failed += summary.failed
  }

  return { schools: schoolRows.length, sent, skipped, failed }
}
