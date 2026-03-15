'use server'

import { createClient } from '@/lib/supabase/server'
import type { FeePaymentRow } from '../../(school-admin)/school-admin/fees/actions'

export interface ParentChildData {
    id: string
    fullName: string
    admissionNumber: string
    className: string
    sectionName: string
    classId: string
    sectionId: string | null
}

export interface ChildAttendanceSummary {
    totalDays: number
    presentDays: number
    absentDays: number
    lateDays: number
    percentage: number
}

export interface ChildFeeStatus {
    totalFee: number
    totalPaid: number
    balance: number
    recentPayments: FeePaymentRow[]
}

export interface AttendanceDayRecord {
    date: string
    status: 'present' | 'absent' | 'late' | 'half_day' | 'holiday'
}

export interface ExamResultRow {
    examId: string
    examName: string
    startDate: string | null
    status: string
    resultVisible: boolean
    subjects: {
        subjectName: string
        marksObtained: number | null
        maxMarks: number
        grade: string | null
        isAbsent: boolean
    }[]
    totalObtained: number
    totalMax: number
    percentage: number
}

export interface AnnouncementRow {
    id: string
    title: string
    body: string
    createdAt: string
    targetAudience: string
}

// ─── Multi-child support ─────────────────────────────────────────────────────

export async function getLinkedChildren(
    parentEmail: string,
    schoolId: string,
): Promise<ParentChildData[]> {
    const supabase = await createClient()

    const { data } = await supabase
        .from('students')
        .select('id, full_name, admission_number, class_id, section_id, classes(name), sections(name)')
        .eq('school_id', schoolId)
        .eq('parent_email', parentEmail)
        .eq('is_active', true)

    if (!data || data.length === 0) return []

    return (data as any[]).map(d => ({
        id: d.id,
        fullName: d.full_name,
        admissionNumber: d.admission_number ?? '',
        className: d.classes?.name ?? '',
        sectionName: d.sections?.name ?? '',
        classId: d.class_id,
        sectionId: d.section_id,
    }))
}

export async function getParentChildData(
    parentEmail: string,
    schoolId: string,
    childId?: string | null,
): Promise<ParentChildData | null> {
    const supabase = await createClient()

    let query = supabase
        .from('students')
        .select('id, full_name, admission_number, class_id, section_id, classes(name), sections(name)')
        .eq('school_id', schoolId)
        .eq('parent_email', parentEmail)
        .eq('is_active', true)

    if (childId) {
        query = query.eq('id', childId).limit(1)
    } else {
        query = query.limit(1)
    }

    const { data } = await query.maybeSingle()

    if (!data) return null
    const d = data as any
    return {
        id: d.id,
        fullName: d.full_name,
        admissionNumber: d.admission_number ?? '',
        className: d.classes?.name ?? '',
        sectionName: d.sections?.name ?? '',
        classId: d.class_id,
        sectionId: d.section_id,
    }
}

// ─── Attendance ──────────────────────────────────────────────────────────────

export async function getChildAttendanceSummary(
    studentId: string,
    schoolId: string,
    month: number,
    year: number,
): Promise<ChildAttendanceSummary> {
    const supabase = await createClient()
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]!

    const { data } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('student_id', studentId)
        .eq('school_id', schoolId)
        .gte('date', startDate)
        .lte('date', endDate)

    const records = (data ?? []) as { status: string }[]
    const totalDays = records.length
    const presentDays = records.filter(r => r.status === 'present').length
    const absentDays = records.filter(r => r.status === 'absent').length
    const lateDays = records.filter(r => r.status === 'late').length
    const percentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0

    return { totalDays, presentDays, absentDays, lateDays, percentage }
}

export async function getChildAttendanceCalendar(
    studentId: string,
    schoolId: string,
    month: number,
    year: number,
): Promise<AttendanceDayRecord[]> {
    const supabase = await createClient()
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]!

    const { data } = await supabase
        .from('attendance_records')
        .select('date, status')
        .eq('student_id', studentId)
        .eq('school_id', schoolId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })

    return (data ?? []) as AttendanceDayRecord[]
}

// ─── Fees ────────────────────────────────────────────────────────────────────

