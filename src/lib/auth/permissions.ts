import 'server-only'

import type { createClient } from '@/lib/supabase/server'
import { defaultAllows } from '@/lib/permissions'
import type { ActorProfile } from './require-actor'

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>

/**
 * App-layer permission guard for server actions. Resolves the caller's profile
 * (RLS still applies via the session client), then allows iff:
 *   • the caller is super_admin, OR
 *   • the school has an explicit `role_permissions` override granting it, OR
 *   • (no override) the built-in default for that role grants it.
 *
 * Throws `Not authenticated` / `Forbidden`. Returns the actor on success.
 * Defense-in-depth on top of `requireActor`, RLS, and route gating.
 */
export async function requirePermission(
  supabase: ServerSupabaseClient,
  permission: string,
): Promise<ActorProfile> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, school_id, role')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!profile) throw new Error('Forbidden')

  const actor = profile as ActorProfile
  if (actor.role === 'super_admin') return actor

  let allowed = defaultAllows(actor.role, permission)
  if (actor.school_id) {
    const { data: row } = await supabase
      .from('role_permissions')
      .select('allowed')
      .eq('school_id', actor.school_id)
      .eq('role', actor.role)
      .eq('permission', permission)
      .maybeSingle()
    if (row) allowed = Boolean((row as { allowed: boolean }).allowed)
  }

  if (!allowed) throw new Error('Forbidden')
  return actor
}
