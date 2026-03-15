'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
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

interface ParentAccessContext {
    authUserId: string
    schoolId: string
    admin: Awaited<ReturnType<typeof createAdminClient>>
    db: any
}

async function getParentAccessContext(expectedSchoolId: string): Promise<ParentAccessContext | null> {
    const sessionClient = await createClient()
    const { data: { user }, error: userError } = await sessionClient.auth.getUser()

    if (userError || !user) return null

    const admin = await createAdminClient()
    const db = admin as any

    const { data: profile, error: profileError } = await db
        .from('user_profiles')
        .select('school_id, role')
        .eq('auth_user_id', user.id)
        .maybeSingle()

    if (profileError || !profile) return null
    if (profile.role !== 'parent') return null
    if (!profile.school_id || profile.school_id !== expectedSchoolId) return null

    return {
        authUserId: user.id,
        schoolId: profile.school_id,
        admin,
        db,
    }
}

async function getLinkedChildrenInternal(context: ParentAccessContext): Promise<ParentChildData[]> {
    const { data, error } = await context.db
        .from('parents')
        .select(`
            student_id,
            is_primary,
            students!inner(
                id,
                full_name,
                admission_number,
                class_id,
                section_id,
                classes(name),
                sections(name)
            )
        `)
        .eq('school_id', context.schoolId)
        .eq('auth_user_id', context.authUserId)

    if (error || !data) return []

    const deduped = new Map<string, ParentChildData & { __primary: boolean }>()

    for (const row of data as any[]) {
        const student = row.students
        if (!student) continue

        const mapped: ParentChildData & { __primary: boolean } = {
            id: student.id,
            fullName: student.full_name,
            admissionNumber: student.admission_number ?? '',
            className: student.classes?.name ?? '',
            sectionName: student.sections?.name ?? '',
            classId: student.class_id,
            sectionId: student.section_id,
            __primary: !!row.is_primary,
        }

        const existing = deduped.get(student.id)
        if (!existing || mapped.__primary) {
            deduped.set(student.id, mapped)
        }
    }

    return Array.from(deduped.values())
        .sort((a, b) => {
            if (a.__primary !== b.__primary) return Number(b.__primary) - Number(a.__primary)
            return a.fullName.localeCompare(b.fullName)
        })
        .map(({ __primary, ...rest }) => rest)
}

async function isStudentLinkedToParent(
    context: ParentAccessContext,
    studentId: string,
): Promise<boolean> {
    const { count, error } = await context.db
        .from('parents')
        .select('id', { head: true, count: 'exact' })
        .eq('school_id', context.schoolId)
        .eq('auth_user_id', context.authUserId)
        .eq('student_id', studentId)

    if (error) return false
    return (count ?? 0) > 0
}

// ─── Multi-child support ─────────────────────────────────────────────────────

export async function getLinkedChildren(
    _parentEmail: string,
    schoolId: string,
): Promise<ParentChildData[]> {
    try {
        const context = await getParentAccessContext(schoolId)
        if (!context) return []
        return await getLinkedChildrenInternal(context)
    } catch {
        return []
    }
}

export async function getParentChildData(
    _parentEmail: string,
    schoolId: string,
    childId?: string | null,
): Promise<ParentChildData | null> {
    try {
        const context = await getParentAccessContext(schoolId)
        if (!context) return null

        const linkedChildren = await getLinkedChildrenInternal(context)
        if (linkedChildren.length === 0) return null

        if (childId) {
            return linkedChildren.find((child) => child.id === childId) ?? null
        }

        return linkedChildren[0] ?? null
    } catch {
        return null
    }
}

// ─── Attendance ──────────────────────────────────────────────────────────────

export async function getChildAttendanceSummary(
    studentId: string,
    schoolId: string,
    month: number,
    year: number,
): Promise<ChildAttendanceSummary> {
    try {
        const context = await getParentAccessContext(schoolId)
        if (!context || !(await isStudentLinkedToParent(context, studentId))) {
            return { totalDays: 0, presentDays: 0, absentDays: 0, lateDays: 0, percentage: 0 }
        }

        const startDate = `${year}-${String(month).padStart(2, '0')}-01`
        const endDate = new Date(year, month, 0).toISOString().split('T')[0]!

        const { data } = await context.db
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
    } catch {
        return { totalDays: 0, presentDays: 0, absentDays: 0, lateDays: 0, percentage: 0 }
    }
}

