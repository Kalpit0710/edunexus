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

export async function getStudents(schoolId: string) {
    const supabase = await getSupabase()
    const { data, error } = await supabase
        .from('students')
        .select('*, class:classes(name), section:sections(name)')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('full_name', { ascending: true })

    if (error) throw new Error(error.message)
    return data
}

export async function deleteStudent(studentId: string) {
    const supabase = await getSupabase()
    const { error } = await supabase
        .from('students')
        // @ts-expect-error
        .update({ is_active: false } as any)
        .eq('id', studentId)

    if (error) throw new Error(error.message)
}

export async function getStudentById(id: string) {
    const supabase = await getSupabase()
    const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', id)
        .single()
    if (error) throw new Error(error.message)
    return data as any
}

export async function updateStudent(id: string, payload: any) {
    const supabase = await getSupabase()
    const { error } = await supabase
        .from('students')
        // @ts-expect-error
        .update(payload)
        .eq('id', id)
    if (error) throw new Error(error.message)
    return true
}

export async function bulkCreateStudents(schoolId: string, studentsData: any[]) {
    const supabase = await getSupabase()

    // Add school_id and default status to each payload
    const payloads = studentsData.map(student => ({
        ...student,
        school_id: schoolId,
        is_active: true
    }))

    const { error } = await supabase
        .from('students')
        // @ts-expect-error
        .insert(payloads)

    if (error) throw new Error(error.message)
    return true
}
