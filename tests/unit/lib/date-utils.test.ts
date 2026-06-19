import { describe, it, expect } from 'vitest'
import { localDateISO, schoolToday, DEFAULT_TIMEZONE } from '@/lib/date-utils'

describe('localDateISO', () => {
  it('formats an instant as the YYYY-MM-DD date in the given timezone', () => {
    // 2026-06-19T11:00:00Z == 16:30 IST on the 19th.
    expect(localDateISO(new Date('2026-06-19T11:00:00Z'), 'Asia/Kolkata')).toBe('2026-06-19')
  })

  it('rolls to the next local day late in the evening (the UTC footgun)', () => {
    // 2026-06-19T20:00:00Z == 2026-06-20 01:30 IST. UTC date is still the 19th,
    // but the IST calendar date is the 20th — the bug this helper fixes.
    expect(localDateISO(new Date('2026-06-19T20:00:00Z'), 'Asia/Kolkata')).toBe('2026-06-20')
    // Sanity: the raw UTC date would have been the 19th.
    expect(new Date('2026-06-19T20:00:00Z').toISOString().split('T')[0]).toBe('2026-06-19')
  })

  it('handles the exact IST midnight boundary', () => {
    // 2026-06-19T18:30:00Z == 2026-06-20 00:00:00 IST.
    expect(localDateISO(new Date('2026-06-19T18:30:00Z'), 'Asia/Kolkata')).toBe('2026-06-20')
  })

  it('respects a different timezone for the same instant', () => {
    const instant = new Date('2026-06-19T20:00:00Z')
    expect(localDateISO(instant, 'Asia/Kolkata')).toBe('2026-06-20')
    expect(localDateISO(instant, 'UTC')).toBe('2026-06-19')
    expect(localDateISO(instant, 'America/Los_Angeles')).toBe('2026-06-19')
  })

  it('defaults to the configured school timezone', () => {
    const instant = new Date('2026-06-19T20:00:00Z')
    expect(localDateISO(instant)).toBe(localDateISO(instant, DEFAULT_TIMEZONE))
  })
})

describe('schoolToday', () => {
  it('returns a valid YYYY-MM-DD string', () => {
    expect(schoolToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
