'use server'

import { createClient as getSupabase } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'
import { normalizeAnnouncementAudience, requiresClassTarget, type AnnouncementAudience } from '@/lib/announcement-utils'
import { requirePermission } from '@/lib/auth/permissions'

type ClassOptionRow = Pick<Database['public']['Tables']['classes']['Row'], 'id' | 'name'>
type AnnouncementJoinedRow = Pick<Database['public']['Tables']['announcements']['Row'], 'id' | 'title' | 'body' | 'target_audience' | 'target_class_id' | 'created_by_name' | 'created_at'> & {
  classes: { name: string } | null
}

export interface AnnouncementClassOption {
  id: string
  name: string
}

export interface StaffAnnouncementRow {
  id: string
  title: string
  body: string
  targetAudience: AnnouncementAudience
  targetClassId: string | null
  targetClassName: string | null
  createdByName: string | null
  createdAt: string
}

export interface StaffAnnouncementsContext {
  role: 'school_admin' | 'manager' | 'cashier'
  classes: AnnouncementClassOption[]
  announcements: StaffAnnouncementRow[]
}

export interface StaffAnnouncementInput {
  schoolId: string
  targetAudience: AnnouncementAudience
  targetClassId: string | null
  title: string
  body: string
}

async function resolveActor(supabase: Awaited<ReturnType<typeof getSupabase>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, full_name')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!profile) throw new Error('Forbidden')
  const role = profile.role
  if (!role || (role !== 'school_admin' && role !== 'manager' && role !== 'cashier')) {
    throw new Error('Forbidden')
  }

  return {
    authUserId: user.id,
    role,
    fullName: profile.full_name ?? 'Staff',
  }
}

function assertAnnouncementInput(input: StaffAnnouncementInput): void {
  if (!input.schoolId) throw new Error('School is required.')
  if (!input.title.trim()) throw new Error('Title is required.')
  if (!input.body.trim()) throw new Error('Message is required.')
  if (requiresClassTarget(input.targetAudience) && !input.targetClassId) {
    throw new Error('Please choose a class for class-targeted notifications.')
  }
  if (!requiresClassTarget(input.targetAudience) && input.targetClassId) {
    throw new Error('Class must be empty for broad notifications.')
  }
}

export async function getStaffAnnouncementsContext(schoolId: string): Promise<StaffAnnouncementsContext> {
  const supabase = await getSupabase()
  await requirePermission(supabase, 'communication.view')
  const actor = await resolveActor(supabase)

  const [{ data: classes }, { data: rows }] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('announcements')
      .select('id, title, body, target_audience, target_class_id, created_by_name, created_at, classes ( name )')
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const announcements: StaffAnnouncementRow[] = ((rows ?? []) as AnnouncementJoinedRow[]).map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    targetAudience: normalizeAnnouncementAudience(r.target_audience),
    targetClassId: r.target_class_id,
    targetClassName: r.classes?.name ?? null,
    createdByName: r.created_by_name ?? null,
    createdAt: r.created_at,
  }))

  return {
    role: actor.role,
    classes: ((classes ?? []) as ClassOptionRow[]).map((c) => ({ id: c.id, name: c.name })),
    announcements,
  }
}

export async function createStaffAnnouncement(input: StaffAnnouncementInput): Promise<void> {
  assertAnnouncementInput(input)
  const supabase = await getSupabase()
  await requirePermission(supabase, 'communication.send')
  const actor = await resolveActor(supabase)

  const { error } = await supabase.from('announcements').insert({
    school_id: input.schoolId,
    target_audience: input.targetAudience,
    target_class_id: requiresClassTarget(input.targetAudience) ? input.targetClassId : null,
    title: input.title.trim(),
    body: input.body.trim(),
    created_by: actor.authUserId,
    created_by_name: actor.fullName,
  })
  if (error) throw new Error(error.message)
}

export async function updateStaffAnnouncement(id: string, input: StaffAnnouncementInput): Promise<void> {
  assertAnnouncementInput(input)
  const supabase = await getSupabase()
  await requirePermission(supabase, 'communication.send')
  await resolveActor(supabase)

  const { error } = await supabase
    .from('announcements')
    .update({
      target_audience: input.targetAudience,
      target_class_id: requiresClassTarget(input.targetAudience) ? input.targetClassId : null,
      title: input.title.trim(),
      body: input.body.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('school_id', input.schoolId)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)
}

export async function deleteStaffAnnouncement(schoolId: string, id: string): Promise<void> {
  const supabase = await getSupabase()
  await requirePermission(supabase, 'communication.send')
  await resolveActor(supabase)

  const { error } = await supabase
    .from('announcements')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('school_id', schoolId)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)
}
