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

export async function createStudent(schoolId: string, studentData: any) {
    const supabase = await getSupabase()

    // First, verify class and section exist
    if (studentData.class_id && studentData.section_id) {
        // Proceed to construct the insertion body
    }

    // Map application state to the database schema
    const nameParts = [studentData.first_name, studentData.middle_name, studentData.last_name]
        .filter(Boolean)
        .join(' ')
    const payload = {
        school_id: schoolId,
        full_name: nameParts || studentData.full_name || '',
        gender: studentData.gender,
        date_of_birth: studentData.date_of_birth,
        admission_date: studentData.admission_date || studentData.date_of_joining,
        admission_number: studentData.admission_number,
        roll_number: studentData.roll_number,
        class_id: studentData.class_id,
        section_id: studentData.section_id,
        is_active: true,
        address: studentData.address,
        blood_group: studentData.blood_group,
        photo_url: studentData.photo_url || null
    }

    const { error } = await supabase
        .from('students')
        .insert([payload] as any)

    if (error) throw new Error(error.message)
    return true
}

export async function uploadStudentPhoto(formData: FormData) {
    const file = formData.get('file') as File;
    const schoolId = formData.get('schoolId') as string;
    if (!file || !schoolId) throw new Error('Missing file or schoolId');

    const supabase = await getSupabase();

    const fileExt = file.name.split('.').pop();
    const fileName = `${schoolId}/${crypto.randomUUID()}.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data, error } = await supabase.storage
        .from('student-photos')
        .upload(fileName, buffer, {
            contentType: file.type,
            upsert: false
        });

    if (error) {
        throw new Error('Failed to upload. Ensure "student-photos" bucket exists. ' + error.message);
    }

    const { data: urlData } = supabase.storage
        .from('student-photos')
        .getPublicUrl(fileName);

    return urlData.publicUrl;
}

export async function getClassesAndSections(schoolId: string) {
    const supabase = await getSupabase()

    const { data: classes, error: cErr } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', schoolId)
        .order('display_order', { ascending: true })

    if (cErr) throw new Error(cErr.message)

    const { data: sections, error: sErr } = await supabase
        .from('sections')
        .select('*')
        .eq('school_id', schoolId)

    if (sErr) throw new Error(sErr.message)

    return { classes, sections }
}
