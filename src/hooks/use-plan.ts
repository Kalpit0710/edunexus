'use client'

import { useAuthStore } from '@/stores/auth.store'
import { type SubscriptionPlan } from '@/lib/subscription'
import { planHasFeature, type Feature } from '@/lib/plan-features'

/**
 * Client-side access to the current school's subscription plan and its feature
 * entitlements. Falls back to `basic` until the auth store is hydrated.
 */
export function usePlan() {
  const school = useAuthStore((s) => s.school)
  const plan: SubscriptionPlan = school?.subscription_plan ?? 'basic'

  return {
    plan,
    status: school?.subscription_status ?? 'active',
    hasFeature: (feature: Feature) => planHasFeature(plan, feature),
  }
}
