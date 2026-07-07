'use server'

import { createClient as getSupabase, createAdminClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'
import {
  buildDispatchTargets,
  scopeLabel,
  type SuperAdminNotificationScope,
} from '@/lib/super-admin-notification-utils'

export interface NotificationSchoolOption {
  id: string
  name: string
  code: string
}

export interface NotificationClassOption {
  id: string
  schoolId: string
  name: string
}

export interface SuperAdminNotificationRow {
  id: string
  title: string
  body: string
  audience: string
  targetClassName: string | null
  schoolName: string | null
  schoolCode: string | null
  createdByName: string | null
  createdAt: string
}

export interface SuperAdminNotificationsContext {
  schools: NotificationSchoolOption[]
  classes: NotificationClassOption[]
  notifications: SuperAdminNotificationRow[]
}

export interface SuperAdminNotificationInput {
  scope: SuperAdminNotificationScope
  targetSchoolId: string | null
  targetClassId: string | null
  title: string
  body: string
}

interface SuperAdminActor {
  authUserId: string
  fullName: string
}

type AnnouncementContextRow = Pick<
  Database['public']['Tables']['announcements']['Row'],
  'id' | 'title' | 'body' | 'target_audience' | 'created_at' | 'created_by_name'
> & {
  classes: { name: string | null } | null
  schools: { name: string | null; code: string | null } | null
}

async function requireSuperAdmin(): Promise<SuperAdminActor> {
  const supabase = await getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, full_name')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'super_admin') {
    throw new Error('Forbidden: super admin access required')
  }

  return {
    authUserId: user.id,
    fullName: profile.full_name ?? 'Super Admin',
  }
}

function assertInput(input: SuperAdminNotificationInput): void {
  if (!input.title.trim()) throw new Error('Title is required.')
  if (!input.body.trim()) throw new Error('Message is required.')
}

export async function getSuperAdminNotificationsContext(): Promise<SuperAdminNotificationsContext> {
  const actor = await requireSuperAdmin()
  const admin = await createAdminClient()

  const [{ data: schools }, { data: classes }, { data: rows }] = await Promise.all([
    admin
      .from('schools')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name', { ascending: true }),
    admin
      .from('classes')
      .select('id, school_id, name')
      .eq('is_active', true)
      .order('name', { ascending: true }),
    admin
      .from('announcements')
      .select('id, title, body, target_audience, created_at, created_by_name, classes(name), schools(name, code)')
      .eq('created_by', actor.authUserId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  return {
    schools: (schools ?? []).map((s) => ({ id: s.id, name: s.name, code: s.code })),
    classes: (classes ?? []).map((c) => ({ id: c.id, schoolId: c.school_id, name: c.name })),
    notifications: ((rows ?? []) as AnnouncementContextRow[]).map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      audience: r.target_audience,
      targetClassName: r.classes?.name ?? null,
      schoolName: r.schools?.name ?? null,
      schoolCode: r.schools?.code ?? null,
      createdByName: r.created_by_name ?? null,
      createdAt: r.created_at,
    })),
  }
}

export async function createSuperAdminNotification(input: SuperAdminNotificationInput): Promise<{ inserted: number; scope: string }> {
  assertInput(input)
  const actor = await requireSuperAdmin()
  const admin = await createAdminClient()

  const { data: schools } = await admin
    .from('schools')
    .select('id')
    .eq('is_active', true)

  const schoolIds = (schools ?? []).map((s) => s.id)

  if (input.scope === 'class_students') {
    if (!input.targetSchoolId || !input.targetClassId) {
      throw new Error('School and class are required for class-wise notifications.')
    }
    const { data: classRow } = await admin
      .from('classes')
      .select('id')
      .eq('id', input.targetClassId)
      .eq('school_id', input.targetSchoolId)
      .eq('is_active', true)
      .maybeSingle()

    if (!classRow) throw new Error('Selected class does not belong to the selected school.')
  }

  const targets = buildDispatchTargets({
    scope: input.scope,
    availableSchoolIds: schoolIds,
    targetSchoolId: input.targetSchoolId,
    targetClassId: input.targetClassId,
  })

  const rows = targets.map((t) => ({
    school_id: t.schoolId,
    target_audience: t.audience,
    target_class_id: t.targetClassId,
    title: input.title.trim(),
    body: input.body.trim(),
    created_by: actor.authUserId,
    created_by_name: actor.fullName,
  }))

  const { error } = await admin.from('announcements').insert(rows)
  if (error) throw new Error(error.message)

  return { inserted: rows.length, scope: scopeLabel(input.scope) }
}
