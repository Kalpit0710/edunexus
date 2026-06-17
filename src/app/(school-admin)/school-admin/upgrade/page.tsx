'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Check, Lock, Sparkles, ArrowLeft, Crown } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { usePlan } from '@/hooks/use-plan'
import {
  DEFAULT_PLAN_PRICE,
  PLAN_LABEL,
  SUBSCRIPTION_PLANS,
  formatInr,
  type PlanPriceMap,
  type SubscriptionPlan,
} from '@/lib/subscription'
import {
  FEATURE_LABEL,
  PLAN_FEATURES,
  PLAN_RANK,
  featuresForPlan,
  isFeatureKey,
  type Feature,
} from '@/lib/plan-features'
import { getVisiblePlanPricing } from './actions'

// Features worth listing as selling points (exclude always-on basics).
const HIGHLIGHT_FEATURES: Feature[] = [
  'students',
  'attendance',
  'teachers',
  'fees',
  'exams',
  'reports',
  'communication',
  'inventory',
  'parent_portal',
]

function UpgradeContent() {
  const searchParams = useSearchParams()
  const { plan: currentPlan } = usePlan()
  const [prices, setPrices] = useState<PlanPriceMap>(DEFAULT_PLAN_PRICE)

  const requestedRaw = searchParams.get('feature')
  const requestedFeature: Feature | null =
    requestedRaw && isFeatureKey(requestedRaw) ? requestedRaw : null

  useEffect(() => {
    getVisiblePlanPricing()
      .then(setPrices)
      .catch(() => {})
  }, [])

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-2">
        <Link
          href="/school-admin/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Upgrade your plan</h1>
            <p className="text-sm text-muted-foreground">
              {requestedFeature ? (
                <>
                  <span className="font-medium text-amber-400">
                    {FEATURE_LABEL[requestedFeature]}
                  </span>{' '}
                  isn&apos;t included in your current plan. Choose a plan that unlocks it.
                </>
              ) : (
                'Compare plans and unlock more modules for your school.'
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {SUBSCRIPTION_PLANS.map((p) => {
          const isCurrent = p === currentPlan
          const isHigher = PLAN_RANK[p] > PLAN_RANK[currentPlan]
          const unlocksRequested =
            requestedFeature !== null && PLAN_FEATURES[p].includes(requestedFeature)
          const planFeatureSet = new Set(featuresForPlan(p))

          return (
            <Card
              key={p}
              className={cn(
                'relative flex flex-col border-white/[0.06] bg-white/[0.02]',
                p === 'premium' && 'border-amber-500/30',
                unlocksRequested && !isCurrent && 'ring-1 ring-amber-500/40'
              )}
            >
              {p === 'premium' && (
                <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                  <Crown className="h-3 w-3" /> Best value
                </span>
              )}
              <CardHeader className="space-y-1">
                <p className="text-sm font-medium text-zinc-400">{PLAN_LABEL[p]}</p>
                <p className="text-3xl font-bold text-white">
                  {formatInr(prices[p])}
                  <span className="text-sm font-normal text-zinc-500">/mo</span>
                </p>
                {isCurrent && (
                  <span className="inline-flex w-fit items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-400">
                    Current plan
                  </span>
                )}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <ul className="space-y-2.5">
                  {HIGHLIGHT_FEATURES.map((feature) => {
                    const included = planFeatureSet.has(feature)
                    return (
                      <li
                        key={feature}
                        className={cn(
                          'flex items-center gap-2.5 text-sm',
                          included ? 'text-zinc-200' : 'text-zinc-600'
                        )}
                      >
                        {included ? (
                          <Check className="h-4 w-4 shrink-0 text-green-400" />
                        ) : (
                          <Lock className="h-3.5 w-3.5 shrink-0 text-zinc-700" />
                        )}
                        <span
                          className={cn(
                            requestedFeature === feature && 'font-semibold text-amber-400'
                          )}
                        >
                          {FEATURE_LABEL[feature]}
                        </span>
                      </li>
                    )
                  })}
                </ul>

                <div className="mt-auto pt-2">
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current plan
                    </Button>
                  ) : isHigher ? (
                    <Button className="w-full" asChild>
                      <a
                        href={`mailto:sales@edunexus.app?subject=${encodeURIComponent(
                          `Upgrade to ${PLAN_LABEL[p]}`
                        )}`}
                      >
                        Upgrade to {PLAN_LABEL[p]}
                      </a>
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>
                      Included below
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <p className="text-center text-xs text-zinc-600">
        Plan changes are handled by your EduNexus account manager. Contact your platform
        administrator to switch plans.
      </p>
    </div>
  )
}

export default function UpgradePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">Loading plans…</div>}>
      <UpgradeContent />
    </Suspense>
  )
}
