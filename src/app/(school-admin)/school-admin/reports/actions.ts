'use server'

import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
    calcStandardSubjectResult,
    calcLowerSubjectResult,
    DEFAULT_STANDARD_MAX,
    type StandardMaxMarks,
    type LowerComponent,
    type MarksMap,
    type SubjectResult,
} from '@/lib/report-card-utils'
import type { Database } from '@/types/database.types'

type SectionSummaryRow = Pick<Database['public']['Tables']['sections']['Row'], 'id' | 'name' | 'class_id'> & {
    classes: { name: string } | null
}
type StudentGenderRow = Pick<Database['public']['Tables']['students']['Row'], 'gender'>
type ClassNameRow = Pick<Database['public']['Tables']['classes']['Row'], 'id' | 'name'>
type FeeStructureAmountRow = Pick<Database['public']['Tables']['fee_structures']['Row'], 'amount'>
type FeePaymentAmountRow = Pick<Database['public']['Tables']['fee_payments']['Row'], 'paid_amount'>

export interface ClassAttendanceSummary {
    className: string
    sectionName: string
    totalStudents: number
    presentCount: number
    percentage: number
}

export interface FeeCollectionSummary {
    totalFee: number
    totalCollected: number
    totalOutstanding: number
    collectionPercentage: number
}

export interface EnrollmentStat {
    className: string
    maleCount: number
    femaleCount: number
    otherCount: number
    total: number
}

export interface FeeMomentumSummary {
    currentWeekTotal: number
    previousWeekTotal: number
    growthPercentage: number
    averageDailyCurrentWeek: number
}

export interface ExamPassRateTrendPoint {
    examName: string
    passRate: number
    totalEntries: number
}

export interface SubjectDifficultyPoint {
    subjectName: string
    passRate: number
    averagePercentage: number
}

export interface ClassComparisonPoint {
    className: string
    averagePercentage: number
    totalEntries: number
}

export interface ExamAnalyticsSummary {
    passRateTrend: ExamPassRateTrendPoint[]
    subjectDifficulty: SubjectDifficultyPoint[]
    classComparison: ClassComparisonPoint[]
}

async function getAttendanceSummaryByClassUncached(
    schoolId: string,
    month: number,
    year: number,
): Promise<ClassAttendanceSummary[]> {
    const supabase = await createClient()

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]!

    const { data: sections } = await supabase
        .from('sections')
        .select('id, name, class_id, classes(name)')
        .eq('school_id', schoolId)
        .order('name')

    if (!sections?.length) return []

    const results: ClassAttendanceSummary[] = []
    const sectionRows = (sections ?? []) as SectionSummaryRow[]
    for (const sec of sectionRows) {
        const { count: studentCount } = await supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', schoolId)
            .eq('section_id', sec.id)
            .eq('is_active', true)

        const { count: presentCount } = await supabase
            .from('attendance_records')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', schoolId)
            .eq('section_id', sec.id)
            .eq('status', 'present')
            .gte('date', startDate)
            .lte('date', endDate)

        const total = studentCount ?? 0
        const present = presentCount ?? 0
        // Calculate working days in period
        const { count: attendanceDayCount } = await supabase
            .from('attendance_records')
            .select('date', { count: 'exact', head: true })
            .eq('school_id', schoolId)
            .eq('section_id', sec.id)
            .gte('date', startDate)
            .lte('date', endDate)

        const maxPossible = total * (attendanceDayCount && total ? Math.round((attendanceDayCount as number) / total) : 1)
        const pct = maxPossible > 0 ? Math.round((present / maxPossible) * 100) : 0

        results.push({
            className: sec.classes?.name ?? '',
            sectionName: sec.name,
            totalStudents: total,
            presentCount: present,
            percentage: Math.min(100, pct),
        })
    }
    return results
}

const getAttendanceSummaryByClassCached = unstable_cache(getAttendanceSummaryByClassUncached, ['reports-attendance-summary'], {
    revalidate: 120,
})

export async function getAttendanceSummaryByClass(
    schoolId: string,
    month: number,
    year: number,
): Promise<ClassAttendanceSummary[]> {
    return getAttendanceSummaryByClassCached(schoolId, month, year)
}

async function getFeeCollectionSummaryUncached(
    schoolId: string,
): Promise<FeeCollectionSummary> {
    const supabase = await createClient()

    const { data: yearData } = await supabase
        .from('academic_years')
        .select('id')
        .eq('school_id', schoolId)
        .eq('is_current', true)
        .single()

    if (!yearData) return { totalFee: 0, totalCollected: 0, totalOutstanding: 0, collectionPercentage: 0 }

    const { data: structures } = await supabase
        .from('fee_structures')
        .select('amount')
        .eq('school_id', schoolId)
        .eq('academic_year_id', yearData.id)
        .eq('is_active', true)

    const { data: payments } = await supabase
        .from('fee_payments')
        .select('paid_amount')
        .eq('school_id', schoolId)

    // Count active students for total potential
    await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('is_active', true)

    const totalStructureSum = ((structures ?? []) as FeeStructureAmountRow[])
        .reduce((sum, row) => sum + Number(row.amount ?? 0), 0)
    const totalFee = totalStructureSum  // approximate: sum of all distinct structures
    const totalCollected = ((payments ?? []) as FeePaymentAmountRow[])
        .reduce((sum, row) => sum + Number(row.paid_amount ?? 0), 0)
    const totalOutstanding = Math.max(0, totalFee - totalCollected)
    const collectionPercentage = totalFee > 0 ? Math.round((totalCollected / totalFee) * 100) : 0

    return { totalFee, totalCollected, totalOutstanding, collectionPercentage }
}

