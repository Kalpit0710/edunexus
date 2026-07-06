'use server'

import { createClient as getSupabase } from '@/lib/supabase/server'
import {
  getStudentsForAttendance,
  saveAttendance,
  type AttendanceRecord,
  type AttendanceStatus,
  type StudentAttendanceRow,
} from '@/app/(school-admin)/school-admin/attendance/actions'

export type { AttendanceStatus, StudentAttendanceRow }

export interface TeacherAttendanceSectionOption {
  classId: string
  className: string
  sectionId: string
  sectionName: string
}

export interface TeacherAttendanceContext {
  teacherFound: boolean
  classTeacherSections: TeacherAttendanceSectionOption[]
}

async function resolveTeacher(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
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
    const { data: profileByEmail } = await db
      .from('user_profiles')
      .select('id')
      .eq('email', email)
      .eq('school_id', schoolId)
      .eq('role', 'teacher')
      .maybeSingle()
    profile = profileByEmail
  }

  if (!profile?.id) return null

  const { data: teacher } = await db
    .from('teachers')
    .select('id')
    .eq('user_profile_id', profile.id)
    .eq('school_id', schoolId)
    .maybeSingle()

  return teacher?.id ?? null
}

export async function getTeacherAttendanceContext(schoolId: string): Promise<TeacherAttendanceContext> {
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const empty: TeacherAttendanceContext = { teacherFound: false, classTeacherSections: [] }

  const { data: authData } = await supabase.auth.getUser()
  const authUser = authData?.user
  if (!authUser) return empty

  const teacherId = await resolveTeacher(db, schoolId, authUser.id, authUser.email ?? null)
  if (!teacherId) return empty

  const { data: assignments, error } = await db
    .from('teacher_section_assignments')
    .select('is_class_teacher, sections ( id, name, class_id, classes ( name ) )')
    .eq('teacher_id', teacherId)
    .eq('is_class_teacher', true)

  if (error) throw new Error(error.message)

  const sectionMap = new Map<string, TeacherAttendanceSectionOption>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const a of (assignments ?? []) as any[]) {
    const sec = a.sections
    if (sec?.id && sec.class_id) {
      sectionMap.set(sec.id, {
        classId: sec.class_id,
        className: sec.classes?.name ?? '',
        sectionId: sec.id,
        sectionName: sec.name ?? '',
      })
    }
  }

  return {
    teacherFound: true,
    classTeacherSections: Array.from(sectionMap.values()),
  }
}

async function getSectionContext(
  schoolId: string,
  sectionId: string,
): Promise<{ classId: string; authUserId: string }> {
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: authData } = await supabase.auth.getUser()
  const authUser = authData?.user
  if (!authUser?.id) throw new Error('Not signed in.')

  const teacherId = await resolveTeacher(db, schoolId, authUser.id, authUser.email ?? null)
  if (!teacherId) throw new Error('Your teacher profile is not linked to this school.')

  const { data: assignment, error: assignmentError } = await db
    .from('teacher_section_assignments')
    .select('section_id, sections ( class_id )')
    .eq('teacher_id', teacherId)
    .eq('section_id', sectionId)
    .eq('is_class_teacher', true)
    .maybeSingle()

  if (assignmentError) throw new Error(assignmentError.message)

  const classId = assignment?.sections?.class_id ?? null
  if (!classId) {
    throw new Error('You are not assigned as class teacher for this section.')
  }

  return { classId, authUserId: authUser.id }
}

export async function getSectionStudentsForAttendance(
  schoolId: string,
  sectionId: string,
  date: string,
): Promise<StudentAttendanceRow[]> {
  const { classId } = await getSectionContext(schoolId, sectionId)
  return getStudentsForAttendance(schoolId, classId, sectionId, date)
}

export async function saveSectionAttendance(
  schoolId: string,
  sectionId: string,
  date: string,
  records: AttendanceRecord[],
): Promise<void> {
  const { classId, authUserId } = await getSectionContext(schoolId, sectionId)
  await saveAttendance(schoolId, classId, sectionId, date, authUserId, records)
}