export async function getChildAttendanceCalendar(
    studentId: string,
    schoolId: string,
    month: number,
    year: number,
): Promise<AttendanceDayRecord[]> {
    try {
        const context = await getParentAccessContext(schoolId)
        if (!context || !(await isStudentLinkedToParent(context, studentId))) {
            return []
        }

        const startDate = `${year}-${String(month).padStart(2, '0')}-01`
        const endDate = new Date(year, month, 0).toISOString().split('T')[0]!

        const { data } = await context.db
            .from('attendance_records')
            .select('date, status')
            .eq('student_id', studentId)
            .eq('school_id', schoolId)
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: true })

        return (data ?? []) as AttendanceDayRecord[]
    } catch {
        return []
    }
}

// ─── Fees ────────────────────────────────────────────────────────────────────

export async function getChildFeeStatus(
    studentId: string,
    schoolId: string,
): Promise<ChildFeeStatus> {
    try {
        const context = await getParentAccessContext(schoolId)
        if (!context || !(await isStudentLinkedToParent(context, studentId))) {
            return {
                totalFee: 0,
                totalPaid: 0,
                balance: 0,
                recentPayments: [],
            }
        }

        const { data: studentData } = await context.db
            .from('students')
            .select('class_id')
            .eq('id', studentId)
            .eq('school_id', schoolId)
            .single()

        const classId = (studentData as any)?.class_id

        let totalFee = 0
        if (classId) {
            const { data: yearData } = await context.db
                .from('academic_years')
                .select('id')
                .eq('school_id', schoolId)
                .eq('is_current', true)
                .single()

            if (yearData) {
                const { data: structs } = await context.db
                    .from('fee_structures')
                    .select('amount')
                    .eq('school_id', schoolId)
                    .eq('class_id', classId)
                    .eq('academic_year_id', (yearData as any).id)
                    .eq('is_active', true)

                totalFee = (structs ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0)
            }
        }

        const { data: payments } = await context.db
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
    } catch {
        return {
            totalFee: 0,
            totalPaid: 0,
            balance: 0,
            recentPayments: [],
        }
    }
}

// ─── Exam Results ────────────────────────────────────────────────────────────

export async function getChildExamsAndResults(
    studentId: string,
    schoolId: string,
): Promise<{ results: ExamResultRow[]; hasPendingFees: boolean }> {
    try {
        const context = await getParentAccessContext(schoolId)
        if (!context || !(await isStudentLinkedToParent(context, studentId))) {
            return { results: [], hasPendingFees: false }
        }

        // Check for pending fees
        const feeStatus = await getChildFeeStatus(studentId, schoolId)
        const hasPendingFees = feeStatus.balance > 0

        const { data: exams } = await context.db
            .from('exams')
            .select('id, name, start_date, status, result_visible')
            .eq('school_id', schoolId)
            .order('start_date', { ascending: false })
            .limit(20)

        if (!exams || exams.length === 0) return { results: [], hasPendingFees }

        const examIds = exams.map((e: any) => e.id)

        const [subjectsRes, marksRes] = await Promise.all([
            context.db.from('exam_subjects')
                .select('id, exam_id, max_marks, subjects(name)')
                .in('exam_id', examIds)
                .limit(500),
            context.db.from('marks')
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
    } catch {
        return { results: [], hasPendingFees: false }
    }
}

// ─── Announcements ───────────────────────────────────────────────────────────

export async function getLatestAnnouncements(
    schoolId: string,
    classId?: string | null,
): Promise<AnnouncementRow[]> {
    try {
        const context = await getParentAccessContext(schoolId)
        if (!context) return []

        // Table may not exist yet; fail closed.
        const { data, error } = await context.db
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
    } catch {
        return []
    }
}
