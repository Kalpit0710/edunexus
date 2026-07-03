'use server'

import { createClient as getSupabase } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'

export interface HomeworkSectionOption {
  classId: string
  className: string
  sectionId: string
  sectionName: string
}

export interface HomeworkClassOption {
  classId: string
  className: string
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

export interface SchoolHomeworkContext {
  classes: HomeworkClassOption[]
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

function assertHomeworkInput(input: HomeworkInput): void {
  if (!input.classId) throw new Error('Please select a class.')
  if (!input.title.trim()) throw new Error('Title is required.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.homeworkDate)) throw new Error('A valid date is required.')
  if (input.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) throw new Error('Invalid due date.')
}

export async function getSchoolHomeworkContext(schoolId: string): Promise<SchoolHomeworkContext> {
  const supabase = await getSupabase()
  await requirePermission(supabase, 'teachers.manage')

  const db = supabase as any

  const [{ data: classes }, { data: sections }, { data: subjects }, { data: hwData }] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true }),
    db
      .from('sections')
      .select('id, name, class_id, classes ( name )')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('subjects')
      .select('id, name, class_id')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true }),
    db
      .from('homework')
      .select('id, class_id, section_id, subject_id, title, description, homework_date, due_date, created_by_name, classes ( name ), sections ( name ), subjects ( name )')
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('homework_date', { ascending: false })
      .limit(200),
  ])

  const homework: HomeworkRow[] = ((hwData ?? []) as any[]).map((h) => ({
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
    classes: (classes ?? []).map((c) => ({ classId: c.id, className: c.name })),
    sections: ((sections ?? []) as any[]).map((s) => ({
      classId: s.class_id,
      className: s.classes?.name ?? '',
      sectionId: s.id,
      sectionName: s.name,
    })),
    subjects: (subjects ?? []).map((s) => ({ id: s.id, name: s.name, classId: s.class_id })),
    homework,
  }
}

export async function createSchoolHomework(input: HomeworkInput): Promise<void> {
  assertHomeworkInput(input)
  const supabase = await getSupabase()
  await requirePermission(supabase, 'teachers.manage')

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in.')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const db = supabase as any
  const { error } = await db.from('homework').insert({
    school_id: input.schoolId,
    class_id: input.classId,
    section_id: input.sectionId,
    subject_id: input.subjectId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    homework_date: input.homeworkDate,
    due_date: input.dueDate,
    created_by: user.id,
    created_by_name: profile?.full_name ?? 'School Admin',
  })

  if (error) throw new Error(error.message)
}

export async function updateSchoolHomework(id: string, input: HomeworkInput): Promise<void> {
  assertHomeworkInput(input)
  const supabase = await getSupabase()
  await requirePermission(supabase, 'teachers.manage')

  const db = supabase as any
  const { error } = await db
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
    .eq('school_id', input.schoolId)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)
}

export async function deleteSchoolHomework(schoolId: string, id: string): Promise<void> {
  const supabase = await getSupabase()
  await requirePermission(supabase, 'teachers.manage')

  const db = supabase as any
  const { error } = await db
    .from('homework')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('school_id', schoolId)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)
}
