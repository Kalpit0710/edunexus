import { createClient } from '@/lib/supabase/server'
import { evaluateSubscriptionAccess } from '@/lib/subscription-access'
import { SignOutButton } from './sign-out-button'
import { AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

/**
 * Lockout screen shown when a school's subscription is suspended or its trial
 * has expired (B0.1). The middleware redirects blocked users here; this page
 * re-derives the reason for a clear message and offers a sign-out.
 */
export default async function SubscriptionInactivePage() {
  let reason: 'suspended' | 'trial_expired' | 'active' = 'suspended'
  let schoolName: string | null = null

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('schools(name, subscription_status, trial_ends_at)')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      const schoolRel = (profile as { schools?: unknown } | null)?.schools
      const school = (Array.isArray(schoolRel) ? schoolRel[0] : schoolRel) as
        | { name?: string | null; subscription_status?: string | null; trial_ends_at?: string | null }
        | undefined

      schoolName = school?.name ?? null
      reason = evaluateSubscriptionAccess(
        school?.subscription_status,
        school?.trial_ends_at,
      ).reason
    }
  } catch {
    // Fall back to the generic suspended message.
  }

  const heading =
    reason === 'trial_expired' ? 'Your free trial has ended' : 'Your subscription is inactive'
  const body =
    reason === 'trial_expired'
      ? 'Your trial period is over. To keep using EduNexus, please upgrade to a paid plan.'
      : 'Access to this account has been paused. This usually means the subscription is suspended or payment is pending.'

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] p-6">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
          <AlertTriangle className="h-6 w-6 text-amber-400" />
        </div>
        <h1 className="text-xl font-semibold text-white">{heading}</h1>
        {schoolName && <p className="mt-1 text-sm text-white/50">{schoolName}</p>}
        <p className="mt-3 text-sm text-white/70">{body}</p>
        <p className="mt-4 text-sm text-white/50">
          Please contact your EduNexus account manager or email{' '}
          <a href="mailto:support@edunexus.app" className="text-amber-400 underline">
            support@edunexus.app
          </a>{' '}
          to reactivate.
        </p>
        <div className="mt-6 flex justify-center">
          <SignOutButton />
        </div>
      </div>
    </div>
  )
}
