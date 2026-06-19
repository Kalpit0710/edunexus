import { describe, it, expect } from 'vitest'
import { formatDateRange, isDateInRange, categoryLabel } from '@/lib/calendar-utils'

describe('formatDateRange', () => {
  it('formats a single day', () => {
    expect(formatDateRange('2026-08-15', null)).toBe('15 Aug 2026')
    expect(formatDateRange('2026-08-15', '2026-08-15')).toBe('15 Aug 2026')
  })
  it('collapses same-month ranges', () => {
    expect(formatDateRange('2026-08-12', '2026-08-15')).toBe('12 – 15 Aug 2026')
  })
  it('spans months/years', () => {
    expect(formatDateRange('2026-12-28', '2027-01-02')).toBe('28 Dec – 2 Jan 2027')
  })
})

describe('isDateInRange', () => {
  it('matches a single-day holiday', () => {
    expect(isDateInRange('2026-08-15', '2026-08-15', null)).toBe(true)
    expect(isDateInRange('2026-08-16', '2026-08-15', null)).toBe(false)
  })
  it('matches inside a span (inclusive)', () => {
    expect(isDateInRange('2026-08-12', '2026-08-12', '2026-08-15')).toBe(true)
    expect(isDateInRange('2026-08-15', '2026-08-12', '2026-08-15')).toBe(true)
    expect(isDateInRange('2026-08-11', '2026-08-12', '2026-08-15')).toBe(false)
    expect(isDateInRange('2026-08-16', '2026-08-12', '2026-08-15')).toBe(false)
  })
})

describe('categoryLabel', () => {
  it('maps known categories and falls back', () => {
    expect(categoryLabel('break')).toBe('Break / Vacation')
    expect(categoryLabel('holiday')).toBe('Holiday')
    expect(categoryLabel('unknown')).toBe('unknown')
  })
})
