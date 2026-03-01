/**
 * Milestone 1.7 — Attendance utility tests
 */
import { describe, it, expect } from 'vitest'
import {
  summariseAttendance,
  calcAttendancePercentage,
  attendanceBadgeVariant,
  STATUS_LABELS,
  getDaysInMonth,
  isDateAllowed,
  type AttendanceStatus,
  type AttendanceSummary,
} from '@/lib/attendance-utils'

// ── summariseAttendance ───────────────────────────────────────────────────────

describe('summariseAttendance() (M1.7)', () => {
  it('counts all statuses correctly', () => {
    const statuses: AttendanceStatus[] = [
      'present', 'present', 'absent', 'late', 'half_day', 'holiday',
    ]
    const s = summariseAttendance(statuses)
    expect(s.present).toBe(2)
    expect(s.absent).toBe(1)
    expect(s.late).toBe(1)
    expect(s.half_day).toBe(1)
    expect(s.holiday).toBe(1)
    expect(s.total).toBe(6)
  })

  it('returns zeros for an empty list', () => {
    const s = summariseAttendance([])
    expect(s.total).toBe(0)
    expect(s.present).toBe(0)
  })

  it('handles all-present', () => {
    const s = summariseAttendance(['present', 'present', 'present'])
    expect(s.present).toBe(3)
    expect(s.absent).toBe(0)
  })
})

// ── calcAttendancePercentage ──────────────────────────────────────────────────

describe('calcAttendancePercentage() (M1.7)', () => {
  it('100% when all present', () => {
    const s: AttendanceSummary = { present: 20, absent: 0, late: 0, half_day: 0, holiday: 0, total: 20 }
    expect(calcAttendancePercentage(s)).toBe(100)
  })

  it('0% when all absent', () => {
    const s: AttendanceSummary = { present: 0, absent: 20, late: 0, half_day: 0, holiday: 0, total: 20 }
    expect(calcAttendancePercentage(s)).toBe(0)
  })

  it('late counts as full day present', () => {
    const s: AttendanceSummary = { present: 18, absent: 0, late: 2, half_day: 0, holiday: 0, total: 20 }
    expect(calcAttendancePercentage(s)).toBe(100)
  })

  it('half_day counts as 0.5', () => {
    // 19 present + 1 half = 19.5 / 20 = 97.5 → rounded to 98
    const s: AttendanceSummary = { present: 19, absent: 0, late: 0, half_day: 1, holiday: 0, total: 20 }
    expect(calcAttendancePercentage(s)).toBe(98)
  })

  it('holidays excluded from working days denominator', () => {
    // 18 working days (2 holidays), 18 present → 100%
    const s: AttendanceSummary = { present: 18, absent: 0, late: 0, half_day: 0, holiday: 2, total: 20 }
    expect(calcAttendancePercentage(s)).toBe(100)
  })

  it('returns 0 when all days are holidays', () => {
    const s: AttendanceSummary = { present: 0, absent: 0, late: 0, half_day: 0, holiday: 5, total: 5 }
    expect(calcAttendancePercentage(s)).toBe(0)
  })
})

// ── attendanceBadgeVariant ────────────────────────────────────────────────────

describe('attendanceBadgeVariant() (M1.7)', () => {
  it('returns "default" for >= 85%', () => {
    expect(attendanceBadgeVariant(90)).toBe('default')
    expect(attendanceBadgeVariant(85)).toBe('default')
  })

  it('returns "secondary" for 75–84%', () => {
    expect(attendanceBadgeVariant(75)).toBe('secondary')
    expect(attendanceBadgeVariant(80)).toBe('secondary')
  })

  it('returns "destructive" for < 75%', () => {
    expect(attendanceBadgeVariant(74)).toBe('destructive')
    expect(attendanceBadgeVariant(0)).toBe('destructive')
  })
})

// ── STATUS_LABELS ────────────────────────────────────────────────────────────

describe('STATUS_LABELS (M1.7)', () => {
  it('has labels for all 5 statuses', () => {
    expect(STATUS_LABELS.present).toBe('P')
    expect(STATUS_LABELS.absent).toBe('A')
    expect(STATUS_LABELS.late).toBe('L')
    expect(STATUS_LABELS.half_day).toBe('HD')
    expect(STATUS_LABELS.holiday).toBe('H')
  })
})

// ── getDaysInMonth ────────────────────────────────────────────────────────────

describe('getDaysInMonth() (M1.7)', () => {
  it('returns 31 days for January', () => {
    expect(getDaysInMonth(2026, 1)).toHaveLength(31)
  })

  it('returns 28 days for February 2026 (non-leap)', () => {
    expect(getDaysInMonth(2026, 2)).toHaveLength(28)
  })

  it('returns 29 days for February 2024 (leap)', () => {
    expect(getDaysInMonth(2024, 2)).toHaveLength(29)
  })

  it('first and last dates are formatted correctly', () => {
    const days = getDaysInMonth(2026, 3)
    expect(days[0]).toBe('2026-03-01')
    expect(days[days.length - 1]).toBe('2026-03-31')
  })
})

// ── isDateAllowed ────────────────────────────────────────────────────────────

describe('isDateAllowed() (M1.7)', () => {
  it('allows today', () => {
    const today = new Date().toISOString().split('T')[0]!
    expect(isDateAllowed(today)).toBe(true)
  })

  it('allows past dates', () => {
    expect(isDateAllowed('2025-01-01')).toBe(true)
  })

  it('rejects future dates', () => {
    expect(isDateAllowed('2030-12-31')).toBe(false)
  })

  it('rejects invalid date strings', () => {
    expect(isDateAllowed('not-a-date')).toBe(false)
  })
})
