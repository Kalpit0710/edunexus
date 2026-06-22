// Pure helpers shared by the principal/owner weekly digest (E2.4) and the
// parent "Today" feed (E2.2). No I/O — safe to unit test and import from both
// client and server code.

/** Add `delta` days to a `YYYY-MM-DD` string, returning `YYYY-MM-DD` (UTC-safe). */
export function addDaysISO(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1))
  dt.setUTCDate(dt.getUTCDate() + delta)
  return dt.toISOString().slice(0, 10)
}

export interface WeekWindow {
  /** First day of the window (`YYYY-MM-DD`). */
  start: string
  /** Last day of the window — equal to `todayISO` (`YYYY-MM-DD`). */
  end: string
  /** All 7 days, oldest → newest. */
  days: string[]
}

/** The 7-day window ending on (and including) `todayISO`. */
export function weeklyWindow(todayISO: string): WeekWindow {
  const days: string[] = []
  for (let i = 6; i >= 0; i--) days.push(addDaysISO(todayISO, -i))
  return { start: days[0]!, end: days[days.length - 1]!, days }
}

/** Indian-format currency, e.g. `123456` → `"₹1,23,456"`. Negatives clamp to 0. */
export function formatINR(amount: number): string {
  return `₹${Math.max(0, Math.round(amount)).toLocaleString('en-IN')}`
}

/** Whole-number percentage, guarding divide-by-zero. */
export function percent(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.round((part / whole) * 100)
}

export interface DailyAmount {
  date: string
  /** Short weekday label, e.g. `"Mon"`. */
  label: string
  amount: number
}

/** Bucket payments into a per-day series aligned to `days`, plus a grand total. */
export function summarizeCollections(
  payments: { payment_date: string; paid_amount: number | string | null }[],
  days: string[],
): { total: number; series: DailyAmount[] } {
  const byDay = new Map<string, number>()
  for (const p of payments) {
    if (!p.payment_date) continue
    const amt = Number(p.paid_amount) || 0
    byDay.set(p.payment_date, (byDay.get(p.payment_date) ?? 0) + amt)
  }
  const series: DailyAmount[] = days.map((date) => ({
    date,
    label: new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', {
      weekday: 'short',
      timeZone: 'UTC',
    }),
    amount: byDay.get(date) ?? 0,
  }))
  const total = series.reduce((sum, d) => sum + d.amount, 0)
  return { total, series }
}

/** Top-N rows by outstanding `balance` (descending), without mutating the input. */
export function topDefaulters<T extends { balance: number }>(rows: T[], limit = 5): T[] {
  return [...rows].sort((a, b) => b.balance - a.balance).slice(0, limit)
}

export interface HomeworkLike {
  homeworkDate: string
  dueDate: string | null
}

/** Homework posted for `todayISO`. */
export function pickTodayHomework<T extends HomeworkLike>(rows: T[], todayISO: string): T[] {
  return rows.filter((r) => r.homeworkDate === todayISO)
}

/**
 * Homework still pending: a due date on/after today that wasn't already posted
 * today (so it doesn't duplicate the "today" list), soonest due first.
 */
export function pickUpcomingDue<T extends HomeworkLike>(rows: T[], todayISO: string): T[] {
  return rows
    .filter((r) => r.dueDate != null && r.dueDate >= todayISO && r.homeworkDate !== todayISO)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : a.dueDate! > b.dueDate! ? 1 : 0))
}