const getFeeCollectionSummaryCached = unstable_cache(getFeeCollectionSummaryUncached, ['reports-fee-collection-summary'], {
    revalidate: 120,
})

export async function getFeeCollectionSummary(
    schoolId: string,
): Promise<FeeCollectionSummary> {
    return getFeeCollectionSummaryCached(schoolId)
}

export async function getStudentEnrollmentStats(schoolId: string): Promise<EnrollmentStat[]> {
    const supabase = await createClient()

    const { data: classes } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', schoolId)
        .order('name')

    if (!classes?.length) return []

    const results: EnrollmentStat[] = []
    const classRows = (classes ?? []) as ClassNameRow[]
    for (const cls of classRows) {
        const { data: students } = await supabase
            .from('students')
            .select('gender')
            .eq('school_id', schoolId)
            .eq('class_id', cls.id)
            .eq('is_active', true)

        const studentRows = (students ?? []) as StudentGenderRow[]
        const male = studentRows.filter((s) => s.gender === 'male').length
        const female = studentRows.filter((s) => s.gender === 'female').length
        const other = studentRows.length - male - female
        if (studentRows.length > 0) {
            results.push({ className: cls.name, maleCount: male, femaleCount: female, otherCount: other, total: studentRows.length })
        }
    }
    return results
}

async function getWeeklyCollectionTrendUncached(
    schoolId: string,
): Promise<{ date: string; amount: number }[]> {
    const supabase = await createClient()
    const days: { date: string; amount: number }[] = []

    for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]!

        const { data } = await supabase
            .from('fee_payments')
            .select('paid_amount')
            .eq('school_id', schoolId)
            .eq('payment_date', dateStr)

        const amount = ((data ?? []) as FeePaymentAmountRow[])
            .reduce((sum, row) => sum + Number(row.paid_amount ?? 0), 0)
        days.push({ date: dateStr, amount })
    }
    return days
}

const getWeeklyCollectionTrendCached = unstable_cache(getWeeklyCollectionTrendUncached, ['reports-weekly-collection-trend'], {
    revalidate: 120,
})

export async function getWeeklyCollectionTrend(
    schoolId: string,
): Promise<{ date: string; amount: number }[]> {
    return getWeeklyCollectionTrendCached(schoolId)
}

async function getFeeMomentumSummaryUncached(
    schoolId: string,
): Promise<FeeMomentumSummary> {
    const supabase = await createClient()

    let currentWeekTotal = 0
    let previousWeekTotal = 0

    for (let i = 0; i < 14; i++) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]!

        const { data } = await supabase
            .from('fee_payments')
            .select('paid_amount')
            .eq('school_id', schoolId)
            .eq('payment_date', dateStr)

        const amount = ((data ?? []) as FeePaymentAmountRow[])
            .reduce((sum, row) => sum + Number(row.paid_amount ?? 0), 0)
        if (i < 7) {
            currentWeekTotal += amount
        } else {
            previousWeekTotal += amount
        }
    }

    const growthPercentage = previousWeekTotal > 0
        ? Math.round(((currentWeekTotal - previousWeekTotal) / previousWeekTotal) * 100)
        : (currentWeekTotal > 0 ? 100 : 0)

    return {
        currentWeekTotal,
        previousWeekTotal,
        growthPercentage,
        averageDailyCurrentWeek: Math.round(currentWeekTotal / 7),
    }
}

const getFeeMomentumSummaryCached = unstable_cache(getFeeMomentumSummaryUncached, ['reports-fee-momentum-summary'], {
    revalidate: 120,
})

export async function getFeeMomentumSummary(
    schoolId: string,
): Promise<FeeMomentumSummary> {
    return getFeeMomentumSummaryCached(schoolId)
}

const PASS_PERCENTAGE = 33

