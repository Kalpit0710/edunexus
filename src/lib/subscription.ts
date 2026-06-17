// Subscription plans & billing constants for the EduNexus platform.
// Used by the Super Admin module to compute platform revenue and render plan UI.

export const SUBSCRIPTION_PLANS = ['basic', 'standard', 'premium'] as const
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number]

export const SUBSCRIPTION_STATUSES = ['active', 'trial', 'suspended'] as const
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

/** Default monthly plan price in INR (fallback when no DB override exists). */
export const DEFAULT_PLAN_PRICE: Record<SubscriptionPlan, number> = {
  basic: 2000,
  standard: 5000,
  premium: 10000,
}

/** @deprecated Use DEFAULT_PLAN_PRICE or getPlanPricing(). Kept for back-compat. */
export const PLAN_PRICE = DEFAULT_PLAN_PRICE

/** A resolved plan-price map (e.g. loaded from the DB). */
export type PlanPriceMap = Record<SubscriptionPlan, number>

export const PLAN_LABEL: Record<SubscriptionPlan, string> = {
  basic: 'Basic',
  standard: 'Standard',
  premium: 'Premium',
}

export const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: 'Active',
  trial: 'Trial',
  suspended: 'Suspended',
}

/**
 * Monthly recurring revenue for a single school.
 * Only `active` subscriptions contribute; trial and suspended schools count as ₹0.
 * Pass a `prices` map (from the DB) to use configured prices; defaults otherwise.
 */
export function monthlyRevenueForSchool(
  plan: SubscriptionPlan,
  status: SubscriptionStatus,
  prices: PlanPriceMap = DEFAULT_PLAN_PRICE
): number {
  return status === 'active' ? (prices[plan] ?? 0) : 0
}

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}

export function isSubscriptionPlan(value: string): value is SubscriptionPlan {
  return (SUBSCRIPTION_PLANS as readonly string[]).includes(value)
}

export function isSubscriptionStatus(value: string): value is SubscriptionStatus {
  return (SUBSCRIPTION_STATUSES as readonly string[]).includes(value)
}
