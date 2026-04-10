'use server'

import { createClient } from '@/lib/supabase/server'
import {
    calculateAverage,
    calculateGrowthPercentage,
    calculateMarksPercentage,
    calculatePassRate,
} from '@/lib/analytics-utils'

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

export async function getAttendanceSummaryByClass(
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
    for (const sec of sections as any[]) {
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

export async function getFeeCollectionSummary(
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
        .eq('academic_year_id', (yearData as any).id)
        .eq('is_active', true)

    const { data: payments } = await supabase
        .from('fee_payments')
        .select('paid_amount')
        .eq('school_id', schoolId)

    // Count active students for total potential
    const { count: studentCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('is_active', true)

    const totalStructureSum = (structures ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0)
    const totalFee = totalStructureSum  // approximate: sum of all distinct structures
    const totalCollected = (payments ?? []).reduce((s: number, r: any) => s + Number(r.paid_amount), 0)
    const totalOutstanding = Math.max(0, totalFee - totalCollected)
    const collectionPercentage = totalFee > 0 ? Math.round((totalCollected / totalFee) * 100) : 0

    return { totalFee, totalCollected, totalOutstanding, collectionPercentage }
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
    for (const cls of classes as any[]) {
        const { data: students } = await supabase
            .from('students')
            .select('gender')
            .eq('school_id', schoolId)
            .eq('class_id', cls.id)
            .eq('is_active', true)

        const male = (students ?? []).filter((s: any) => s.gender === 'male').length
        const female = (students ?? []).filter((s: any) => s.gender === 'female').length
        const other = (students ?? []).length - male - female
        if ((students ?? []).length > 0) {
            results.push({ className: cls.name, maleCount: male, femaleCount: female, otherCount: other, total: (students ?? []).length })
        }
    }
    return results
}

export async function getWeeklyCollectionTrend(
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

        const amount = (data ?? []).reduce((s: number, r: any) => s + Number(r.paid_amount), 0)
        days.push({ date: dateStr, amount })
    }
    return days
}

export async function getFeeMomentumSummary(
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

        const amount = (data ?? []).reduce((sum: number, row: any) => sum + Number(row.paid_amount ?? 0), 0)
        if (i < 7) {
            currentWeekTotal += amount
        } else {
            previousWeekTotal += amount
        }
    }

    const growthPercentage = calculateGrowthPercentage(currentWeekTotal, previousWeekTotal)

    return {
        currentWeekTotal,
        previousWeekTotal,
        growthPercentage,
        averageDailyCurrentWeek: calculateAverage(currentWeekTotal, 7, 0),
    }
}

export async function getExamAnalyticsSummary(
    schoolId: string,
): Promise<ExamAnalyticsSummary> {
    const supabase = await createClient()

    const { data: examsData } = await supabase
        .from('exams')
        .select('id, name, class_id, created_at')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(30)

    const exams = (examsData ?? []) as Array<{
        id: string
        name: string
        class_id: string
        created_at: string
    }>

    if (!exams.length) {
        return {
            passRateTrend: [],
            subjectDifficulty: [],
            classComparison: [],
        }
    }

    const examIds = exams.map((exam) => exam.id)
    const classIds = Array.from(new Set(exams.map((exam) => exam.class_id)))

    const [{ data: classRows }, { data: examSubjectsData }, { data: marksData }] = await Promise.all([
        supabase
            .from('classes')
            .select('id, name')
            .eq('school_id', schoolId)
            .in('id', classIds)
            .limit(200),
        supabase
            .from('exam_subjects')
            .select('id, exam_id, subject_id, pass_marks, max_marks, subjects(name)')
            .eq('school_id', schoolId)
            .in('exam_id', examIds)
            .limit(1000),
        supabase
            .from('marks')
            .select('exam_id, exam_subject_id, marks_obtained, is_absent')
            .eq('school_id', schoolId)
            .in('exam_id', examIds)
            .limit(50000),
    ])

    const classRowsList = (classRows ?? []) as any[]
    const examSubjectsRows = (examSubjectsData ?? []) as any[]
    const marksRows = (marksData ?? []) as any[]

    const classNameById = new Map<string, string>(classRowsList.map((row: any) => [row.id, row.name]))

    const examSubjectById = new Map<string, any>()
    for (const examSubject of examSubjectsRows) {
        examSubjectById.set(examSubject.id, examSubject)
    }

    const passRateTrend = exams.map((exam) => {
        const examMarks = marksRows.filter((row: any) => row.exam_id === exam.id && !row.is_absent)
        const totalEntries = examMarks.length
        let passCount = 0

        for (const mark of examMarks) {
            const examSubject = examSubjectById.get(mark.exam_subject_id)
            if (examSubject && Number(mark.marks_obtained ?? 0) >= Number(examSubject.pass_marks ?? 0)) {
                passCount += 1
            }
        }

        const passRate = calculatePassRate(passCount, totalEntries)
        return {
            examName: exam.name,
            passRate,
            totalEntries,
        }
    }).slice(0, 8).reverse()

    const subjectAccumulator = new Map<string, {
        subjectName: string
        passCount: number
        totalCount: number
        percentageSum: number
    }>()

    for (const mark of marksRows) {
        if (mark.is_absent) continue
        const examSubject = examSubjectById.get(mark.exam_subject_id)
        if (!examSubject) continue

        const subjectId = String(examSubject.subject_id)
        const subjectName = examSubject.subjects?.name ?? 'Subject'
        const current = subjectAccumulator.get(subjectId) ?? {
            subjectName,
            passCount: 0,
            totalCount: 0,
            percentageSum: 0,
        }

        const marks = Number(mark.marks_obtained ?? 0)
        const maxMarks = Number(examSubject.max_marks ?? 0)
        const passMarks = Number(examSubject.pass_marks ?? 0)

        current.totalCount += 1
        current.percentageSum += calculateMarksPercentage(marks, maxMarks)
        if (marks >= passMarks) {
            current.passCount += 1
        }

        subjectAccumulator.set(subjectId, current)
    }

    const subjectDifficulty = Array.from(subjectAccumulator.values())
        .map((entry) => ({
            subjectName: entry.subjectName,
            passRate: calculatePassRate(entry.passCount, entry.totalCount),
            averagePercentage: calculateAverage(entry.percentageSum, entry.totalCount, 0),
        }))
        .sort((a, b) => a.passRate - b.passRate)
        .slice(0, 8)

    const classAccumulator = new Map<string, { className: string; percentageSum: number; totalCount: number }>()
    const examById = new Map<string, { class_id: string }>(exams.map((exam) => [exam.id, { class_id: exam.class_id }]))

    for (const mark of marksRows) {
        if (mark.is_absent) continue
        const exam = examById.get(mark.exam_id)
        const examSubject = examSubjectById.get(mark.exam_subject_id)
        if (!exam || !examSubject) continue

        const classId = exam.class_id
        const className = classNameById.get(classId) ?? 'Unknown Class'
        const maxMarks = Number(examSubject.max_marks ?? 0)
        const marks = Number(mark.marks_obtained ?? 0)
        const percentage = calculateMarksPercentage(marks, maxMarks)

        const current = classAccumulator.get(classId) ?? { className, percentageSum: 0, totalCount: 0 }
        current.percentageSum += percentage
        current.totalCount += 1
        classAccumulator.set(classId, current)
    }

    const classComparison = Array.from(classAccumulator.values())
        .map((entry) => ({
            className: entry.className,
            averagePercentage: calculateAverage(entry.percentageSum, entry.totalCount, 0),
            totalEntries: entry.totalCount,
        }))
        .sort((a, b) => b.averagePercentage - a.averagePercentage)
        .slice(0, 8)

    return {
        passRateTrend,
        subjectDifficulty,
        classComparison,
    }
}
