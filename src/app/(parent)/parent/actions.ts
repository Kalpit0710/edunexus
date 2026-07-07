'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { schoolToday } from '@/lib/date-utils'
import { pickTodayHomework, pickUpcomingDue } from '@/lib/digest-utils'
import { normalizeWorkingDays } from '@/lib/timetable-utils'
import { normalizeAnnouncementAudience, parentCanSeeAnnouncement } from '@/lib/announcement-utils'
import type { Database } from '@/types/database.types'
import type { FeePaymentRow } from '../../(school-admin)/school-admin/fees/actions'
import { getPrintableReportCard } from '../../(school-admin)/school-admin/report-cards/actions'
import { getStudentQrTokenForSchool } from '../../(school-admin)/school-admin/id-cards/actions'
import { computeStudentFeeBalance } from '@/lib/fees/balance'

type ParentLinkedStudent = Pick<Database['public']['Tables']['students']['Row'], 'id' | 'full_name' | 'admission_number' | 'class_id' | 'section_id'> & {
    classes: { name: string | null } | null
    sections: { name: string | null } | null
}
type ParentStudentLinkRow = {
    student_id: string
    is_primary: boolean | null
    students: ParentLinkedStudent | null
}
type AttendanceTrendRow = Pick<Database['public']['Tables']['attendance_records']['Row'], 'date' | 'status'>
type StudentClassRow = Pick<Database['public']['Tables']['students']['Row'], 'class_id'>
type AnnouncementRawRow = {
    id: string
    title: string
    body: string
    created_at: string
    target_class_id: string | null
    target_audience: string | null
}
type ParentChildHomeworkLink = {
    id: string
    students: Pick<Database['public']['Tables']['students']['Row'], 'id' | 'class_id' | 'section_id' | 'school_id'> | null
}
type ChildHomeworkQueryRow = {
    id: string
    title: string
    description: string | null
    homework_date: string
    due_date: string | null
    created_by_name: string | null
    subjects: { name: string | null } | null
}
type ParentChildTimetableLink = {
    id: string
    students: Pick<Database['public']['Tables']['students']['Row'], 'id' | 'section_id' | 'school_id'> | null
}
type TimetablePeriodQueryRow = Pick<Database['public']['Tables']['timetable_periods']['Row'], 'id' | 'name' | 'start_time' | 'end_time' | 'is_break'>
type TimetableEntryQueryRow = Pick<Database['public']['Tables']['timetable_entries']['Row'], 'day_of_week' | 'period_id' | 'room'> & {
    subjects: { name: string | null } | null
    teachers: ({ employee_id: string | null; user_profiles: { full_name: string | null } | null }) | null
}
type HolidayQueryRow = Pick<Database['public']['Tables']['holidays']['Row'], 'id' | 'title' | 'category' | 'start_date' | 'end_date' | 'description'>
type TransportQueryRow = {
    pickup_point: string | null
    fee_amount: number | null
    buses: {
        bus_number: string
        route_name: string | null
        registration_number: string | null
        driver_name: string | null
        driver_phone: string | null
        attendant_name: string | null
        attendant_phone: string | null
    } | null
    bus_stops: {
        name: string | null
        pickup_time: string | null
        drop_time: string | null
    } | null
}

export interface ParentChildData {
    id: string
    fullName: string
    admissionNumber: string
    className: string
    sectionName: string
    classId: string
    sectionId: string | null
}

