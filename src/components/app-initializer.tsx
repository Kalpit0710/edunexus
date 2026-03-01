'use client'

/**
 * AppInitializer — mounts once inside each role layout.
 * It re-hydrates the Zustand auth store from the live Supabase session so
 * users don't lose context after a full-page refresh or direct URL navigation.
 */
import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { createClient } from '@/lib/supabase/client'

export function AppInitializer() {
    const { user, setUser, setSchool, setLoading } = useAuthStore()

    useEffect(() => {
        // Already hydrated — nothing to do
        if (user) return

        const supabase = createClient()

        async function init() {
            setLoading(true)
            try {
                const { data: { user: authUser } } = await supabase.auth.getUser()
                if (!authUser) return

                // Fetch user profile
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('auth_user_id', authUser.id)
                    .single()

                if (!profile) return

                setUser({
                    ...authUser,
                    user_metadata: {
                        role: (profile as any).role,
                        school_id: (profile as any).school_id ?? undefined,
                        full_name: (profile as any).full_name,
                        avatar_url: (profile as any).avatar_url ?? undefined,
                    },
                })

                // Fetch school data if applicable
                if ((profile as any).school_id) {
                    const { data: school } = await supabase
                        .from('schools')
                        .select('*')
                        .eq('id', (profile as any).school_id)
                        .single()

                    if (school) {
                        setSchool({
                            id: (school as any).id,
                            name: (school as any).name,
                            code: (school as any).code,
                            logo_url: (school as any).logo_url,
                            theme_color: (school as any).theme_color,
                            academic_year_start_month: (school as any).academic_year_start_month,
                            is_active: (school as any).is_active,
                            created_at: (school as any).created_at,
                            updated_at: (school as any).updated_at,
                        })
                    }
                }
            } finally {
                setLoading(false)
            }
        }

        init()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return null
}
