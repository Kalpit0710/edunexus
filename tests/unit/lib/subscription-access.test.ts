import { describe, it, expect } from 'vitest'
import { evaluateSubscriptionAccess } from '@/lib/subscription-access'

describe('evaluateSubscriptionAccess', () => {
  const now = new Date('2026-06-19T12:00:00.000Z')

  it('allows an active school', () => {
    expect(evaluateSubscriptionAccess('active', null, now)).toEqual({
      allowed: true,
      reason: 'active',
    })
  })

  it('blocks a suspended school regardless of trial date', () => {
    expect(evaluateSubscriptionAccess('suspended', null, now)).toEqual({
      allowed: false,
      reason: 'suspended',
    })
    expect(
      evaluateSubscriptionAccess('suspended', '2099-01-01T00:00:00.000Z', now).allowed,
    ).toBe(false)
  })

  it('allows a trial that has not yet ended', () => {
    const future = '2026-07-01T00:00:00.000Z'
    expect(evaluateSubscriptionAccess('trial', future, now)).toEqual({
      allowed: true,
      reason: 'active',
    })
  })

  it('blocks a trial whose end date is in the past', () => {
    const past = '2026-06-18T00:00:00.000Z'
    expect(evaluateSubscriptionAccess('trial', past, now)).toEqual({
      allowed: false,
      reason: 'trial_expired',
    })
  })

  it('treats the exact trial end instant as still active (not yet past)', () => {
    const iso = now.toISOString()
    expect(evaluateSubscriptionAccess('trial', iso, now).allowed).toBe(true)
  })

  it('allows a trial with no end date (fail-open)', () => {
    expect(evaluateSubscriptionAccess('trial', null, now).allowed).toBe(true)
    expect(evaluateSubscriptionAccess('trial', undefined, now).allowed).toBe(true)
  })

  it('allows unknown / null / empty status (fail-open)', () => {
    expect(evaluateSubscriptionAccess(null, null, now).allowed).toBe(true)
    expect(evaluateSubscriptionAccess(undefined, null, now).allowed).toBe(true)
    expect(evaluateSubscriptionAccess('something-else', null, now).allowed).toBe(true)
  })

  it('ignores an unparseable trial end date (fail-open)', () => {
    expect(evaluateSubscriptionAccess('trial', 'not-a-date', now).allowed).toBe(true)
  })
})
