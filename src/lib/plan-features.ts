// Plan → feature entitlements for EduNexus subscription tiers.
//
// This is the single source of truth for what each subscription plan unlocks.
// Tiers are incremental: Standard includes everything in Basic, Premium includes
// everything in Standard. `dashboard` and `settings` are always available so a
// school can always sign in, see an overview, and manage its own configuration.

import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from './subscription'

export const FEATURES = [
  'dashboard',
  'students',
  'attendance',
  'teachers',
  'fees',
  'exams',
  'reports',
  'settings',
  'communication',
  'inventory',
  'parent_portal',
] as const

export type Feature = (typeof FEATURES)[number]

export const FEATURE_LABEL: Record<Feature, string> = {
  dashboard: 'Dashboard',
  students: 'Student Management',
  attendance: 'Attendance',
  teachers: 'Teacher Management',
  fees: 'Fees & Billing',
  exams: 'Academics & Examinations',
  reports: 'Reports & Analytics',
  settings: 'School Settings',
  communication: 'Communication & Announcements',
  inventory: 'Bookstore & Inventory',
  parent_portal: 'Parent Portal',
}

/** Plan ordering (lowest → highest). Used for upgrade comparisons. */
export const PLAN_RANK: Record<SubscriptionPlan, number> = {
  basic: 0,
  standard: 1,
  premium: 2,
}

// Features available on every plan (a school can always operate at a minimum).
const ALWAYS_ON: Feature[] = ['dashboard', 'settings']

// Incremental additions per tier.
const BASIC_FEATURES: Feature[] = ['students', 'attendance']
const STANDARD_FEATURES: Feature[] = [...BASIC_FEATURES, 'teachers', 'fees', 'exams']
const PREMIUM_FEATURES: Feature[] = [
  ...STANDARD_FEATURES,
  'reports',
  'communication',
  'inventory',
  'parent_portal',
]

function withAlwaysOn(features: Feature[]): Feature[] {
  return Array.from(new Set<Feature>([...ALWAYS_ON, ...features]))
}

/** The full set of features unlocked by each plan. */
export const PLAN_FEATURES: Record<SubscriptionPlan, Feature[]> = {
  basic: withAlwaysOn(BASIC_FEATURES),
  standard: withAlwaysOn(STANDARD_FEATURES),
  premium: withAlwaysOn(PREMIUM_FEATURES),
}

/** True if the given plan unlocks the given feature. */
export function planHasFeature(plan: SubscriptionPlan, feature: Feature): boolean {
  return PLAN_FEATURES[plan]?.includes(feature) ?? false
}

/** All features unlocked by a plan. */
export function featuresForPlan(plan: SubscriptionPlan): Feature[] {
  return PLAN_FEATURES[plan] ?? PLAN_FEATURES.basic
}

/** The lowest-tier plan that unlocks a feature, or null if no plan does. */
export function minPlanForFeature(feature: Feature): SubscriptionPlan | null {
  const ordered = [...SUBSCRIPTION_PLANS].sort((a, b) => PLAN_RANK[a] - PLAN_RANK[b])
  return ordered.find((plan) => planHasFeature(plan, feature)) ?? null
}

/** Type guard: is the given string a known feature key? */
export function isFeatureKey(value: string): value is Feature {
  return (FEATURES as readonly string[]).includes(value)
}
