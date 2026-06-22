'use server'

import { createClient as getSupabase } from '@/lib/supabase/server'
import { normalizeWorkingDays } from '@/lib/timetable-utils'

export interface TimetablePeriod {
  id: string
  name: string
  startTime: string | null
  endTime: string | null
  isBreak: boolean
}

export interface MyTimetableEntry {
  dayOfWeek: number
  periodId: string
  sectionLabel: string
  subjectName: string | null
  room: string | null
}

export interface MyTimetable {
  teacherFound: boolean
  periods: TimetablePeriod[]
  entries: MyTimetableEntry[]
  workingDays: number[]
}

async function resolveTeacherId(
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

export async function getMyTimetable(schoolId: string): Promise<MyTimetable> {
  const supabase = await getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const empty: MyTimetable = {
    teacherFound: false,
    periods: [],
    entries: [],
    workingDays: normalizeWorkingDays(null),
  }

  const { data: authData } = await supabase.auth.getUser()
  const authUser = authData?.user
  if (!authUser) return empty

  const teacherId = await resolveTeacherId(db, schoolId, authUser.id, authUser.email ?? null)
  if (!teacherId) return empty

  const [{ data: periods }, { data: entries }, { data: school }] = await Promise.all([
    db
      .from('timetable_periods')
      .select('id, name, start_time, end_time, is_break')
      .eq('school_id', schoolId)
      .order('display_order', { ascending: true }),
    db
      .from('timetable_entries')
      .select('day_of_week, period_id, room, subjects ( name ), sections ( name, classes ( name ) )')
      .eq('school_id', schoolId)
      .eq('teacher_id', teacherId),
    db.from('schools').select('working_days').eq('id', schoolId).maybeSingle(),
  ])

  return {
    teacherFound: true,
    workingDays: normalizeWorkingDays(school?.working_days),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    periods: ((periods ?? []) as any[]).map((p) => ({
      id: p.id,
      name: p.name,
      startTime: p.start_time,
      endTime: p.end_time,
      isBreak: p.is_break,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entries: ((entries ?? []) as any[]).map((e) => ({
      dayOfWeek: e.day_of_week,
      periodId: e.period_id,
      sectionLabel: `${e.sections?.classes?.name ?? ''} ${e.sections?.name ?? ''}`.trim(),
      subjectName: e.subjects?.name ?? null,
      room: e.room,
    })),
  }
}
