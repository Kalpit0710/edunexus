/**
 * Pure utility functions for Attendance module (Milestone 1.7).
 */

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'holiday'

export interface AttendanceSummary {
  present: number
  absent: number
  late: number
  half_day: number
  holiday: number
  total: number
}

/** Summarise a list of status values */
export function summariseAttendance(statuses: AttendanceStatus[]): AttendanceSummary {
  const summary: AttendanceSummary = { present: 0, absent: 0, late: 0, half_day: 0, holiday: 0, total: statuses.length }
  for (const s of statuses) {
    if (s in summary) (summary as any)[s]++
  }
  return summary
}

/**
 * Calculate attendance percentage.
 * present + late count as full days; half_day counts as 0.5.
 * holiday days are excluded from both counts.
 */
export function calcAttendancePercentage(summary: AttendanceSummary): number {
  const workingDays = summary.total - summary.holiday
  if (workingDays === 0) return 0
  const effective = summary.present + summary.late + summary.half_day * 0.5
  return Math.round((effective / workingDays) * 100)
}

/** Returns a CSS colour class based on percentage thresholds */
export function attendanceBadgeVariant(pct: number): 'default' | 'secondary' | 'destructive' {
  if (pct >= 85) return 'default'
  if (pct >= 75) return 'secondary'
  return 'destructive'
}

/** Build the label string shown in the attendance grid buttons */
export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'P',
  absent: 'A',
  late: 'L',
  half_day: 'HD',
  holiday: 'H',
}

/** Generate a list of date strings (YYYY-MM-DD) for all days in a month */
export function getDaysInMonth(year: number, month: number): string[] {
  const days: string[] = []
  const lastDay = new Date(year, month, 0).getDate()
  for (let d = 1; d <= lastDay; d++) {
    days.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return days
}

/** Validate that a given date string is not in the future */
export function isDateAllowed(dateStr: string): boolean {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return false
  return d <= new Date()
}
