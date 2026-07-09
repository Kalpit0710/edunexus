'use client'

/**
 * AppInitializer — mounts once inside each role layout.
 * It re-hydrates the Zustand auth store from the live Supabase session so
 * users don't lose context after a full-page refresh or direct URL navigation.
 */
import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { createClient } from '@/lib/supabase/client'
import type { SubscriptionPlan, SubscriptionStatus } from '@/lib/subscription'
import { computeEffectivePermissions } from '@/lib/permissions'

export function AppInitializer() {
    const { user, setUser, setSchool, setLoading, setPermissions } = useAuthStore()

    useEffect(() => {
        const supabase = createClient()
        // Whether the store was already hydrated (e.g. right after login or from a
        // persisted session). We still re-fetch below so the subscription plan and
        // other school fields stay in sync with the DB on every mount — but we skip
        // the loading flag to avoid a loader flash when we already have data.
        const alreadyHydrated = !!user

        async function init() {
            if (!alreadyHydrated) setLoading(true)
            try {
                const {
                    data: { user: authUser },
                    error: authUserError,
                } = await supabase.auth.getUser()

                if (authUserError?.code === 'refresh_token_not_found') {
                    await supabase.auth.signOut()
                    return
                }

                if (!authUser) return

                // Fetch user profile
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('auth_user_id', authUser.id)
                    .single()

                if (!profile) return

                // Load the caller's effective permissions (role defaults + school overrides).
                if (profile.role === 'super_admin') {
                    setPermissions(['*'])
                } else if (profile.school_id) {
                    const { data: overrideRows } = await supabase
                        .from('role_permissions')
                        .select('permission, allowed')
                        .eq('school_id', profile.school_id)
                        .eq('role', profile.role)
                    setPermissions(
                        computeEffectivePermissions(
                            profile.role,
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            ((overrideRows ?? []) as any[]).map((r) => ({ permission: r.permission, allowed: r.allowed })),
                        ),
                    )
                } else {
                    setPermissions([])
                }

                setUser({
                    ...authUser,
                    user_metadata: {
                        role: profile.role,
                        school_id: profile.school_id ?? undefined,
                        full_name: profile.full_name,
                        avatar_url: profile.avatar_url ?? undefined,
                    },
                })

                // Fetch school data if applicable
                if (profile.school_id) {
                    const { data: school } = await supabase
                        .from('schools')
                        .select('*')
                        .eq('id', profile.school_id)
                        .single()

                    if (school) {
                        const schoolWithTimezone = school as typeof school & { timezone?: string | null }
                        setSchool({
                            id: school.id,
                            name: school.name,
                            code: school.code,
                            logo_url: school.logo_url,
                            theme_color: school.theme_color,
                            academic_year_start_month: school.academic_year_start_month,
                            is_active: school.is_active,
                            lock_results_on_fee: school.lock_results_on_fee ?? false,
                            principal_signature_url: school.principal_signature_url ?? null,
                            disabled_features: school.disabled_features ?? [],
                            report_card_title: school.report_card_title ?? 'Progress Report',
                            pass_percentage: school.pass_percentage ?? 33,
                            result_statuses: school.result_statuses ?? ['Passed', 'Failed', 'Promoted', 'Detained'],
                            co_scholastic_grades: school.co_scholastic_grades ?? ['A', 'B', 'C', 'D', 'E'],
                            currency_symbol: school.currency_symbol ?? '₹',
                            locale: school.locale ?? 'en-IN',
                            date_format: school.date_format ?? 'dd MMM yyyy',
                            timezone: schoolWithTimezone.timezone ?? 'Asia/Kolkata',
                            subscription_plan: (school.subscription_plan ?? 'basic') as SubscriptionPlan,
                            subscription_status: (school.subscription_status ?? 'active') as SubscriptionStatus,
                            trial_ends_at: school.trial_ends_at ?? null,
                            created_at: school.created_at,
                            updated_at: school.updated_at,
                        })
                    }
                }
            } finally {
                if (!alreadyHydrated) setLoading(false)
            }
        }

        init()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return null
}
