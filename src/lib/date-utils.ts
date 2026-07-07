// Timezone-aware calendar-date helpers (Tier 0 · B0.3).
//
// The app previously derived "today" with `new Date().toISOString().split('T')[0]`,
// which yields the **UTC** calendar date. For a school operating in IST that is
// wrong for several hours each evening (e.g. 23:30 IST is already the next UTC
// day), which mis-keys attendance/fee records and skews day/month reports.
//
// These helpers format a calendar date in a specific IANA timezone instead.
// `Intl` is available in both the browser and Node, so this module is safe to
// import from client and server components alike.

/**
 * Default school timezone. Override per deployment via
 * `NEXT_PUBLIC_DEFAULT_TIMEZONE` (e.g. "Asia/Kolkata"). Per-school timezones are
 * a future enhancement (store on `schools` and pass it through).
 */
export const DEFAULT_TIMEZONE = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE || 'Asia/Kolkata'

export function resolveTimeZone(timeZone?: string | null): string {
  if (!timeZone?.trim()) return DEFAULT_TIMEZONE

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
    return timeZone
  } catch {
    return DEFAULT_TIMEZONE
  }
}

/**
 * The calendar date (`YYYY-MM-DD`) of `instant` as seen in `timeZone`.
 * Uses the `en-CA` locale, which formats dates as ISO `YYYY-MM-DD`.
 */
export function localDateISO(instant: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): string {
  const safeTimeZone = resolveTimeZone(timeZone)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
}

/** Today's calendar date (`YYYY-MM-DD`) in the school's timezone. */
export function schoolToday(timeZone: string = DEFAULT_TIMEZONE): string {
  return localDateISO(new Date(), timeZone)
}