export async function getChildFeeStatus(
    studentId: string,
    schoolId: string,
): Promise<ChildFeeStatus> {
    const supabase = await createClient()

    const { data: studentData } = await supabase
        .from('students')
        .select('class_id')
        .eq('id', studentId)
        .single()

    const classId = (studentData as any)?.class_id

    let totalFee = 0
    if (classId) {
        const { data: yearData } = await supabase
            .from('academic_years')
            .select('id')
            .eq('school_id', schoolId)
            .eq('is_current', true)
            .single()

        if (yearData) {
            const { data: structs } = await supabase
                .from('fee_structures')
                .select('amount')
                .eq('school_id', schoolId)
                .eq('class_id', classId)
                .eq('academic_year_id', (yearData as any).id)
                .eq('is_active', true)

            totalFee = (structs ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0)
        }
    }

    const { data: payments } = await supabase
        .from('fee_payments')
        .select('*')
        .eq('student_id', studentId)
        .eq('school_id', schoolId)
        .order('payment_date', { ascending: false })
        .limit(5)

    const totalPaid = ((payments ?? []) as any[]).reduce((s: number, p: any) => s + Number(p.paid_amount), 0)

    return {
        totalFee,
        totalPaid,
        balance: Math.max(0, totalFee - totalPaid),
        recentPayments: (payments ?? []) as FeePaymentRow[],
    }
}

// ─── Exam Results ────────────────────────────────────────────────────────────

export async function getChildExamsAndResults(
    studentId: string,
    schoolId: string,
): Promise<{ results: ExamResultRow[]; hasPendingFees: boolean }> {
    const supabase = await createClient()
    const db = supabase as any

    // Check for pending fees
    const feeStatus = await getChildFeeStatus(studentId, schoolId)
    const hasPendingFees = feeStatus.balance > 0

    const { data: exams } = await db
        .from('exams')
        .select('id, name, start_date, status, result_visible')
        .eq('school_id', schoolId)
        .order('start_date', { ascending: false })
        .limit(20)

    if (!exams || exams.length === 0) return { results: [], hasPendingFees }

    const examIds = exams.map((e: any) => e.id)

    const [subjectsRes, marksRes] = await Promise.all([
        db.from('exam_subjects')
            .select('id, exam_id, max_marks, subjects(name)')
            .in('exam_id', examIds)
            .limit(500),
        db.from('marks')
            .select('exam_id, exam_subject_id, marks_obtained, grade, is_absent')
            .eq('student_id', studentId)
            .in('exam_id', examIds)
            .limit(500),
    ])

    const subjectsMap = new Map<string, any[]>()
    for (const s of subjectsRes.data ?? []) {
        const list = subjectsMap.get(s.exam_id) ?? []
        list.push(s)
        subjectsMap.set(s.exam_id, list)
    }

    const marksMap = new Map<string, any>()
    for (const m of marksRes.data ?? []) {
        marksMap.set(m.exam_subject_id, m)
    }

    const results: ExamResultRow[] = exams.map((exam: any) => {
        const subjects = subjectsMap.get(exam.id) ?? []
        const subjectRows = subjects.map((s: any) => {
            const mark = marksMap.get(s.id)
            return {
                subjectName: s.subjects?.name ?? 'Unknown',
                marksObtained: mark?.marks_obtained ?? null,
                maxMarks: Number(s.max_marks),
                grade: mark?.grade ?? null,
                isAbsent: mark?.is_absent ?? false,
            }
        })
        const totalMax = subjectRows.reduce((sum, r) => sum + r.maxMarks, 0)
        const totalObtained = subjectRows.reduce((sum, r) => sum + (r.marksObtained ?? 0), 0)
        const percentage = totalMax > 0 ? Number(((totalObtained / totalMax) * 100).toFixed(1)) : 0

        return {
            examId: exam.id,
            examName: exam.name,
            startDate: exam.start_date,
            status: exam.status,
            resultVisible: exam.result_visible ?? false,
            subjects: subjectRows,
            totalObtained,
            totalMax,
            percentage,
        }
    })

    return { results, hasPendingFees }
}

// ─── Announcements ───────────────────────────────────────────────────────────

export async function getLatestAnnouncements(
    schoolId: string,
    classId?: string | null,
): Promise<AnnouncementRow[]> {
    const supabase = await createClient()
    const db = supabase as any

    // Try to get announcements. The table may not exist; handle gracefully.
    const { data, error } = await db
        .from('announcements')
        .select('id, title, body, created_at, target_class_id, target_audience')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(20)

    if (error || !data) return []

    // Filter: show general announcements + ones for this class
    return (data as any[])
        .filter((a: any) =>
            !a.target_class_id || a.target_class_id === classId
        )
        .map((a: any) => ({
            id: a.id,
            title: a.title,
            body: a.body,
            createdAt: a.created_at,
            targetAudience: a.target_audience ?? 'all',
        }))
}
