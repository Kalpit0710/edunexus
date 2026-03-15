'use server'

import { createClient } from '@/lib/supabase/server'

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
