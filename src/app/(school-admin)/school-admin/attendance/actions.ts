'use server'

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database.types'
import { sendEmail } from '@/lib/email'
import { AttendanceAlertEmail } from '@/emails/AttendanceAlertEmail'

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

// ── Types ─────────────────────────────────────────────────────────────────────

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'holiday'

export interface AttendanceRecord {
  student_id: string
  status: AttendanceStatus
  remarks?: string | null
}

export interface StudentAttendanceRow {
  id: string
  full_name: string
  admission_number: string
  roll_number: string | null
  attendance_status: AttendanceStatus | null  // null = not marked yet
  attendance_id: string | null
  remarks: string | null
}

// ── Fetch students + existing attendance for a date ──────────────────────────

export async function getStudentsForAttendance(
  schoolId: string,
  classId: string,
  sectionId: string,
  date: string
): Promise<StudentAttendanceRow[]> {
  const supabase = await getSupabase()

  // Fetch students in this section
  const { data: students, error: sErr } = await supabase
    .from('students')
    .select('id, full_name, admission_number, roll_number')
    .eq('school_id', schoolId)
    .eq('class_id', classId)
    .eq('section_id', sectionId)
    .eq('is_active', true)
    .order('roll_number', { ascending: true })

  if (sErr) throw new Error(sErr.message)
  if (!students || students.length === 0) return []

  // Fetch existing attendance records for this date
  const { data: records, error: rErr } = await supabase
    .from('attendance_records')
    .select('id, student_id, status, remarks')
    .eq('school_id', schoolId)
    .eq('class_id', classId)
    .eq('section_id', sectionId)
    .eq('date', date)

  if (rErr) throw new Error(rErr.message)

  const recordMap = new Map(
    ((records ?? []) as any[]).map((r) => [r.student_id, { id: r.id, status: r.status, remarks: r.remarks }])
  )

  return (students as any[]).map((s) => {
    const rec = recordMap.get(s.id)
    return {
      id: s.id,
      full_name: s.full_name ?? '',
      admission_number: s.admission_number ?? '',
      roll_number: s.roll_number ?? null,
      attendance_status: rec ? (rec.status as AttendanceStatus) : null,
      attendance_id: rec?.id ?? null,
      remarks: rec?.remarks ?? null,
    }
  })
}

// ── Save (upsert) attendance for a date ──────────────────────────────────────

export async function saveAttendance(
  schoolId: string,
  classId: string,
  sectionId: string,
  date: string,
  markedBy: string,
  records: AttendanceRecord[]
): Promise<void> {
  const supabase = await getSupabase()

  // Delete existing records for this date (clean upsert approach)
  await supabase
    .from('attendance_records')
    .delete()
    .eq('school_id', schoolId)
    .eq('class_id', classId)
    .eq('section_id', sectionId)
    .eq('date', date)

  if (records.length === 0) return

  const payload = records.map((r) => ({
    school_id: schoolId,
    class_id: classId,
    section_id: sectionId,
    student_id: r.student_id,
    date,
    status: r.status,
    remarks: r.remarks ?? null,
    marked_by: markedBy,
  }))

  const { error } = await supabase
    .from('attendance_records')
    // @ts-expect-error
    .insert(payload)

  if (error) throw new Error(error.message)

  // Send Attendance Alerts for absent students
  const absentStudents = records.filter(r => r.status === 'absent')
  if (absentStudents.length > 0) {
    try {
      const studentIds = absentStudents.map(r => r.student_id)
      
      const { data: students } = await supabase
        .from('students')
        .select('id, full_name, schools(name)')
        .in('id', studentIds)

      const { data: parents } = await supabase
        .from('parents')
        .select('student_id, first_name, email')
        .in('student_id', studentIds)
        .eq('is_primary', true)

      if (students && parents) {
        for (const absent of absentStudents) {
          const student = students.find((s: any) => s.id === absent.student_id)
          const parent = parents.find((p: any) => p.student_id === absent.student_id)
          
          if (student && parent && (parent as any).email) {
            await sendEmail({
              to: (parent as any).email,
              subject: `Attendance Alert: ${(student as any).full_name}`,
              react: AttendanceAlertEmail({
                parentName: (parent as any).first_name,
                studentName: (student as any).full_name,
                schoolName: (student as any).schools?.name || 'EduNexus',
                date: date
              }),
              schoolId,
              event: 'attendance_alert'
            })
          }
        }
      }
    } catch (e) {
      console.error('Failed to send attendance alerts:', e)
    }
  }
}

// ── Monthly report for a section ─────────────────────────────────────────────

export interface MonthlyAttendanceRow {
  student_id: string
  student_name: string
  admission_number: string
  present: number
  absent: number
  late: number
  half_day: number
  total_school_days: number
  percentage: number
}

export async function getMonthlyAttendanceReport(
  schoolId: string,
  classId: string,
  sectionId: string,
  year: number,
  month: number // 1-12
): Promise<MonthlyAttendanceRow[]> {
  const supabase = await getSupabase()

  // Date range for the month
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  // Students in section
  const { data: students, error: sErr } = await supabase
    .from('students')
    .select('id, full_name, admission_number')
    .eq('school_id', schoolId)
    .eq('class_id', classId)
    .eq('section_id', sectionId)
    .eq('is_active', true)

  if (sErr) throw new Error(sErr.message)
  if (!students || students.length === 0) return []

  // All attendance records for the month
  const { data: records, error: rErr } = await supabase
    .from('attendance_records')
    .select('student_id, status, date')
    .eq('school_id', schoolId)
    .eq('class_id', classId)
    .eq('section_id', sectionId)
    .gte('date', startDate)
    .lte('date', endDate)

  if (rErr) throw new Error(rErr.message)

  // Count distinct school days (days that have any record)
  const schoolDays = new Set(((records ?? []) as any[]).map((r) => r.date)).size

  // Group records by student
  type StatusCount = Record<string, number>
  const countsMap = new Map<string, StatusCount>()
  ;((records ?? []) as any[]).forEach((r) => {
    const sc = countsMap.get(r.student_id) ?? {}
    sc[r.status] = (sc[r.status] ?? 0) + 1
    countsMap.set(r.student_id, sc)
  })

  return (students as any[]).map((s) => {
    const sc = countsMap.get(s.id) ?? {}
    const present = sc['present'] ?? 0
    const absent = sc['absent'] ?? 0
    const late = sc['late'] ?? 0
    const half_day = sc['half_day'] ?? 0
    const effectiveDays = present + late + (half_day * 0.5)
    const percentage = schoolDays > 0 ? Math.round((effectiveDays / schoolDays) * 100) : 0
    return {
      student_id: (s as any).id,
      student_name: (s as any).full_name ?? '',
      admission_number: (s as any).admission_number ?? '',
      present,
      absent,
      late,
      half_day,
      total_school_days: schoolDays,
      percentage,
    }
  })
}
