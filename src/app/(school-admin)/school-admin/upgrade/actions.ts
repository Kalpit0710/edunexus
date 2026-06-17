'use server'

import { createClient } from '@/lib/supabase/server'
import {
  DEFAULT_PLAN_PRICE,
  isSubscriptionPlan,
  type PlanPriceMap,
  type SubscriptionPlan,
} from '@/lib/subscription'

/**
 * Live plan prices visible to any authenticated user (school admins viewing the
 * upgrade screen). Reads `plan_prices` through the user's session — permitted by
 * the `authenticated_read_plan_prices` RLS policy — and falls back to code
 * defaults for any missing rows.
 */
export async function getVisiblePlanPricing(): Promise<PlanPriceMap> {
  const prices: PlanPriceMap = { ...DEFAULT_PLAN_PRICE }
  try {
    const supabase = await createClient()
    const { data } = await supabase.from('plan_prices').select('plan, price_inr')
    for (const row of (data ?? []) as Array<{ plan: string; price_inr: number }>) {
      if (isSubscriptionPlan(row.plan)) prices[row.plan as SubscriptionPlan] = row.price_inr
    }
  } catch {
    /* fall back to defaults */
  }
  return prices
}
