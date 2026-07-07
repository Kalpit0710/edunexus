'use server'

import { createClient as getSupabase } from '@/lib/supabase/server'
import { computePendingAttendanceSections } from '@/lib/teacher-utils'
import { schoolToday } from '@/lib/date-utils'
import type { Database } from '@/types/database.types'

type TeacherAssignmentJoinedRow = Pick<Database['public']['Tables']['teacher_section_assignments']['Row'], 'is_class_teacher' | 'section_id'> & {
  sections: ({ name: string | null; classes: { name: string | null } | null }) | null
  subjects: { name: string | null } | null
}

export interface TeacherAssignment {
  sectionName: string
  className: string
  subjectName: string
  isClassTeacher: boolean
}

export interface TeacherDashboardData {
  teacherId: string | null
  assignments: TeacherAssignment[]
  pendingAttendance: string[]
  totalStudents: number
  todayAttendancePct: number
}

export async function getTeacherDashboardData(
  schoolId: string,
  authUserId: string,
): Promise<TeacherDashboardData> {
  const supabase = await getSupabase()

  // Resolve auth context server-side first. Client state can be stale after reseeding auth users.
  const { data: authData } = await supabase.auth.getUser()
  const sessionUser = authData?.user ?? null
  const effectiveAuthUserId = sessionUser?.id ?? authUserId
  const sessionEmail = sessionUser?.email ?? null

  // Step 1: resolve profile → teacher (dependent, must be sequential)
  let { data: profileData } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('auth_user_id', effectiveAuthUserId)
    .eq('school_id', schoolId)
    .eq('role', 'teacher')
    .single()

  // Fallback: in some seeded/repair flows auth_user_id may drift; email remains stable.
  if (!profileData && sessionEmail) {
    const { data: profileByEmail } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', sessionEmail)
      .eq('school_id', schoolId)
      .eq('role', 'teacher')
      .single()
    profileData = profileByEmail
  }

  if (!profileData) return { teacherId: null, assignments: [], pendingAttendance: [], totalStudents: 0, todayAttendancePct: 0 }

  const { data: teacherData } = await supabase
    .from('teachers')
    .select('id')
    .eq('user_profile_id', profileData.id)
    .eq('school_id', schoolId)
    .single()
  if (!teacherData) return { teacherId: null, assignments: [], pendingAttendance: [], totalStudents: 0, todayAttendancePct: 0 }

  // Step 2: fetch assignments
  const { data: assignmentsData } = await supabase
    .from('teacher_section_assignments')
    .select(`
      is_class_teacher,
      section_id,
      sections ( name, classes ( name ) ),
      subjects ( name )
    `)
    .eq('teacher_id', teacherData.id)
  const assignmentRows = (assignmentsData ?? []) as TeacherAssignmentJoinedRow[]

  const assignments: TeacherAssignment[] = assignmentRows.map(a => ({
    sectionName: a.sections?.name ?? '',
    className: a.sections?.classes?.name ?? '',
    subjectName: a.subjects?.name ?? '',
    isClassTeacher: a.is_class_teacher,
  }))

  // Step 3: check pending attendance — run all section checks in parallel
  const today = schoolToday()
  const classTeacherSections = assignmentRows
    .filter(a => a.is_class_teacher && a.section_id)
    .map(a => ({ sectionId: a.section_id as string, label: `${a.sections?.classes?.name ?? ''} ${a.sections?.name ?? ''}`.trim() }))

  // Fetch student counts and attendance in parallel
  const sectionIds = assignmentRows.map(a => a.section_id).filter((id): id is string => Boolean(id))
  const classTchrSectionIds = classTeacherSections.map(s => s.sectionId)

  const [markedSectionsRes, studentsRes, todayAttendanceRes] = await Promise.all([
    // Single grouped lookup: which class-teacher sections already have attendance
    // marked today. Replaces the previous one-count-query-per-section fan-out.
    classTchrSectionIds.length > 0
      ? supabase
          .from('attendance_records')
          .select('section_id')
          .in('section_id', classTchrSectionIds)
          .eq('date', today)
      : Promise.resolve({ data: [] as Array<{ section_id: string }> }),
    sectionIds.length > 0
      ? supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .in('section_id', sectionIds)
          .eq('is_active', true)
      : Promise.resolve({ count: 0 }),
    classTchrSectionIds.length > 0
      ? Promise.all([
          supabase
            .from('attendance_records')
            .select('id', { count: 'exact', head: true })
            .in('section_id', classTchrSectionIds)
            .eq('date', today)
            .eq('status', 'present'),
          supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .in('section_id', classTchrSectionIds)
            .eq('is_active', true),
        ])
      : Promise.resolve([{ count: 0 }, { count: 0 }] as const),
  ])

  const markedSectionIds = ((markedSectionsRes.data ?? []) as Array<{ section_id: string }>)
    .map(r => r.section_id)
  const pendingAttendance = computePendingAttendanceSections(classTeacherSections, markedSectionIds)
  const totalStudents = studentsRes.count ?? 0

  const [presentRes, totalForPctRes] = todayAttendanceRes
  const presentCount = presentRes?.count ?? 0
  const totalForPct = totalForPctRes?.count ?? 0
  const todayAttendancePct = totalForPct > 0
    ? Math.round((presentCount / totalForPct) * 100)
    : 0

  return { teacherId: teacherData.id, assignments, pendingAttendance, totalStudents, todayAttendancePct }
}
