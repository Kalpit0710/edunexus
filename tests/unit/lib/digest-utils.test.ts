import { describe, it, expect } from 'vitest'
import {
  addDaysISO,
  weeklyWindow,
  formatINR,
  percent,
  summarizeCollections,
  topDefaulters,
  pickTodayHomework,
  pickUpcomingDue,
} from '@/lib/digest-utils'

describe('addDaysISO', () => {
  it('adds and subtracts days', () => {
    expect(addDaysISO('2026-06-22', 1)).toBe('2026-06-23')
    expect(addDaysISO('2026-06-22', -1)).toBe('2026-06-21')
  })
  it('crosses month and year boundaries', () => {
    expect(addDaysISO('2026-06-30', 1)).toBe('2026-07-01')
    expect(addDaysISO('2026-01-01', -1)).toBe('2025-12-31')
  })
  it('is UTC-stable (no timezone drift)', () => {
    expect(addDaysISO('2026-03-01', 0)).toBe('2026-03-01')
  })
})

describe('weeklyWindow', () => {
  it('produces 7 inclusive days ending today', () => {
    const w = weeklyWindow('2026-06-22')
    expect(w.days).toHaveLength(7)
    expect(w.start).toBe('2026-06-16')
    expect(w.end).toBe('2026-06-22')
    expect(w.days[0]).toBe('2026-06-16')
    expect(w.days[6]).toBe('2026-06-22')
  })
})

describe('formatINR', () => {
  it('formats with Indian grouping', () => {
    expect(formatINR(123456)).toBe('₹1,23,456')
    expect(formatINR(0)).toBe('₹0')
  })
  it('rounds and clamps negatives to zero', () => {
    expect(formatINR(99.6)).toBe('₹100')
    expect(formatINR(-50)).toBe('₹0')
  })
})

describe('percent', () => {
  it('computes a rounded percentage', () => {
    expect(percent(3, 4)).toBe(75)
    expect(percent(1, 3)).toBe(33)
  })
  it('guards divide-by-zero', () => {
    expect(percent(5, 0)).toBe(0)
  })
})

describe('summarizeCollections', () => {
  const days = ['2026-06-20', '2026-06-21', '2026-06-22']
  it('buckets payments per day and totals them', () => {
    const { total, series } = summarizeCollections(
      [
        { payment_date: '2026-06-20', paid_amount: 1000 },
        { payment_date: '2026-06-20', paid_amount: '500' },
        { payment_date: '2026-06-22', paid_amount: 250 },
      ],
      days,
    )
    expect(total).toBe(1750)
    expect(series.map((s) => s.amount)).toEqual([1500, 0, 250])
  })
  it('ignores payments outside the window and null amounts', () => {
    const { total } = summarizeCollections(
      [
        { payment_date: '2026-06-01', paid_amount: 9999 },
        { payment_date: '2026-06-21', paid_amount: null },
      ],
      days,
    )
    expect(total).toBe(0)
  })
})

describe('topDefaulters', () => {
  it('sorts by balance descending and limits without mutating input', () => {
    const rows = [
      { name: 'A', balance: 100 },
      { name: 'B', balance: 500 },
      { name: 'C', balance: 300 },
    ]
    const top = topDefaulters(rows, 2)
    expect(top.map((r) => r.name)).toEqual(['B', 'C'])
    expect(rows[0]!.name).toBe('A') // original order untouched
  })
})

describe('pickTodayHomework / pickUpcomingDue', () => {
  const rows = [
    { id: 'a', homeworkDate: '2026-06-22', dueDate: '2026-06-24' },
    { id: 'b', homeworkDate: '2026-06-21', dueDate: '2026-06-23' },
    { id: 'c', homeworkDate: '2026-06-20', dueDate: null },
    { id: 'd', homeworkDate: '2026-06-19', dueDate: '2026-06-18' },
  ]
  it('picks homework posted today', () => {
    expect(pickTodayHomework(rows, '2026-06-22').map((r) => r.id)).toEqual(['a'])
  })
  it('picks pending due (on/after today, not posted today), soonest first', () => {
    expect(pickUpcomingDue(rows, '2026-06-22').map((r) => r.id)).toEqual(['b'])
  })
})
