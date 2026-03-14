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

export async function getParentChildData(
    parentEmail: string,
    schoolId: string,
): Promise<ParentChildData | null> {
    const supabase = await createClient()

    const { data } = await supabase
        .from('students')
        .select('id, full_name, admission_number, class_id, section_id, classes(name), sections(name)')
        .eq('school_id', schoolId)
        .eq('parent_email', parentEmail)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

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
        .from('attendance')
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

export async function getChildFeeStatus(
    studentId: string,
    schoolId: string,
): Promise<ChildFeeStatus> {
    const supabase = await createClient()

    // Get student's class
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
