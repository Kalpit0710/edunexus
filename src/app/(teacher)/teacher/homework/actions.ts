'use server'

import { createClient as getSupabase } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'

type ServerDbClient = Awaited<ReturnType<typeof getSupabase>>
type TeacherAssignmentJoinedRow = {
  section_id: string | null
  sections: ({ id: string; name: string | null; class_id: string | null; classes: { id: string; name: string | null } | null }) | null
  subjects: ({ id: string; name: string | null; class_id: string | null }) | null
}
type HomeworkJoinedRow = Database['public']['Tables']['homework']['Row'] & {
  classes: { name: string | null } | null
  sections: { name: string | null } | null
  subjects: { name: string | null } | null
}

export interface HomeworkSectionOption {
  classId: string
  className: string
  sectionId: string
  sectionName: string
}

export interface HomeworkSubjectOption {
  id: string
  name: string
  classId: string
}

export interface HomeworkRow {
  id: string
  class_id: string
  section_id: string | null
  subject_id: string | null
  title: string
  description: string | null
  homework_date: string
  due_date: string | null
  created_by_name: string | null
  className?: string
  sectionName?: string
  subjectName?: string
}

export interface TeacherHomeworkContext {
  teacherFound: boolean
  sections: HomeworkSectionOption[]
  subjects: HomeworkSubjectOption[]
  homework: HomeworkRow[]
}

export interface HomeworkInput {
  schoolId: string
  classId: string
  sectionId: string | null
  subjectId: string | null
  title: string
  description: string | null
  homeworkDate: string
  dueDate: string | null
}

/** Resolve the signed-in teacher's profile + teachers.id within the school. */
async function resolveTeacher(
  db: ServerDbClient,
  schoolId: string,
  authUserId: string,
  email: string | null,
): Promise<string | null> {
  let { data: profile } = await db
    .from('user_profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .eq('school_id', schoolId)
    .eq('role', 'teacher')
    .maybeSingle()

  if (!profile && email) {
    const { data: byEmail } = await db
      .from('user_profiles')
      .select('id')
      .eq('email', email)
      .eq('school_id', schoolId)
      .eq('role', 'teacher')
      .maybeSingle()
    profile = byEmail
  }
  if (!profile) return null

  const { data: teacher } = await db
    .from('teachers')
    .select('id')
    .eq('user_profile_id', profile.id)
    .eq('school_id', schoolId)
    .maybeSingle()
  return teacher?.id ?? null
}

export async function getTeacherHomeworkContext(schoolId: string): Promise<TeacherHomeworkContext> {
  const supabase = await getSupabase()
  const empty: TeacherHomeworkContext = { teacherFound: false, sections: [], subjects: [], homework: [] }

  const { data: authData } = await supabase.auth.getUser()
  const authUser = authData?.user
  if (!authUser) return empty

  const teacherId = await resolveTeacher(supabase, schoolId, authUser.id, authUser.email ?? null)
  if (!teacherId) return empty

  const { data: assignments } = await supabase
    .from('teacher_section_assignments')
    .select('section_id, sections ( id, name, class_id, classes ( id, name ) ), subjects ( id, name, class_id )')
    .eq('teacher_id', teacherId)

  const sectionMap = new Map<string, HomeworkSectionOption>()
  const subjectMap = new Map<string, HomeworkSubjectOption>()
  for (const a of (assignments ?? []) as TeacherAssignmentJoinedRow[]) {
    const sec = a.sections
    if (sec?.id && sec.class_id) {
      sectionMap.set(sec.id, {
        classId: sec.class_id,
        className: sec.classes?.name ?? '',
        sectionId: sec.id,
        sectionName: sec.name ?? '',
      })
    }
    const sub = a.subjects
    if (sub?.id && sub.class_id) {
      subjectMap.set(sub.id, { id: sub.id, name: sub.name ?? '', classId: sub.class_id })
    }
  }

  const { data: hwData } = await supabase
    .from('homework')
    .select('*, classes ( name ), sections ( name ), subjects ( name )')
    .eq('school_id', schoolId)
    .eq('created_by', authUser.id)
    .is('deleted_at', null)
    .order('homework_date', { ascending: false })
    .limit(100)

  const homework: HomeworkRow[] = ((hwData ?? []) as HomeworkJoinedRow[]).map((h) => ({
    id: h.id,
    class_id: h.class_id,
    section_id: h.section_id,
    subject_id: h.subject_id,
    title: h.title,
    description: h.description,
    homework_date: h.homework_date,
    due_date: h.due_date,
    created_by_name: h.created_by_name,
    className: h.classes?.name ?? '',
    sectionName: h.sections?.name ?? '',
    subjectName: h.subjects?.name ?? '',
  }))

  return {
    teacherFound: true,
    sections: Array.from(sectionMap.values()),
    subjects: Array.from(subjectMap.values()),
    homework,
  }
}

function assertHomeworkInput(input: HomeworkInput): void {
  if (!input.classId) throw new Error('Please select a class.')
  if (!input.title.trim()) throw new Error('Title is required.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.homeworkDate)) throw new Error('A valid date is required.')
  if (input.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) throw new Error('Invalid due date.')
}

export async function createHomework(input: HomeworkInput): Promise<void> {
  assertHomeworkInput(input)
  const supabase = await getSupabase()
  const { data: authData } = await supabase.auth.getUser()
  const authUser = authData?.user
  if (!authUser) throw new Error('Not signed in.')

  const authorName = (authUser.user_metadata?.full_name as string | undefined) ?? 'Teacher'

  const { error } = await supabase.from('homework').insert({
    school_id: input.schoolId,
    class_id: input.classId,
    section_id: input.sectionId,
    subject_id: input.subjectId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    homework_date: input.homeworkDate,
    due_date: input.dueDate,
    created_by: authUser.id,
    created_by_name: authorName,
  })
  if (error) throw new Error(error.message)
}

export async function updateHomework(id: string, input: HomeworkInput): Promise<void> {
  assertHomeworkInput(input)
  const supabase = await getSupabase()
  const { error } = await supabase
    .from('homework')
    .update({
      class_id: input.classId,
      section_id: input.sectionId,
      subject_id: input.subjectId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      homework_date: input.homeworkDate,
      due_date: input.dueDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteHomework(id: string): Promise<void> {
  const supabase = await getSupabase()
  const { error } = await supabase
    .from('homework')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
