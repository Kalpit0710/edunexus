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
}

export async function getTeacherDashboardData(
  schoolId: string,
  authUserId: string,
): Promise<TeacherDashboardData> {
  const supabase = await getSupabase()
  const db = supabase as any

  // Step 1: resolve profile → teacher (dependent, must be sequential)
  const { data: profileData } = await db
    .from('user_profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .single()
  if (!profileData) return { teacherId: null, assignments: [], pendingAttendance: [] }

  const { data: teacherData } = await db
    .from('teachers')
    .select('id')
    .eq('user_profile_id', profileData.id)
    .eq('school_id', schoolId)
    .single()
  if (!teacherData) return { teacherId: null, assignments: [], pendingAttendance: [] }

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

  const pendingFlags = await Promise.all(
    classTeacherSections.map(async sec => {
      const { count } = await db
        .from('attendance_records')
        .select('id', { count: 'exact', head: true })
        .eq('section_id', sec.sectionId)
        .eq('date', today)
      return (count ?? 0) === 0 ? sec.label : null
    })
  )
  const pendingAttendance = pendingFlags.filter(Boolean) as string[]

  return { teacherId: teacherData.id, assignments, pendingAttendance }
}
