// Timetable helpers — pure logic shared by admin / teacher / parent views.

export interface Weekday {
  value: number // ISO day-of-week, Mon=1 … Sun=7
  short: string
  full: string
}

export const WEEKDAYS: Weekday[] = [
  { value: 1, short: 'Mon', full: 'Monday' },
  { value: 2, short: 'Tue', full: 'Tuesday' },
  { value: 3, short: 'Wed', full: 'Wednesday' },
  { value: 4, short: 'Thu', full: 'Thursday' },
  { value: 5, short: 'Fri', full: 'Friday' },
  { value: 6, short: 'Sat', full: 'Saturday' },
  { value: 7, short: 'Sun', full: 'Sunday' },
]

/** Default working week for primary schools (Mon–Sat). */
export const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5, 6]

export function weekdayLabel(value: number, long = false): string {
  const d = WEEKDAYS.find((w) => w.value === value)
  return d ? (long ? d.full : d.short) : ''
}

/** "09:00" → "9:00 AM"; tolerant of "HH:MM[:SS]" and null. */
export function formatTime(time: string | null | undefined): string {
  if (!time) return ''
  const [hStr, mStr] = time.split(':')
  const h = Number(hStr)
  const m = Number(mStr)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

/** "09:00–09:40" style range; collapses gracefully when a side is missing. */
export function formatPeriodRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const s = formatTime(start)
  const e = formatTime(end)
  if (s && e) return `${s} – ${e}`
  return s || e || ''
}

/** Validate a start/end pair. Returns an error message, or null when valid. */
export function validatePeriodTimes(
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  if (!start && !end) return null // both empty is allowed (unscheduled)
  if (!start || !end) return 'Provide both a start and end time, or leave both blank.'
  if (end <= start) return 'End time must be after the start time.'
  return null
}

/**
 * Do two time ranges overlap? "HH:MM" strings compare lexicographically, so we
 * can compare them directly. A range with a missing side can't be checked, so
 * it's treated as non-overlapping (unscheduled rows are allowed to coexist).
 */
export function periodsOverlap(
  aStart: string | null | undefined,
  aEnd: string | null | undefined,
  bStart: string | null | undefined,
  bEnd: string | null | undefined,
): boolean {
  if (!aStart || !aEnd || !bStart || !bEnd) return false
  // Touching edges (one ends exactly when the next starts) is NOT an overlap.
  return aStart < bEnd && bStart < aEnd
}

/**
 * Clean a stored/working-days array: keep only valid ISO weekdays (1–7), drop
 * duplicates, sort ascending, and fall back to the default week when empty.
 */
export function normalizeWorkingDays(days: number[] | null | undefined): number[] {
  const valid = Array.from(new Set((days ?? []).filter((d) => d >= 1 && d <= 7))).sort(
    (a, b) => a - b,
  )
  return valid.length > 0 ? valid : [...DEFAULT_WORKING_DAYS]
}

export interface ConflictEntry {
  entryId: string
  sectionId: string
  sectionLabel: string
  dayOfWeek: number
  periodId: string
  periodName: string
  teacherId: string | null
  teacherName: string | null
}

export interface TeacherConflict {
  teacherId: string
  teacherName: string
  dayOfWeek: number
  periodId: string
  periodName: string
  sections: string[] // section labels that clash
}

/**
 * Detect teachers booked in more than one section at the same day + period.
 * Entries with no teacher are ignored. Returns one record per clashing
 * (teacher, day, period) combination.
 */
export function detectTeacherConflicts(entries: ConflictEntry[]): TeacherConflict[] {
  const groups = new Map<string, ConflictEntry[]>()
  for (const e of entries) {
    if (!e.teacherId) continue
    const key = `${e.teacherId}|${e.dayOfWeek}|${e.periodId}`
    const list = groups.get(key)
    if (list) list.push(e)
    else groups.set(key, [e])
  }

  const conflicts: TeacherConflict[] = []
  for (const list of groups.values()) {
    // Distinct sections only — the same section appearing twice is impossible
    // (UNIQUE constraint) but we de-dup defensively.
    const sections = Array.from(new Set(list.map((e) => e.sectionLabel)))
    const first = list[0]
    if (first && sections.length > 1) {
      conflicts.push({
        teacherId: first.teacherId as string,
        teacherName: first.teacherName ?? 'Unknown',
        dayOfWeek: first.dayOfWeek,
        periodId: first.periodId,
        periodName: first.periodName,
        sections,
      })
    }
  }

  conflicts.sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.teacherName.localeCompare(b.teacherName),
  )
  return conflicts
}
