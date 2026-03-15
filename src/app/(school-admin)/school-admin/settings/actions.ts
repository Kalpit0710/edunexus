'use server'

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
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                    }
                },
            },
        }
    )
}

export async function getSchoolSettings(schoolId: string) {
    const supabase = await getSupabase()
    const { data, error } = await supabase
        .from('schools')
        .select('*')
        .eq('id', schoolId)
        .single()

    if (error) throw new Error(error.message)
    return data
}

export async function updateSchoolSettings(schoolId: string, data: Database['public']['Tables']['schools']['Update']) {
    const supabase = await getSupabase()

    const { error } = await supabase
        .from('schools')
        // @ts-expect-error
        .update(data)
        .eq('id', schoolId)

    if (error) throw new Error(error.message)
    return true
}

export async function getClasses(schoolId: string) {
    const supabase = await getSupabase()
    const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', schoolId)
        .order('display_order', { ascending: true })

    if (error) throw new Error(error.message)
    return data
}

export async function getSections(schoolId: string) {
    const supabase = await getSupabase()
    const { data, error } = await supabase
        .from('sections')
        .select('*, class:classes(name)')
        .eq('school_id', schoolId)
        .order('name', { ascending: true })

    if (error) throw new Error(error.message)
    return data
}

export async function getSubjects(schoolId: string) {
    const supabase = await getSupabase()
    const { data, error } = await supabase
        .from('subjects')
        .select('*, class:classes(name)')
        .eq('school_id', schoolId)
        .order('name', { ascending: true })

    if (error) throw new Error(error.message)
    return data
}

export async function createClass(schoolId: string, name: string, displayOrder: number) {
    const supabase = await getSupabase()
    const { error } = await supabase
        .from('classes')
        // @ts-expect-error
        .insert([{ school_id: schoolId, name, display_order: displayOrder }])
    if (error) throw new Error(error.message)
}

export async function deleteClass(classId: string) {
    const supabase = await getSupabase()
    const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', classId)
    if (error) throw new Error(error.message)
}

export async function createSection(schoolId: string, classId: string, name: string, capacity: number) {
    const supabase = await getSupabase()
    const { error } = await supabase
        .from('sections')
        // @ts-expect-error
        .insert([{ school_id: schoolId, class_id: classId, name, capacity }])
    if (error) throw new Error(error.message)
}

export async function deleteSection(sectionId: string) {
    const supabase = await getSupabase()
    const { error } = await supabase
        .from('sections')
        .delete()
        .eq('id', sectionId)
    if (error) throw new Error(error.message)
}

export async function createSubject(schoolId: string, classId: string, name: string, code: string) {
    const supabase = await getSupabase()
    const { error } = await supabase
        .from('subjects')
        // @ts-expect-error
        .insert([{ school_id: schoolId, class_id: classId, name, code }])
    if (error) throw new Error(error.message)
}

export async function deleteSubject(subjectId: string) {
    const supabase = await getSupabase()
    const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', subjectId)
    if (error) throw new Error(error.message)
}

export async function getAcademicYears(schoolId: string) {
    const supabase = await getSupabase()
    const { data, error } = await supabase
        .from('academic_years')
        .select('*')
        .eq('school_id', schoolId)
        .order('start_date', { ascending: false })
    if (error) throw new Error(error.message)
    return data
}

export async function createAcademicYear(schoolId: string, name: string, startDate: string, endDate: string, isCurrent: boolean) {
    const supabase = await getSupabase()

    if (isCurrent) {
        // Find existing current and set to false
        const payload = { is_current: false } as any
        const updateReq = supabase.from('academic_years')
        // @ts-expect-error
        await updateReq.update(payload).eq('school_id', schoolId).eq('is_current', true)
    }

    const insertReq = supabase.from('academic_years')
    // @ts-expect-error
    const { error } = await insertReq.insert([{ school_id: schoolId, name, start_date: startDate, end_date: endDate, is_current: isCurrent }])
    if (error) throw new Error(error.message)
}

export async function deleteAcademicYear(id: string) {
    const supabase = await getSupabase()
    const { error } = await supabase
        .from('academic_years')
        .delete()
        .eq('id', id)
    if (error) throw new Error(error.message)
}

export async function getGradingRules(schoolId: string) {
    const supabase = await getSupabase()
    const { data, error } = await supabase
        .from('grading_rules')
        .select('*')
        .eq('school_id', schoolId)
        .order('min_marks', { ascending: false })
    if (error) throw new Error(error.message)
    return data
}

export async function createGradingRule(schoolId: string, minMarks: number, maxMarks: number, gradeName: string, gradePoint: number) {
    const supabase = await getSupabase()
    const { error } = await supabase
        .from('grading_rules')
        // @ts-expect-error
        .insert([{ school_id: schoolId, min_marks: minMarks, max_marks: maxMarks, grade_name: gradeName, grade_point: gradePoint }])
    if (error) throw new Error(error.message)
}

export async function deleteGradingRule(id: string) {
    const supabase = await getSupabase()
    const { error } = await supabase
        .from('grading_rules')
        .delete()
        .eq('id', id)
    if (error) throw new Error(error.message)
}
