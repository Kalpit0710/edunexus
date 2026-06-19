import type { HolidayCategory } from '@/app/(school-admin)/school-admin/calendar/actions'

export const HOLIDAY_CATEGORIES: { value: HolidayCategory; label: string }[] = [
  { value: 'holiday', label: 'Holiday' },
  { value: 'event', label: 'Event' },
  { value: 'exam', label: 'Exam' },
  { value: 'break', label: 'Break / Vacation' },
]

/** Tailwind classes for a category badge (text + subtle background). */
export function categoryClasses(category: string): string {
  switch (category) {
    case 'holiday':
      return 'text-rose-400 bg-rose-500/10'
    case 'event':
      return 'text-blue-400 bg-blue-500/10'
    case 'exam':
      return 'text-amber-400 bg-amber-500/10'
    case 'break':
      return 'text-emerald-400 bg-emerald-500/10'
    default:
      return 'text-zinc-400 bg-white/5'
  }
}

export function categoryLabel(category: string): string {
  return HOLIDAY_CATEGORIES.find((c) => c.value === category)?.label ?? category
}

/** "12 Aug 2026" or "12 – 15 Aug 2026" / "28 Dec 2026 – 2 Jan 2027". */
export function formatDateRange(start: string, end: string | null): string {
  const s = new Date(start)
  if (!end || end === start) {
    return s.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  const e = new Date(end)
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()
  if (sameMonth) {
    return `${s.getDate()} – ${e.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }
  return `${s.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`
}

/** True when `iso` (YYYY-MM-DD) falls within the holiday's date span (inclusive). */
export function isDateInRange(iso: string, start: string, end: string | null): boolean {
  const last = end ?? start
  return iso >= start && iso <= last
}
