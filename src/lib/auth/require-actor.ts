import type { createClient } from '@/lib/supabase/server'

/** The session-scoped server client type (matches `createClient` in supabase/server). */
type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>

export interface ActorProfile {
  id: string
  school_id: string | null
  role: string
}

/**
 * App-layer authorization guard for server actions. Resolves the calling user's
 * profile from a session-scoped Supabase client (so RLS still applies) and
 * enforces that their role is allowed. Throws `Not authenticated` / `Forbidden`.
 *
 * Defense-in-depth on top of middleware route gating and RLS policies.
 */
export async function requireActor(
  supabase: ServerSupabaseClient,
  allowedRoles: string[],
): Promise<ActorProfile> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Not authenticated')

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, school_id, role')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (profileError || !profile) throw new Error('Forbidden')

  const actor = profile as ActorProfile
  if (!allowedRoles.includes(actor.role)) throw new Error('Forbidden')

  return actor
}
