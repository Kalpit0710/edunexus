'use client'

import { useEffect, useState } from 'react'
import { Tag, IndianRupee, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { ContentAreaLoader } from '@/components/loaders/page-loaders'
import { getPlanPricing, updatePlanPricing } from '../actions'
import {
  PLAN_LABEL,
  SUBSCRIPTION_PLANS,
  formatInr,
  type PlanPriceMap,
  type SubscriptionPlan,
} from '@/lib/subscription'
import { getErrorMessage } from '@/lib/utils'
import { toast } from 'sonner'

export default function PricingPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<PlanPriceMap | null>(null)
  const [draft, setDraft] = useState<Record<SubscriptionPlan, string>>({
    basic: '',
    standard: '',
    premium: '',
  })

  useEffect(() => {
    getPlanPricing()
      .then((p) => {
        setSaved(p)
        setDraft({
          basic: String(p.basic),
          standard: String(p.standard),
          premium: String(p.premium),
        })
      })
      .catch((e) => toast.error('Failed to load pricing: ' + getErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  const dirty =
    saved !== null &&
    SUBSCRIPTION_PLANS.some((p) => draft[p].trim() !== String(saved[p]))

  function validate(): Partial<Record<SubscriptionPlan, number>> | null {
    const next: Partial<Record<SubscriptionPlan, number>> = {}
    for (const p of SUBSCRIPTION_PLANS) {
      const raw = draft[p].trim()
      if (raw === '') {
        toast.error(`${PLAN_LABEL[p]} price cannot be empty.`)
        return null
      }
      const value = Number(raw)
      if (!Number.isInteger(value) || value < 0) {
        toast.error(`${PLAN_LABEL[p]} price must be a whole, non-negative number.`)
        return null
      }
      next[p] = value
    }
    return next
  }

  async function handleSave() {
    if (saving || !dirty) return
    const next = validate()
    if (!next) return
    setSaving(true)
    try {
      const updated = await updatePlanPricing(next)
      setSaved(updated)
      setDraft({
        basic: String(updated.basic),
        standard: String(updated.standard),
        premium: String(updated.premium),
      })
      toast.success('Plan pricing updated.')
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    if (!saved) return
    setDraft({
      basic: String(saved.basic),
      standard: String(saved.standard),
      premium: String(saved.premium),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Plan Pricing</h2>
          <p className="text-muted-foreground">
            Set the monthly subscription price for each plan. Changes apply to all revenue
            calculations across the platform.
          </p>
        </div>
        <Tag className="hidden h-6 w-6 text-blue-400 sm:block" />
      </div>

      {loading ? (
        <ContentAreaLoader label="Loading pricing…" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Prices (INR)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {SUBSCRIPTION_PLANS.map((p) => (
                <div key={p} className="space-y-1.5">
                  <Label htmlFor={`price-${p}`}>{PLAN_LABEL[p]} plan</Label>
                  <div className="relative">
                    <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <Input
                      id={`price-${p}`}
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      className="pl-9"
                      value={draft[p]}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [p]: e.target.value }))
                      }
                    />
                  </div>
                  {saved && (
                    <p className="text-xs text-zinc-500">
                      Current: {formatInr(saved[p])}/mo
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 border-t border-white/[0.06] pt-4">
              <Button onClick={handleSave} disabled={!dirty || saving}>
                {saving ? <Spinner className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={!dirty || saving}
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
