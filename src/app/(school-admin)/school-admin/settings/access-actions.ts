'use server'

import { createClient } from '@/lib/supabase/server'
import { requireActor } from '@/lib/auth/require-actor'

export interface RolePermissionOverride {
  role: string
  permission: string
  allowed: boolean
}

/** All explicit permission overrides for a school (absent = use role defaults). */
export async function getRolePermissionOverrides(schoolId: string): Promise<RolePermissionOverride[]> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data, error } = await db
    .from('role_permissions')
    .select('role, permission, allowed')
    .eq('school_id', schoolId)
  if (error) throw new Error(error.message)
  return (data ?? []) as RolePermissionOverride[]
}

/** Upsert one role × permission override. Restricted to school admins. */
export async function setRolePermission(
  schoolId: string,
  role: string,
  permission: string,
  allowed: boolean,
): Promise<void> {
  const supabase = await createClient()
  await requireActor(supabase, ['school_admin'])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db.from('role_permissions').upsert(
    { school_id: schoolId, role, permission, allowed, updated_at: new Date().toISOString() },
    { onConflict: 'school_id,role,permission' },
  )
  if (error) throw new Error(error.message)
}

/** Replace the school's disabled-feature list. Restricted to school admins. */
export async function updateDisabledFeatures(schoolId: string, features: string[]): Promise<void> {
  const supabase = await createClient()
  await requireActor(supabase, ['school_admin'])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { error } = await db.from('schools').update({ disabled_features: features }).eq('id', schoolId)
  if (error) throw new Error(error.message)
}
