'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database.types'

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(list: { name: string; value: string; options: CookieOptions }[]) {
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
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
  const db = supabase as any

  // Resolve auth context server-side first. Client state can be stale after reseeding auth users.
  const { data: authData } = await supabase.auth.getUser()
  const sessionUser = authData?.user ?? null
  const effectiveAuthUserId = sessionUser?.id ?? authUserId
  const sessionEmail = sessionUser?.email ?? null

  // Step 1: resolve profile → teacher (dependent, must be sequential)
  let { data: profileData } = await db
    .from('user_profiles')
    .select('id')
    .eq('auth_user_id', effectiveAuthUserId)
    .eq('school_id', schoolId)
    .eq('role', 'teacher')
    .single()

  // Fallback: in some seeded/repair flows auth_user_id may drift; email remains stable.
  if (!profileData && sessionEmail) {
    const { data: profileByEmail } = await db
      .from('user_profiles')
      .select('id')
      .eq('email', sessionEmail)
      .eq('school_id', schoolId)
      .eq('role', 'teacher')
      .single()
    profileData = profileByEmail
  }

  if (!profileData) return { teacherId: null, assignments: [], pendingAttendance: [], totalStudents: 0, todayAttendancePct: 0 }

  const { data: teacherData } = await db
    .from('teachers')
    .select('id')
    .eq('user_profile_id', profileData.id)
    .eq('school_id', schoolId)
    .single()
  if (!teacherData) return { teacherId: null, assignments: [], pendingAttendance: [], totalStudents: 0, todayAttendancePct: 0 }

  // Step 2: fetch assignments
  const { data: assignmentsData } = await db
    .from('teacher_section_assignments')
    .select(`
      is_class_teacher,
      section_id,
      sections ( name, classes ( name ) ),
      subjects ( name )
    `)
    .eq('teacher_id', teacherData.id)

  const assignments: TeacherAssignment[] = ((assignmentsData ?? []) as any[]).map(a => ({
    sectionName: a.sections?.name ?? '',
    className: a.sections?.classes?.name ?? '',
    subjectName: a.subjects?.name ?? '',
    isClassTeacher: a.is_class_teacher,
  }))

  // Step 3: check pending attendance — run all section checks in parallel
  const today = new Date().toISOString().split('T')[0]!
  const classTeacherSections = ((assignmentsData ?? []) as any[])
    .filter(a => a.is_class_teacher && a.section_id)
    .map(a => ({ sectionId: a.section_id as string, label: `${a.sections?.classes?.name ?? ''} ${a.sections?.name ?? ''}`.trim() }))

  // Fetch student counts and attendance in parallel
  const sectionIds = ((assignmentsData ?? []) as any[]).map(a => a.section_id).filter(Boolean) as string[]
  const classTchrSectionIds = classTeacherSections.map(s => s.sectionId)

  const [pendingFlags, studentsRes, todayAttendanceRes] = await Promise.all([
    Promise.all(
      classTeacherSections.map(async sec => {
        const { count } = await db
          .from('attendance_records')
          .select('id', { count: 'exact', head: true })
          .eq('section_id', sec.sectionId)
          .eq('date', today)
        return (count ?? 0) === 0 ? sec.label : null
      })
    ),
    sectionIds.length > 0
      ? db
          .from('students')
          .select('id', { count: 'exact', head: true })
          .in('section_id', sectionIds)
          .eq('is_active', true)
      : Promise.resolve({ count: 0 }),
    classTchrSectionIds.length > 0
      ? Promise.all([
          db
            .from('attendance_records')
            .select('id', { count: 'exact', head: true })
            .in('section_id', classTchrSectionIds)
            .eq('date', today)
            .eq('status', 'present'),
          db
            .from('students')
            .select('id', { count: 'exact', head: true })
            .in('section_id', classTchrSectionIds)
            .eq('is_active', true),
        ])
      : Promise.resolve([{ count: 0 }, { count: 0 }]),
  ])

  const pendingAttendance = (pendingFlags as (string | null)[]).filter(Boolean) as string[]
  const totalStudents = (studentsRes as any).count ?? 0

  const [presentRes, totalForPctRes] = todayAttendanceRes as [any, any]
  const presentCount = presentRes?.count ?? 0
  const totalForPct = totalForPctRes?.count ?? 0
  const todayAttendancePct = totalForPct > 0
    ? Math.round((presentCount / totalForPct) * 100)
    : 0

  return { teacherId: teacherData.id, assignments, pendingAttendance, totalStudents, todayAttendancePct }
}
