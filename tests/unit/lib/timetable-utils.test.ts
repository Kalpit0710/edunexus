import { describe, it, expect } from 'vitest'
import {
  formatTime,
  formatPeriodRange,
  validatePeriodTimes,
  weekdayLabel,
  detectTeacherConflicts,
  periodsOverlap,
  normalizeWorkingDays,
  DEFAULT_WORKING_DAYS,
  type ConflictEntry,
} from '@/lib/timetable-utils'

describe('formatTime', () => {
  it('formats morning, noon and midnight correctly', () => {
    expect(formatTime('09:00')).toBe('9:00 AM')
    expect(formatTime('12:00')).toBe('12:00 PM')
    expect(formatTime('00:00')).toBe('12:00 AM')
    expect(formatTime('13:30')).toBe('1:30 PM')
  })

  it('tolerates seconds and returns empty for invalid input', () => {
    expect(formatTime('08:05:00')).toBe('8:05 AM')
    expect(formatTime(null)).toBe('')
    expect(formatTime(undefined)).toBe('')
    expect(formatTime('not-a-time')).toBe('')
  })
})

describe('formatPeriodRange', () => {
  it('joins both sides with an en dash', () => {
    expect(formatPeriodRange('09:00', '09:40')).toBe('9:00 AM – 9:40 AM')
  })
  it('falls back to whichever side is present', () => {
    expect(formatPeriodRange('09:00', null)).toBe('9:00 AM')
    expect(formatPeriodRange(null, '09:40')).toBe('9:40 AM')
    expect(formatPeriodRange(null, null)).toBe('')
  })
})

describe('validatePeriodTimes', () => {
  it('allows both blank (unscheduled)', () => {
    expect(validatePeriodTimes(null, null)).toBeNull()
    expect(validatePeriodTimes('', '')).toBeNull()
  })
  it('rejects a single-sided time', () => {
    expect(validatePeriodTimes('09:00', null)).toMatch(/both/i)
    expect(validatePeriodTimes(null, '09:40')).toMatch(/both/i)
  })
  it('rejects end <= start', () => {
    expect(validatePeriodTimes('09:40', '09:00')).toMatch(/after/i)
    expect(validatePeriodTimes('09:00', '09:00')).toMatch(/after/i)
  })
  it('accepts a valid range', () => {
    expect(validatePeriodTimes('09:00', '09:40')).toBeNull()
  })
})

describe('weekdayLabel', () => {
  it('returns short and long labels', () => {
    expect(weekdayLabel(1)).toBe('Mon')
    expect(weekdayLabel(1, true)).toBe('Monday')
    expect(weekdayLabel(7, true)).toBe('Sunday')
    expect(weekdayLabel(99)).toBe('')
  })
})

describe('detectTeacherConflicts', () => {
  const base: Omit<ConflictEntry, 'sectionId' | 'sectionLabel' | 'entryId'> = {
    dayOfWeek: 1,
    periodId: 'p1',
    periodName: 'Period 1',
    teacherId: 't1',
    teacherName: 'Mr A',
  }

  it('flags a teacher double-booked across two sections', () => {
    const conflicts = detectTeacherConflicts([
      { ...base, entryId: 'e1', sectionId: 's1', sectionLabel: '1-A' },
      { ...base, entryId: 'e2', sectionId: 's2', sectionLabel: '1-B' },
    ])
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]?.sections.slice().sort()).toEqual(['1-A', '1-B'])
  })

  it('does not flag the same teacher in different periods', () => {
    const conflicts = detectTeacherConflicts([
      { ...base, entryId: 'e1', sectionId: 's1', sectionLabel: '1-A' },
      { ...base, periodId: 'p2', entryId: 'e2', sectionId: 's2', sectionLabel: '1-B' },
    ])
    expect(conflicts).toHaveLength(0)
  })

  it('does not flag different teachers in the same slot', () => {
    const conflicts = detectTeacherConflicts([
      { ...base, entryId: 'e1', sectionId: 's1', sectionLabel: '1-A' },
      { ...base, teacherId: 't2', teacherName: 'Ms B', entryId: 'e2', sectionId: 's2', sectionLabel: '1-B' },
    ])
    expect(conflicts).toHaveLength(0)
  })

  it('ignores entries with no teacher (free/break periods)', () => {
    const conflicts = detectTeacherConflicts([
      { ...base, teacherId: null, teacherName: null, entryId: 'e1', sectionId: 's1', sectionLabel: '1-A' },
      { ...base, teacherId: null, teacherName: null, entryId: 'e2', sectionId: 's2', sectionLabel: '1-B' },
    ])
    expect(conflicts).toHaveLength(0)
  })

  it('de-dups the same section appearing twice', () => {
    const conflicts = detectTeacherConflicts([
      { ...base, entryId: 'e1', sectionId: 's1', sectionLabel: '1-A' },
      { ...base, entryId: 'e2', sectionId: 's1', sectionLabel: '1-A' },
    ])
    expect(conflicts).toHaveLength(0)
  })
})

describe('periodsOverlap', () => {
  it('returns false when either side is unscheduled', () => {
    expect(periodsOverlap(null, null, '09:00', '09:40')).toBe(false)
    expect(periodsOverlap('09:00', '09:40', null, '10:00')).toBe(false)
    expect(periodsOverlap('09:00', null, '09:10', '09:40')).toBe(false)
  })

  it('detects a genuine overlap', () => {
    expect(periodsOverlap('09:00', '09:40', '09:30', '10:10')).toBe(true)
    expect(periodsOverlap('09:30', '10:10', '09:00', '09:40')).toBe(true)
  })

  it('treats touching edges as non-overlapping', () => {
    expect(periodsOverlap('09:00', '09:40', '09:40', '10:20')).toBe(false)
    expect(periodsOverlap('09:40', '10:20', '09:00', '09:40')).toBe(false)
  })

  it('flags one period fully containing another', () => {
    expect(periodsOverlap('09:00', '11:00', '09:30', '10:00')).toBe(true)
  })

  it('returns false for clearly separate periods', () => {
    expect(periodsOverlap('09:00', '09:40', '10:00', '10:40')).toBe(false)
  })
})

describe('normalizeWorkingDays', () => {
  it('falls back to the default when empty or invalid', () => {
    expect(normalizeWorkingDays(null)).toEqual(DEFAULT_WORKING_DAYS)
    expect(normalizeWorkingDays(undefined)).toEqual(DEFAULT_WORKING_DAYS)
    expect(normalizeWorkingDays([])).toEqual(DEFAULT_WORKING_DAYS)
    expect(normalizeWorkingDays([0, 8, 99])).toEqual(DEFAULT_WORKING_DAYS)
  })

  it('dedupes, filters out-of-range values and sorts ascending', () => {
    expect(normalizeWorkingDays([3, 1, 2, 2, 1])).toEqual([1, 2, 3])
    expect(normalizeWorkingDays([7, 1, 9, 0, 5])).toEqual([1, 5, 7])
  })

  it('keeps a valid Mon–Fri week intact', () => {
    expect(normalizeWorkingDays([1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4, 5])
  })
})
