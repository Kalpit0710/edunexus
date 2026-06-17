import 'server-only'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSubscriptionPlan, type SubscriptionPlan } from '@/lib/subscription'
import { planHasFeature, type Feature } from '@/lib/plan-features'

/**
 * Resolve the subscription plan for the currently authenticated user's school.
 * Server-side source of truth for plan-based access control (defense in depth
 * behind the client-side nav gating). Defaults to `basic` when unknown.
 */
export async function getCurrentSchoolPlan(): Promise<SubscriptionPlan> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 'basic'

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('school_id')
    .eq('auth_user_id', user.id)
    .single()

  const schoolId = (profile as { school_id?: string } | null)?.school_id
  if (!schoolId) return 'basic'

  const { data: school } = await supabase
    .from('schools')
    .select('subscription_plan')
    .eq('id', schoolId)
    .single()

  const plan = (school as { subscription_plan?: string } | null)?.subscription_plan
  return plan && isSubscriptionPlan(plan) ? plan : 'basic'
}

/**
 * Server guard for a gated feature. Redirects to the upgrade screen (with the
 * blocked feature highlighted) when the current school's plan doesn't include it.
 * Use at the top of a server component / layout that wraps a gated module.
 */
export async function requireFeature(feature: Feature): Promise<void> {
  const plan = await getCurrentSchoolPlan()
  if (!planHasFeature(plan, feature)) {
    redirect(`/school-admin/upgrade?feature=${feature}`)
  }
}
