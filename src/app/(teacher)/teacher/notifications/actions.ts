'use server'

import { createClient as getSupabase } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { normalizeAnnouncementAudience } from '@/lib/announcement-utils'
import type { Database } from '@/types/database.types'

type TeacherAssignmentClassRow = {
  sections: ({ class_id: string | null; classes: { name: string | null } | null }) | null
}
type TeacherAnnouncementJoinedRow = Pick<Database['public']['Tables']['announcements']['Row'], 'id' | 'title' | 'body' | 'target_class_id' | 'target_audience' | 'created_at'> & {
  classes: { name: string | null } | null
}

export interface TeacherClassOption {
  classId: string
  className: string
}

export interface TeacherAnnouncementRow {
  id: string
  title: string
  body: string
  classId: string
  className: string
  createdAt: string
}

export interface TeacherNotificationsContext {
  teacherFound: boolean
  classes: TeacherClassOption[]
  announcements: TeacherAnnouncementRow[]
}

export interface TeacherAnnouncementInput {
  schoolId: string
  classId: string
  title: string
  body: string
}

async function resolveTeacherContext(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  schoolId: string,
): Promise<{ authUserId: string; classMap: Map<string, string> } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, role')
    .eq('auth_user_id', user.id)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!profile || profile.role !== 'teacher') return null

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('school_id', schoolId)
    .eq('user_profile_id', profile.id)
    .maybeSingle()

  if (!teacher) return null

  const { data: assignments } = await supabase
    .from('teacher_section_assignments')
    .select('sections!inner(class_id, classes!inner(name))')
    .eq('teacher_id', teacher.id)

  const classMap = new Map<string, string>()
  for (const row of (assignments ?? []) as TeacherAssignmentClassRow[]) {
    const classId = row.sections?.class_id as string | undefined
    const className = row.sections?.classes?.name as string | undefined
    if (classId && className) classMap.set(classId, className)
  }

  return { authUserId: user.id, classMap }
}

function assertTeacherInput(input: TeacherAnnouncementInput): void {
  if (!input.schoolId) throw new Error('School is required.')
  if (!input.classId) throw new Error('Please select a class.')
  if (!input.title.trim()) throw new Error('Title is required.')
  if (!input.body.trim()) throw new Error('Message is required.')
}

export async function getTeacherNotificationsContext(schoolId: string): Promise<TeacherNotificationsContext> {
  const supabase = await getSupabase()
  await requirePermission(supabase, 'communication.view')

  const teacher = await resolveTeacherContext(supabase, schoolId)
  if (!teacher) return { teacherFound: false, classes: [], announcements: [] }

  const { data: rows } = await supabase
    .from('announcements')
    .select('id, title, body, target_class_id, target_audience, created_at, classes(name)')
    .eq('school_id', schoolId)
    .eq('created_by', teacher.authUserId)
    .eq('target_audience', 'class_students')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  const announcements: TeacherAnnouncementRow[] = ((rows ?? []) as TeacherAnnouncementJoinedRow[])
    .filter((r): r is TeacherAnnouncementJoinedRow & { target_class_id: string } =>
      normalizeAnnouncementAudience(r.target_audience) === 'class_students' && Boolean(r.target_class_id)
    )
    .map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      classId: r.target_class_id,
      className: r.classes?.name ?? teacher.classMap.get(r.target_class_id) ?? 'Class',
      createdAt: r.created_at,
    }))

  return {
    teacherFound: true,
    classes: Array.from(teacher.classMap.entries()).map(([classId, className]) => ({ classId, className })),
    announcements,
  }
}

export async function createTeacherAnnouncement(input: TeacherAnnouncementInput): Promise<void> {
  assertTeacherInput(input)
  const supabase = await getSupabase()
  await requirePermission(supabase, 'communication.send')

  const teacher = await resolveTeacherContext(supabase, input.schoolId)
  if (!teacher) throw new Error('Teacher profile not found.')
  if (!teacher.classMap.has(input.classId)) throw new Error('You can notify only your assigned classes.')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('auth_user_id', teacher.authUserId)
    .maybeSingle()

  const { error } = await supabase.from('announcements').insert({
    school_id: input.schoolId,
    target_audience: 'class_students',
    target_class_id: input.classId,
    title: input.title.trim(),
    body: input.body.trim(),
    created_by: teacher.authUserId,
    created_by_name: profile?.full_name ?? 'Teacher',
  })
  if (error) throw new Error(error.message)
}

export async function updateTeacherAnnouncement(id: string, input: TeacherAnnouncementInput): Promise<void> {
  assertTeacherInput(input)
  const supabase = await getSupabase()
  await requirePermission(supabase, 'communication.send')

  const teacher = await resolveTeacherContext(supabase, input.schoolId)
  if (!teacher) throw new Error('Teacher profile not found.')
  if (!teacher.classMap.has(input.classId)) throw new Error('You can notify only your assigned classes.')

  const { error } = await supabase
    .from('announcements')
    .update({
      target_audience: 'class_students',
      target_class_id: input.classId,
      title: input.title.trim(),
      body: input.body.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('school_id', input.schoolId)
    .eq('created_by', teacher.authUserId)
    .eq('target_audience', 'class_students')
    .is('deleted_at', null)

  if (error) throw new Error(error.message)
}

export async function deleteTeacherAnnouncement(schoolId: string, id: string): Promise<void> {
  const supabase = await getSupabase()
  await requirePermission(supabase, 'communication.send')
  const teacher = await resolveTeacherContext(supabase, schoolId)
  if (!teacher) throw new Error('Teacher profile not found.')

  const { error } = await supabase
    .from('announcements')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('school_id', schoolId)
    .eq('created_by', teacher.authUserId)
    .eq('target_audience', 'class_students')
    .is('deleted_at', null)

  if (error) throw new Error(error.message)
}
