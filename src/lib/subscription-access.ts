// Pure subscription-access evaluation (Tier 0 · B0.1).
//
// Decides whether a school's users may use the product right now, based on the
// school's `subscription_status` and `trial_ends_at`. Kept dependency-free so it
// is trivially unit-testable and can run in the Edge middleware.

export type SubscriptionAccessReason = 'active' | 'suspended' | 'trial_expired'

export interface SubscriptionAccessResult {
  allowed: boolean
  reason: SubscriptionAccessReason
}

/**
 * Evaluate runtime access for a school.
 *
 * Rules:
 *  - `suspended` → blocked.
 *  - `trial` with a `trial_ends_at` in the past → blocked (trial expired).
 *  - `trial` with no end date, or any other status (incl. `active`/unknown/null)
 *    → allowed (fail-open: never lock out a school we can't positively classify
 *    as suspended or expired).
 */
export function evaluateSubscriptionAccess(
  status: string | null | undefined,
  trialEndsAt: string | null | undefined,
  now: Date = new Date(),
): SubscriptionAccessResult {
  if (status === 'suspended') {
    return { allowed: false, reason: 'suspended' }
  }

  if (status === 'trial' && trialEndsAt) {
    const end = new Date(trialEndsAt)
    if (!Number.isNaN(end.getTime()) && end.getTime() < now.getTime()) {
      return { allowed: false, reason: 'trial_expired' }
    }
  }

  return { allowed: true, reason: 'active' }
}
