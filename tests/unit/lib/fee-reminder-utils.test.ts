import { describe, it, expect } from 'vitest'
import {
  pickReminderRecipient,
  formatReminderAmount,
  summarizeReminderRun,
  type ReminderParent,
} from '@/lib/fee-reminder-utils'

describe('pickReminderRecipient', () => {
  it('returns null when no parent has an email', () => {
    const parents: ReminderParent[] = [
      { full_name: 'A', email: null, is_primary: true },
      { full_name: 'B', email: '   ', is_primary: false },
    ]
    expect(pickReminderRecipient(parents)).toBeNull()
  })

  it('returns null for an empty list', () => {
    expect(pickReminderRecipient([])).toBeNull()
  })

  it('prefers the primary parent that has an email', () => {
    const parents: ReminderParent[] = [
      { full_name: 'Mother', email: 'mom@example.com', is_primary: false },
      { full_name: 'Father', email: 'dad@example.com', is_primary: true },
    ]
    expect(pickReminderRecipient(parents)).toEqual({ name: 'Father', email: 'dad@example.com' })
  })

  it('falls back to the first parent with an email when no primary has one', () => {
    const parents: ReminderParent[] = [
      { full_name: 'Primary', email: null, is_primary: true },
      { full_name: 'Guardian', email: 'guardian@example.com', is_primary: false },
    ]
    expect(pickReminderRecipient(parents)).toEqual({
      name: 'Guardian',
      email: 'guardian@example.com',
    })
  })

  it('trims the email and falls back to a generic name when missing', () => {
    const parents: ReminderParent[] = [
      { full_name: '  ', email: '  someone@example.com  ', is_primary: true },
    ]
    expect(pickReminderRecipient(parents)).toEqual({
      name: 'Parent/Guardian',
      email: 'someone@example.com',
    })
  })
})

describe('formatReminderAmount', () => {
  it('formats with the default rupee symbol and en-IN grouping', () => {
    expect(formatReminderAmount(125000)).toBe('₹1,25,000')
  })

  it('honours a custom currency symbol', () => {
    expect(formatReminderAmount(1500, '$')).toBe('$1,500')
  })

  it('rounds and floors negatives to zero', () => {
    expect(formatReminderAmount(99.6)).toBe('₹100')
    expect(formatReminderAmount(-50)).toBe('₹0')
  })

  it('is safe for non-finite input', () => {
    expect(formatReminderAmount(Number.NaN)).toBe('₹0')
  })
})

describe('summarizeReminderRun', () => {
  it('tallies sent, skipped and failed outcomes', () => {
    const result = summarizeReminderRun([
      { success: true },
      { success: true },
      { success: false, skipped: true },
      { success: false },
    ])
    expect(result).toEqual({ sent: 2, skipped: 1, failed: 1 })
  })

  it('returns zeros for an empty run', () => {
    expect(summarizeReminderRun([])).toEqual({ sent: 0, skipped: 0, failed: 0 })
  })
})
