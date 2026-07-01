/**
 * Pure helpers for the fee-reminder feature (rebuild of the deleted cron, B0.2
 * follow-up). Kept side-effect free so they can be unit-tested without a DB or
 * mailer. The actual sending lives in
 * `app/(school-admin)/school-admin/fees/reminder-actions.ts`.
 */

export interface ReminderParent {
  full_name: string | null
  email: string | null
  is_primary: boolean
}

/**
 * Choose the best email to send a child's fee reminder to: the primary parent
 * with an email wins, otherwise the first parent that has an email. Returns
 * `null` when no parent has a usable email (the student is then skipped).
 */
export function pickReminderRecipient(
  parents: ReminderParent[],
): { name: string; email: string } | null {
  const withEmail = parents.filter((p) => p.email && p.email.trim().length > 0)
  const chosen = withEmail.find((p) => p.is_primary) ?? withEmail[0]
  if (!chosen || !chosen.email) return null
  return { name: chosen.full_name?.trim() || 'Parent/Guardian', email: chosen.email.trim() }
}

/** Format an outstanding balance with the school's currency symbol (default ₹). */
export function formatReminderAmount(balance: number, symbol = '₹'): string {
  const safe = Number.isFinite(balance) ? Math.max(0, Math.round(balance)) : 0
  return `${symbol}${safe.toLocaleString('en-IN')}`
}

export interface ReminderRunResult {
  sent: number
  skipped: number
  failed: number
}

/** Roll up per-student send outcomes into a single summary for logging/UI. */
export function summarizeReminderRun(
  outcomes: { success: boolean; skipped?: boolean }[],
): ReminderRunResult {
  return outcomes.reduce<ReminderRunResult>(
    (acc, o) => {
      if (o.success) acc.sent += 1
      else if (o.skipped) acc.skipped += 1
      else acc.failed += 1
      return acc
    },
    { sent: 0, skipped: 0, failed: 0 },
  )
}
