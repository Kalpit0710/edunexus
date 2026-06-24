'use server'

import type { Database } from '@/types/database.types'
import { createAdminClient, createClient as getSupabase } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/permissions'
import { normalizeParentContact } from '@/lib/student-parent-link'
import { syncPrimaryParentForStudent, unlinkParentsForStudent } from '@/lib/student-parent-sync'

interface ActorProfile {
    school_id: string | null
    role: string
}

interface StudentIdentityRow {
    id: string
    school_id: string
    full_name: string
    admission_number: string
}

interface ParentSummaryRow {
    student_id: string
    full_name: string
    phone: string | null
    email: string | null
}

async function getActorProfile(
    supabase: Awaited<ReturnType<typeof getSupabase>>,
): Promise<ActorProfile> {
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

function assertSchoolAdmin(actorProfile: ActorProfile) {
    if (actorProfile.role !== 'school_admin') {
        throw new Error('Only School Admin can manage student records.')
    }

    if (!actorProfile.school_id) {
        throw new Error('Your account is not linked to any school.')
    }
}

function splitFullName(fullName: string) {
    const parts = fullName
        .trim()
        .split(/\s+/)
        .filter(Boolean)

    if (parts.length === 0) {
        return { first_name: '', middle_name: '', last_name: '' }
    }

    if (parts.length === 1) {
        return { first_name: parts[0] ?? '', middle_name: '', last_name: '' }
    }

    if (parts.length === 2) {
        return {
            first_name: parts[0] ?? '',
            middle_name: '',
            last_name: parts[1] ?? '',
        }
    }

    return {
        first_name: parts[0] ?? '',
        middle_name: parts.slice(1, -1).join(' '),
        last_name: parts[parts.length - 1] ?? '',
    }
}

function toText(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

function buildFullName(input: Record<string, unknown>) {
    const explicitFullName = toText(input.full_name)
    if (explicitFullName) return explicitFullName

    const parts = [input.first_name, input.middle_name, input.last_name]
        .map(toText)
        .filter(Boolean)

    return parts.join(' ').trim()
}

function normalizeStudentWritePayload(payload: Record<string, unknown>): Database['public']['Tables']['students']['Update'] {
    const fullName = buildFullName(payload)

    const mapped: Database['public']['Tables']['students']['Update'] = {
        full_name: fullName || undefined,
        gender: (payload.gender as Database['public']['Enums']['gender']) ?? undefined,
        date_of_birth: (payload.date_of_birth as string | null) ?? undefined,
        admission_date: (payload.admission_date as string | null) ?? (payload.date_of_joining as string | null) ?? undefined,
        admission_number: (payload.admission_number as string | null) ?? undefined,
        roll_number: (payload.roll_number as string | null) ?? undefined,
        class_id: (payload.class_id as string | null) ?? undefined,
        section_id: (payload.section_id as string | null) ?? undefined,
        address: (payload.address as string | null) ?? undefined,
        blood_group: (payload.blood_group as string | null) ?? undefined,
        allergies: (payload.allergies as string | null) ?? undefined,
        medical_conditions: (payload.medical_conditions as string | null) ?? undefined,
        medications: (payload.medications as string | null) ?? undefined,
        emergency_contact_name: (payload.emergency_contact_name as string | null) ?? undefined,
        emergency_contact_phone: (payload.emergency_contact_phone as string | null) ?? undefined,
        doctor_name: (payload.doctor_name as string | null) ?? undefined,
        doctor_phone: (payload.doctor_phone as string | null) ?? undefined,
        photo_url: (payload.photo_url as string | null) ?? undefined,
        is_active: (payload.is_active as boolean | undefined) ?? undefined,
    }

    return Object.fromEntries(
        Object.entries(mapped).filter(([, value]) => value !== undefined)
    ) as Database['public']['Tables']['students']['Update']
}

function hasParentFields(payload: Record<string, unknown>) {
    return (
        Object.prototype.hasOwnProperty.call(payload, 'parent_name')
        || Object.prototype.hasOwnProperty.call(payload, 'parent_email')
        || Object.prototype.hasOwnProperty.call(payload, 'parent_contact')
    )
}

async function getStudentIdentity(
    supabase: Awaited<ReturnType<typeof getSupabase>>,
    studentId: string,
): Promise<StudentIdentityRow> {
    const { data, error } = await supabase
        .from('students')
        .select('id, school_id, full_name, admission_number')
        .eq('id', studentId)
        .single()

    if (error || !data) {
        throw new Error(error?.message ?? 'Student not found.')
    }

    return data as StudentIdentityRow
}

async function getPrimaryParentsByStudentIds(schoolId: string, studentIds: string[]) {
    if (studentIds.length === 0) {
        return new Map<string, ParentSummaryRow>()
    }

    const admin = await createAdminClient()
    const db = admin

    const { data: parents, error } = await db
        .from('parents')
        .select('student_id, full_name, phone, email')
        .eq('school_id', schoolId)
        .in('student_id', studentIds)
        .eq('is_primary', true)

    if (error) {
        throw new Error(`Failed to load parent records: ${error.message}`)
    }

    const map = new Map<string, ParentSummaryRow>()
    for (const parent of (parents ?? []) as ParentSummaryRow[]) {
        if (!map.has(parent.student_id)) {
            map.set(parent.student_id, parent)
        }
    }

    return map
}

async function getPrimaryParentForStudent(schoolId: string, studentId: string): Promise<ParentSummaryRow | null> {
    const admin = await createAdminClient()
    const db = admin

    const { data: primaryParent, error } = await db
        .from('parents')
        .select('student_id, full_name, phone, email')
        .eq('school_id', schoolId)
        .eq('student_id', studentId)
        .eq('is_primary', true)
        .maybeSingle()

    if (error) {
        throw new Error(`Failed to load parent details: ${error.message}`)
    }

    if (primaryParent) {
        return primaryParent as ParentSummaryRow
    }

    const { data: fallbackParent, error: fallbackError } = await db
        .from('parents')
        .select('student_id, full_name, phone, email')
        .eq('school_id', schoolId)
        .eq('student_id', studentId)
        .limit(1)
        .maybeSingle()

    if (fallbackError) {
        throw new Error(`Failed to load parent details: ${fallbackError.message}`)
    }

    return (fallbackParent as ParentSummaryRow | null) ?? null
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

    const rows = (data ?? []) as Record<string, unknown>[]
    const studentIds = rows
        .map((row) => toText(row.id))
        .filter(Boolean)

    const parentByStudentId = await getPrimaryParentsByStudentIds(schoolId, studentIds)

    return rows.map((row) => {
        const derived = splitFullName(toText(row.full_name))
        const parent = parentByStudentId.get(toText(row.id))

        return {
            ...row,
            first_name: toText(row.first_name) || derived.first_name,
            middle_name: toText(row.middle_name) || derived.middle_name,
            last_name: toText(row.last_name) || derived.last_name,
            date_of_joining: toText(row.date_of_joining) || toText(row.admission_date),
            parent_name: parent?.full_name ?? null,
            parent_contact: parent?.phone ?? null,
            parent_email: parent?.email ?? null,
        }
    })
}

export async function deleteStudent(studentId: string) {
    const supabase = await getSupabase()
    const actorProfile = await getActorProfile(supabase)
    assertSchoolAdmin(actorProfile)
    await requirePermission(supabase, 'students.delete')

    const student = await getStudentIdentity(supabase, studentId)

    const { error } = await supabase
        .from('students')
        .update({ is_active: false, deleted_at: new Date().toISOString() })
        .eq('id', studentId)

    if (error) throw new Error(error.message)

    const admin = await createAdminClient()
    await unlinkParentsForStudent(admin, student.school_id, studentId)
}

export async function getStudentById(id: string) {
    const supabase = await getSupabase()
    const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', id)
        .single()
    if (error) throw new Error(error.message)

    const row = (data ?? {}) as Record<string, unknown>
    const derived = splitFullName(toText(row.full_name))
    const parent = await getPrimaryParentForStudent(toText(row.school_id), id)

    return {
        ...row,
        first_name: toText(row.first_name) || derived.first_name,
        middle_name: toText(row.middle_name) || derived.middle_name,
        last_name: toText(row.last_name) || derived.last_name,
        date_of_joining: toText(row.date_of_joining) || toText(row.admission_date),
        parent_name: parent?.full_name ?? null,
        parent_contact: parent?.phone ?? null,
        parent_email: parent?.email ?? null,
    } as any
}

export async function updateStudent(id: string, payload: any) {
    const supabase = await getSupabase()
    const actorProfile = await getActorProfile(supabase)
    assertSchoolAdmin(actorProfile)
    await requirePermission(supabase, 'students.edit')

    const rawPayload = (payload ?? {}) as Record<string, unknown>
    const normalizedPayload = normalizeStudentWritePayload(rawPayload)
    const parentFieldsProvided = hasParentFields(rawPayload)

    if (Object.keys(normalizedPayload).length === 0 && !parentFieldsProvided) {
        throw new Error('No valid student or parent fields provided for update')
    }

    let studentIdentity: StudentIdentityRow

    if (Object.keys(normalizedPayload).length > 0) {
        const { data, error } = await supabase
            .from('students')
            .update(normalizedPayload)
            .eq('id', id)
            .select('id, school_id, full_name, admission_number')
            .single()
        if (error || !data) throw new Error(error?.message ?? 'Unable to update student')
        studentIdentity = data as StudentIdentityRow
    } else {
        studentIdentity = await getStudentIdentity(supabase, id)
    }

    if (parentFieldsProvided) {
        const admin = await createAdminClient()

        await syncPrimaryParentForStudent(admin, {
            schoolId: studentIdentity.school_id,
            studentId: studentIdentity.id,
            studentFullName: studentIdentity.full_name,
            parentName: rawPayload.parent_name,
            parentEmail: rawPayload.parent_email,
            parentContact: rawPayload.parent_contact,
            clearWhenEmpty: true,
        })
    }

    return true
}

type BulkStudentRow = Record<string, unknown> & {
    parent_name?: string | null
    parent_email?: string | null
    parent_contact?: string | null
}

export async function bulkCreateStudents(schoolId: string, studentsData: BulkStudentRow[]) {
    const supabase = await getSupabase()
    const actorProfile = await getActorProfile(supabase)
    assertSchoolAdmin(actorProfile)

    if (actorProfile.school_id !== schoolId) {
        throw new Error('You are not permitted to add students in another school.')
    }

    const normalizedRows = studentsData.map((student) => {
        const normalized = normalizeStudentWritePayload((student ?? {}) as Record<string, unknown>)
        const normalizedParent = normalizeParentContact({
            parent_name: student?.parent_name,
            parent_email: student?.parent_email,
            parent_contact: student?.parent_contact,
        })

        if (!normalized.full_name || !normalized.admission_number) {
            throw new Error('Each student must include a name and admission number')
        }

        return {
            studentPayload: {
                school_id: schoolId,
                full_name: normalized.full_name,
                admission_number: normalized.admission_number,
                admission_date: normalized.admission_date,
                date_of_birth: normalized.date_of_birth ?? null,
                gender: normalized.gender ?? null,
                roll_number: normalized.roll_number ?? null,
                class_id: normalized.class_id ?? null,
                section_id: normalized.section_id ?? null,
                address: normalized.address ?? null,
                blood_group: normalized.blood_group ?? null,
                photo_url: normalized.photo_url ?? null,
                is_active: true,
            },
            parentPayload: normalizedParent,
        }
    })

    const payloads = normalizedRows.map((row) => row.studentPayload)

    const { data: createdStudents, error } = await supabase
        .from('students')
        .insert(payloads)
        .select('id, school_id, full_name, admission_number')

    if (error) throw new Error(error.message)

    if ((createdStudents ?? []).length > 0) {
        const parentByAdmission = new Map(
            normalizedRows.map((row) => [row.studentPayload.admission_number, row.parentPayload]),
        )

        const admin = await createAdminClient()

        for (const createdStudent of (createdStudents ?? []) as StudentIdentityRow[]) {
            const parentPayload = parentByAdmission.get(createdStudent.admission_number)
            if (!parentPayload?.hasDetails) continue

            await syncPrimaryParentForStudent(admin, {
                schoolId: createdStudent.school_id,
                studentId: createdStudent.id,
                studentFullName: createdStudent.full_name,
                parentName: parentPayload.parentName,
                parentEmail: parentPayload.parentEmail,
                parentContact: parentPayload.parentPhone,
            })
        }
    }

    return true
}
