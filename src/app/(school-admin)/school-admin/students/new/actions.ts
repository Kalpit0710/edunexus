'use server'

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database.types'
import { createAdminClient } from '@/lib/supabase/server'
import { syncPrimaryParentForStudent } from '@/lib/student-parent-sync'
import { normalizeParentContact } from '@/lib/student-parent-link'

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

interface ActorProfile {
    school_id: string | null
    role: string
}

interface CreatedStudentRow {
    id: string
    full_name: string
}

type StudentGender = Database['public']['Enums']['gender']

interface StudentCreateInput {
    first_name?: string
    middle_name?: string
    last_name?: string
    full_name?: string
    gender?: string | null
    date_of_birth?: string | null
    admission_date?: string | null
    date_of_joining?: string | null
    admission_number?: string
    roll_number?: string | null
    class_id?: string | null
    section_id?: string | null
    address?: string | null
    blood_group?: string | null
    photo_url?: string | null
    parent_name?: string | null
    parent_email?: string | null
    parent_contact?: string | null
}

function normalizeGender(value: string | null | undefined): StudentGender | null {
    if (!value) return null

    const normalized = value.trim().toLowerCase()
    if (normalized === 'male' || normalized === 'female' || normalized === 'other') {
        return normalized
    }

    return null
}

async function getActorProfile(supabase: Awaited<ReturnType<typeof getSupabase>>): Promise<ActorProfile> {
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
        throw new Error('Session expired. Please sign in again.')
    }

    const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('school_id, role')
        .eq('auth_user_id', user.id)
        .maybeSingle()

    if (profileError || !profile) {
        throw new Error('Unable to resolve your user profile. Please contact support.')
    }

    return profile as ActorProfile
}

export async function createStudent(_schoolId: string, studentData: StudentCreateInput) {
    const supabase = await getSupabase()
    const actorProfile = await getActorProfile(supabase)

    if (actorProfile.role !== 'school_admin') {
        throw new Error('Only School Admin can add students.')
    }

    if (!actorProfile.school_id) {
        throw new Error('Your account is not linked to any school.')
    }

    const effectiveSchoolId = actorProfile.school_id

    // First, verify class and section exist
    if (studentData.class_id && studentData.section_id) {
        // Proceed to construct the insertion body
    }

    // Map application state to the database schema
    const nameParts = [studentData.first_name, studentData.middle_name, studentData.last_name]
        .filter(Boolean)
        .join(' ')

    const normalizedSectionId = typeof studentData.section_id === 'string' && studentData.section_id.trim() === ''
        ? null
        : studentData.section_id ?? null

    const payload: Database['public']['Tables']['students']['Insert'] = {
        school_id: effectiveSchoolId,
        full_name: nameParts || studentData.full_name || '',
        gender: normalizeGender(studentData.gender),
        date_of_birth: studentData.date_of_birth ?? null,
        admission_date: studentData.admission_date || studentData.date_of_joining || undefined,
        admission_number: studentData.admission_number || '',
        roll_number: studentData.roll_number ?? null,
        class_id: studentData.class_id ?? null,
        section_id: normalizedSectionId,
        is_active: true,
        address: studentData.address ?? null,
        blood_group: studentData.blood_group ?? null,
        photo_url: studentData.photo_url || null,
    }

    const { data: createdStudent, error } = await supabase
        .from('students')
        // @ts-expect-error Supabase generated types currently resolve insert values to never.
        .insert([payload])
        .select('id, full_name')
        .single() as { data: CreatedStudentRow | null; error: { message: string } | null }

    if (error) {
        if (/row-level security/i.test(error.message)) {
            throw new Error('You are not permitted to add students in this school.')
        }
        throw new Error(error.message)
    }

    const normalizedParent = normalizeParentContact({
        parent_name: studentData.parent_name,
        parent_email: studentData.parent_email,
        parent_contact: studentData.parent_contact,
    })

    if (createdStudent?.id && normalizedParent.hasDetails) {
        const admin = await createAdminClient()

        try {
            await syncPrimaryParentForStudent(admin, {
                schoolId: effectiveSchoolId,
                studentId: createdStudent.id,
                studentFullName: createdStudent.full_name,
                parentName: normalizedParent.parentName,
                parentEmail: normalizedParent.parentEmail,
                parentContact: normalizedParent.parentPhone,
            })
        } catch (parentSyncError: unknown) {
            const parentSyncMessage = parentSyncError instanceof Error
                ? parentSyncError.message
                : 'Unknown parent sync error'
            throw new Error(`Student created, but parent details could not be saved: ${parentSyncMessage}`)
        }
    }

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

    const { error } = await supabase.storage
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

export async function getClassesAndSections(_schoolId: string) {
    const supabase = await getSupabase()
    const actorProfile = await getActorProfile(supabase)

    if (!actorProfile.school_id) {
        throw new Error('Your account is not linked to any school.')
    }

    const effectiveSchoolId = actorProfile.school_id

    const { data: classes, error: cErr } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', effectiveSchoolId)
        .order('display_order', { ascending: true })

    if (cErr) throw new Error(cErr.message)

    const { data: sections, error: sErr } = await supabase
        .from('sections')
        .select('*')
        .eq('school_id', effectiveSchoolId)

    if (sErr) throw new Error(sErr.message)

    return { classes, sections }
}