async function getExamAnalyticsSummaryUncached(
    schoolId: string,
): Promise<ExamAnalyticsSummary> {
    const supabase = await createClient()

    const [{ data: classData }, { data: subjectData }, { data: configData }, { data: marksData }] = await Promise.all([
        supabase
            .from('classes')
            .select('id, name, report_card_type')
            .eq('school_id', schoolId)
            .limit(200),
        supabase
            .from('subjects')
            .select('id, name')
            .eq('school_id', schoolId)
            .limit(2000),
        supabase
            .from('report_subject_configs')
            .select('class_id, subject_id, max_marks, components')
            .eq('school_id', schoolId)
            .is('deleted_at', null)
            .limit(5000),
        supabase
            .from('report_scholastic_marks')
            .select('class_id, student_id, subject_id, term1, term2')
            .eq('school_id', schoolId)
            .limit(50000),
    ])

    const classes = (classData ?? []) as Array<{ id: string; name: string; report_card_type: string | null }>
    const subjects = (subjectData ?? []) as Array<{ id: string; name: string }>
    const configs = (configData ?? []) as Array<{ class_id: string; subject_id: string; max_marks: unknown; components: unknown }>
    const marks = (marksData ?? []) as Array<{ class_id: string; student_id: string; subject_id: string; term1: unknown; term2: unknown }>

    if (!marks.length) {
        return { passRateTrend: [], subjectDifficulty: [], classComparison: [] }
    }

    const classById = new Map(classes.map((c) => [c.id, c]))
    const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]))
    const configByKey = new Map(configs.map((c) => [`${c.class_id}:${c.subject_id}`, c]))

    function computeSubject(row: { class_id: string; subject_id: string; term1: unknown; term2: unknown }): SubjectResult | null {
        const cls = classById.get(row.class_id)
        const config = configByKey.get(`${row.class_id}:${row.subject_id}`)
        const term1 = (row.term1 ?? {}) as MarksMap
        const term2 = (row.term2 ?? {}) as MarksMap
        if (cls?.report_card_type === 'lower') {
            const components = (config?.components ?? []) as LowerComponent[]
            if (!components.length) return null
            return calcLowerSubjectResult(term1, term2, components)
        }
        const max = (config?.max_marks ?? DEFAULT_STANDARD_MAX) as StandardMaxMarks
        return calcStandardSubjectResult(term1, term2, max)
    }

    const subjectAcc = new Map<string, { subjectName: string; passCount: number; totalCount: number; percentageSum: number }>()
    const studentAcc = new Map<string, { classId: string; results: SubjectResult[] }>()

    for (const row of marks) {
        const result = computeSubject(row)
        if (!result) continue

        const subjectName = subjectNameById.get(row.subject_id) ?? 'Subject'
        const sAcc = subjectAcc.get(row.subject_id) ?? { subjectName, passCount: 0, totalCount: 0, percentageSum: 0 }
        sAcc.totalCount += 1
        sAcc.percentageSum += result.percentage
        if (result.percentage >= PASS_PERCENTAGE) sAcc.passCount += 1
        subjectAcc.set(row.subject_id, sAcc)

        const stAcc = studentAcc.get(row.student_id) ?? { classId: row.class_id, results: [] }
        stAcc.results.push(result)
        studentAcc.set(row.student_id, stAcc)
    }

    const subjectDifficulty = Array.from(subjectAcc.values())
        .map((e) => ({
            subjectName: e.subjectName,
            passRate: e.totalCount ? Math.round((e.passCount / e.totalCount) * 100) : 0,
            averagePercentage: e.totalCount ? Math.round(e.percentageSum / e.totalCount) : 0,
        }))
        .sort((a, b) => a.passRate - b.passRate)
        .slice(0, 8)

    const classAcc = new Map<string, { className: string; percentageSum: number; studentCount: number; passCount: number }>()
    for (const st of studentAcc.values()) {
        const totalObtained = st.results.reduce((s, r) => s + r.grandTotal, 0)
        const totalMax = st.results.reduce((s, r) => s + r.maxGrandTotal, 0)
        const overall = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0
        const className = classById.get(st.classId)?.name ?? 'Unknown Class'
        const acc = classAcc.get(st.classId) ?? { className, percentageSum: 0, studentCount: 0, passCount: 0 }
        acc.percentageSum += overall
        acc.studentCount += 1
        if (overall >= PASS_PERCENTAGE) acc.passCount += 1
        classAcc.set(st.classId, acc)
    }

    const classComparison = Array.from(classAcc.values())
        .map((e) => ({
            className: e.className,
            averagePercentage: e.studentCount ? Math.round(e.percentageSum / e.studentCount) : 0,
            totalEntries: e.studentCount,
        }))
        .sort((a, b) => b.averagePercentage - a.averagePercentage)
        .slice(0, 8)

    const passRateTrend = Array.from(classAcc.values())
        .map((e) => ({
            examName: e.className,
            passRate: e.studentCount ? Math.round((e.passCount / e.studentCount) * 100) : 0,
            totalEntries: e.studentCount,
        }))
        .sort((a, b) => a.examName.localeCompare(b.examName))
        .slice(0, 8)

    return { passRateTrend, subjectDifficulty, classComparison }
}

const getExamAnalyticsSummaryCached = unstable_cache(getExamAnalyticsSummaryUncached, ['reports-exam-analytics-summary'], {
    revalidate: 120,
})

export async function getExamAnalyticsSummary(
    schoolId: string,
): Promise<ExamAnalyticsSummary> {
    return getExamAnalyticsSummaryCached(schoolId)
}