export interface ParentChildQrCardData {
    studentId: string
    studentName: string
    qrText: string
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

export interface FamilyStatementChildRow {
    studentId: string
    studentName: string
    className: string
    sectionName: string
    totalFee: number
    totalPaid: number
    balance: number
}

export interface ParentFamilyStatement {
    totalFee: number
    totalPaid: number
    totalBalance: number
    generatedAt: string
    children: FamilyStatementChildRow[]
}

export interface AttendanceDayRecord {
    date: string
    status: 'present' | 'absent' | 'late' | 'half_day' | 'holiday'
}

export interface ChildAttendanceTrendPoint {
    monthLabel: string
    presentPercentage: number
    absentPercentage: number
}

export interface ChildPerformanceTrendPoint {
    examName: string
    percentage: number
    examDate: string | null
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
    db: Awaited<ReturnType<typeof createAdminClient>>
}

async function getParentAccessContext(expectedSchoolId: string): Promise<ParentAccessContext | null> {
    const sessionClient = await createClient()
    const { data: { user }, error: userError } = await sessionClient.auth.getUser()

    if (userError || !user) return null

    const admin = await createAdminClient()
    const db = admin

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

    for (const row of data as ParentStudentLinkRow[]) {
        const student = row.students
        if (!student) continue
        if (!student.class_id) continue

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

export async function getParentChildQrCard(
    studentId: string,
    schoolId: string,
): Promise<ParentChildQrCardData | null> {
    try {
        const context = await getParentAccessContext(schoolId)
        if (!context || !(await isStudentLinkedToParent(context, studentId))) {
            return null
        }

        const { data: studentData, error } = await context.db
            .from('students')
            .select('id, full_name')
            .eq('id', studentId)
            .eq('school_id', schoolId)
            .eq('is_active', true)
            .maybeSingle()

        if (error || !studentData) return null

        return {
            studentId: studentData.id,
            studentName: studentData.full_name,
            qrText: await getStudentQrTokenForSchool(schoolId, studentData.id),
        }
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

export async function getChildAttendanceTrend(
    studentId: string,
    schoolId: string,
): Promise<ChildAttendanceTrendPoint[]> {
    try {
        const context = await getParentAccessContext(schoolId)
        if (!context || !(await isStudentLinkedToParent(context, studentId))) {
            return []
        }

        const start = new Date()
        start.setMonth(start.getMonth() - 5)
        const startDate = start.toISOString().split('T')[0]!

        const { data } = await context.db
            .from('attendance_records')
            .select('date, status')
            .eq('student_id', studentId)
            .eq('school_id', schoolId)
            .gte('date', startDate)
            .order('date', { ascending: true })

        const monthMap = new Map<string, { present: number; total: number }>()
        for (const row of (data ?? []) as AttendanceTrendRow[]) {
            const monthKey = String(row.date).slice(0, 7)
            const bucket = monthMap.get(monthKey) ?? { present: 0, total: 0 }
            bucket.total += 1
            if (row.status === 'present') {
                bucket.present += 1
            }
            monthMap.set(monthKey, bucket)
        }

        const result: ChildAttendanceTrendPoint[] = []
        for (let i = 5; i >= 0; i--) {
            const d = new Date()
            d.setMonth(d.getMonth() - i)
            const monthKey = d.toISOString().slice(0, 7)
            const bucket = monthMap.get(monthKey) ?? { present: 0, total: 0 }
            const presentPercentage = bucket.total > 0 ? Math.round((bucket.present / bucket.total) * 100) : 0
            result.push({
                monthLabel: d.toLocaleDateString('en-IN', { month: 'short' }),
                presentPercentage,
                absentPercentage: Math.max(0, 100 - presentPercentage),
            })
        }

        return result
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

        const classId = (studentData as StudentClassRow | null)?.class_id ?? null

        // Totals come from the shared guardrail helper so the parent fee view and
        // the report-card fee lock can never disagree. `totalPaid` here is the sum
        // of ALL payments (not the recent slice below).
        const { totalFee, totalPaid, balance } = await computeStudentFeeBalance(
            context.db,
            schoolId,
            studentId,
            classId,
        )

        // A small, separate query purely for the "recent payments" UI list.
        const { data: payments } = await context.db
            .from('fee_payments')
            .select('*')
            .eq('student_id', studentId)
            .eq('school_id', schoolId)
            .order('payment_date', { ascending: false })
            .limit(5)

        return {
            totalFee,
            totalPaid,
            balance,
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

export async function getParentFamilyStatement(
    schoolId: string,
): Promise<ParentFamilyStatement | null> {
    try {
        const context = await getParentAccessContext(schoolId)
        if (!context) return null

        const linkedChildren = await getLinkedChildrenInternal(context)
        if (linkedChildren.length === 0) return null

        const children = await Promise.all(
            linkedChildren.map(async (child) => {
                const fee = await computeStudentFeeBalance(
                    context.db,
                    schoolId,
                    child.id,
                    child.classId,
                )

                return {
                    studentId: child.id,
                    studentName: child.fullName,
                    className: child.className,
                    sectionName: child.sectionName,
                    totalFee: fee.totalFee,
                    totalPaid: fee.totalPaid,
                    balance: fee.balance,
                } satisfies FamilyStatementChildRow
            }),
        )

        const totalFee = children.reduce((sum, child) => sum + child.totalFee, 0)
        const totalPaid = children.reduce((sum, child) => sum + child.totalPaid, 0)
        const totalBalance = children.reduce((sum, child) => sum + child.balance, 0)

        return {
            totalFee,
            totalPaid,
            totalBalance,
            generatedAt: new Date().toISOString(),
            children: children.sort((a, b) => b.balance - a.balance || a.studentName.localeCompare(b.studentName)),
        }
    } catch {
        return null
    }
}

// ─── Report-Card Performance ─────────────────────────────────────────────────

/**
 * Subject-wise performance for the child's published report card.
 * Returns an empty list until the class report is published with results
 * visible (authorisation is enforced inside `getPrintableReportCard`).
 */
export async function getChildPerformanceTrend(
    studentId: string,
    _schoolId: string,
): Promise<ChildPerformanceTrendPoint[]> {
    const card = await getPrintableReportCard(studentId)
    if (!card) return []
    return card.subjects.map((s) => ({
        examName: s.subjectName,
        percentage: s.percentage,
        examDate: null,
    }))
}

// ─── Announcements ───────────────────────────────────────────────────────────

export async function getLatestAnnouncements(
    schoolId: string,
    classId?: string | null,
): Promise<AnnouncementRow[]> {
    try {
        const context = await getParentAccessContext(schoolId)
        if (!context) return []

        // Table may not exist yet; fail closed. This query is cast through
        // unknown because the generated DB types may lag this table.
        const { data, error } = await context.db
            .from('announcements')
            .select('id, title, body, created_at, target_class_id, target_audience')
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false })
            .limit(20)

        if (error || !data) return []

        let effectiveClassId = classId ?? null
        if (!effectiveClassId) {
            const linkedChildren = await getLinkedChildrenInternal(context)
            effectiveClassId = linkedChildren[0]?.classId ?? null
        }

        return ((data ?? []) as unknown as AnnouncementRawRow[])
            .filter((a) => parentCanSeeAnnouncement(a.target_audience, a.target_class_id, effectiveClassId))
            .map((a) => ({
                id: a.id,
                title: a.title,
                body: a.body,
                createdAt: a.created_at,
                targetAudience: normalizeAnnouncementAudience(a.target_audience),
            }))
    } catch {
        return []
    }
}

// ─── Homework / Diary (F1.2) ─────────────────────────────────────────────────

export interface ChildHomeworkRow {
    id: string
    title: string
    description: string | null
    homeworkDate: string
    dueDate: string | null
    subjectName: string | null
    postedBy: string | null
}

/** Homework for a parent's linked child (their class, plus section-scoped entries). */
export async function getChildHomework(
    schoolId: string,
    childId: string,
    limit = 50,
): Promise<ChildHomeworkRow[]> {
    const context = await getParentAccessContext(schoolId)
    if (!context) return []

    // Verify the child is linked to this parent and resolve their class/section.
    const { data: link } = await context.db
        .from('parents')
        .select('id, students!inner ( id, class_id, section_id, school_id )')
        .eq('auth_user_id', context.authUserId)
        .eq('student_id', childId)
        .maybeSingle()

    const student = (link as ParentChildHomeworkLink | null)?.students
    if (!student || student.school_id !== schoolId || !student.class_id) return []

    let query = context.db
        .from('homework')
        .select('id, title, description, homework_date, due_date, created_by_name, subjects ( name )')
        .eq('school_id', schoolId)
        .eq('class_id', student.class_id)
        .is('deleted_at', null)
        .order('homework_date', { ascending: false })
        .limit(limit)

    // Section-scoped entries (section_id = child's section) + whole-class (null).
    query = student.section_id
        ? query.or(`section_id.is.null,section_id.eq.${student.section_id}`)
        : query.is('section_id', null)

    const { data, error } = await query
    if (error || !data) return []

    return (data as ChildHomeworkQueryRow[]).map((h) => ({
        id: h.id,
        title: h.title,
        description: h.description,
        homeworkDate: h.homework_date,
        dueDate: h.due_date,
        subjectName: h.subjects?.name ?? null,
        postedBy: h.created_by_name ?? null,
    }))
}

// ─── Timetable (F1.1) ────────────────────────────────────────────────────────

export interface ChildTimetablePeriod {
    id: string
    name: string
    startTime: string | null
    endTime: string | null
    isBreak: boolean
}

export interface ChildTimetableEntry {
    dayOfWeek: number
    periodId: string
    subjectName: string | null
    teacherName: string | null
    room: string | null
}

export interface ChildTimetable {
    periods: ChildTimetablePeriod[]
    entries: ChildTimetableEntry[]
    workingDays: number[]
}

/** Weekly timetable for a parent's linked child (their section). */
export async function getChildTimetable(schoolId: string, childId: string): Promise<ChildTimetable> {
    const empty: ChildTimetable = { periods: [], entries: [], workingDays: normalizeWorkingDays(null) }
    const context = await getParentAccessContext(schoolId)
    if (!context) return empty

    // Verify linkage and resolve the child's section.
    const { data: link } = await context.db
        .from('parents')
        .select('id, students!inner ( id, section_id, school_id )')
        .eq('auth_user_id', context.authUserId)
        .eq('student_id', childId)
        .maybeSingle()

    const student = (link as ParentChildTimetableLink | null)?.students
    if (!student || student.school_id !== schoolId || !student.section_id) return empty

    const [{ data: periods }, { data: entries }, { data: school }] = await Promise.all([
        context.db
            .from('timetable_periods')
            .select('id, name, start_time, end_time, is_break')
            .eq('school_id', schoolId)
            .order('display_order', { ascending: true }),
        context.db
            .from('timetable_entries')
            .select('day_of_week, period_id, room, subjects ( name ), teachers ( employee_id, user_profiles ( full_name ) )')
            .eq('school_id', schoolId)
            .eq('section_id', student.section_id),
        context.db.from('schools').select('working_days').eq('id', schoolId).maybeSingle(),
    ])

    return {
        workingDays: normalizeWorkingDays(school?.working_days),
        periods: ((periods ?? []) as TimetablePeriodQueryRow[]).map((p) => ({
            id: p.id,
            name: p.name,
            startTime: p.start_time,
            endTime: p.end_time,
            isBreak: p.is_break,
        })),
        entries: ((entries ?? []) as TimetableEntryQueryRow[]).map((e) => ({
            dayOfWeek: e.day_of_week,
            periodId: e.period_id,
            subjectName: e.subjects?.name ?? null,
            teacherName: e.teachers?.user_profiles?.full_name ?? null,
            room: e.room,
        })),
    }
}

// ─── Academic calendar (F1.5) ────────────────────────────────────────────────

export interface CalendarEntryRow {
    id: string
    title: string
    category: string
    startDate: string
    endDate: string | null
    description: string | null
}

/** School-wide academic calendar (holidays/events/exams) for the parent portal. */
export async function getSchoolCalendar(schoolId: string): Promise<CalendarEntryRow[]> {
    const context = await getParentAccessContext(schoolId)
    if (!context) return []

    const { data, error } = await context.db
        .from('holidays')
        .select('id, title, category, start_date, end_date, description')
        .eq('school_id', schoolId)
        .is('deleted_at', null)
        .order('start_date', { ascending: true })

    if (error || !data) return []

    return (data as HolidayQueryRow[]).map((h) => ({
        id: h.id,
        title: h.title,
        category: h.category,
        startDate: h.start_date,
        endDate: h.end_date,
        description: h.description,
    }))
}

// ─── Transport (F1.9) ────────────────────────────────────────────────────────

export interface ChildTransport {
    busNumber: string
    routeName: string | null
    registrationNumber: string | null
    driverName: string | null
    driverPhone: string | null
    attendantName: string | null
    attendantPhone: string | null
    stopName: string | null
    pickupTime: string | null
    dropTime: string | null
    pickupPoint: string | null
    feeAmount: number
}

/** The child's bus + driver details (safety) for the parent portal. */
export async function getChildTransport(schoolId: string, childId: string): Promise<ChildTransport | null> {
    const context = await getParentAccessContext(schoolId)
    if (!context) return null

    // Verify linkage.
    const { data: link } = await context.db
        .from('parents')
        .select('id')
        .eq('auth_user_id', context.authUserId)
        .eq('student_id', childId)
        .maybeSingle()
    if (!link) return null

    const { data, error } = await context.db
        .from('student_transport')
        .select('pickup_point, fee_amount, buses ( bus_number, route_name, registration_number, driver_name, driver_phone, attendant_name, attendant_phone ), bus_stops ( name, pickup_time, drop_time )')
        .eq('school_id', schoolId)
        .eq('student_id', childId)
        .maybeSingle()

    if (error || !data) return null

    const row = data as TransportQueryRow
    const bus = row.buses
    if (!bus) return null
    const stop = row.bus_stops

    return {
        busNumber: bus.bus_number,
        routeName: bus.route_name ?? null,
        registrationNumber: bus.registration_number ?? null,
        driverName: bus.driver_name ?? null,
        driverPhone: bus.driver_phone ?? null,
        attendantName: bus.attendant_name ?? null,
        attendantPhone: bus.attendant_phone ?? null,
        stopName: stop?.name ?? null,
        pickupTime: stop?.pickup_time ?? null,
        dropTime: stop?.drop_time ?? null,
        pickupPoint: row.pickup_point ?? null,
        feeAmount: Number(row.fee_amount ?? 0),
    }
}

// ─── Today feed (E2.2) ────────────────────────────────────────────────────────

export type TodayAttendanceStatus =
    | 'present'
    | 'absent'
    | 'late'
    | 'half_day'
    | 'not_marked'

export interface ParentTodayFeed {
    date: string
    child: ParentChildData
    attendanceStatus: TodayAttendanceStatus
    feeBalance: number
    feeTotal: number
    todayHomework: ChildHomeworkRow[]
    upcomingHomework: ChildHomeworkRow[]
    latestAnnouncement: AnnouncementRow | null
}

/**
 * One-glance "Today" summary for a parent's linked child — today's attendance,
 * homework posted today, anything due soon, the outstanding fee balance and the
 * latest notice. Aggregates existing per-section queries so the parent doesn't
 * have to open five tabs.
 */
export async function getParentTodayFeed(
    schoolId: string,
    childId: string,
): Promise<ParentTodayFeed | null> {
    try {
        const context = await getParentAccessContext(schoolId)
        if (!context || !(await isStudentLinkedToParent(context, childId))) return null

        const children = await getLinkedChildrenInternal(context)
        const child = children.find((c) => c.id === childId)
        if (!child) return null

        const today = schoolToday()

        const [attendanceRes, homework, feeStatus, announcements] = await Promise.all([
            context.db
                .from('attendance_records')
                .select('status')
                .eq('student_id', childId)
                .eq('school_id', schoolId)
                .eq('date', today)
                .maybeSingle(),
            getChildHomework(schoolId, childId, 50),
            getChildFeeStatus(childId, schoolId),
            getLatestAnnouncements(schoolId, child.classId),
        ])

        const rawStatus = (attendanceRes.data as { status?: string } | null)?.status
        const attendanceStatus: TodayAttendanceStatus =
            rawStatus === 'present' ||
            rawStatus === 'absent' ||
            rawStatus === 'late' ||
            rawStatus === 'half_day'
                ? rawStatus
                : 'not_marked'

        return {
            date: today,
            child,
            attendanceStatus,
            feeBalance: feeStatus.balance,
            feeTotal: feeStatus.totalFee,
            todayHomework: pickTodayHomework(homework, today),
            upcomingHomework: pickUpcomingDue(homework, today).slice(0, 5),
            latestAnnouncement: announcements[0] ?? null,
        }
    } catch {
        return null
    }
}
