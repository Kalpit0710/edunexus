'use server'

import type { Database } from '@/types/database.types'
import { createClient as createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { requireActor } from '@/lib/auth/require-actor'
import { logAudit } from '@/lib/audit'

// Local alias for the shared cookie-aware server client (see lib/supabase/server).
const getSupabase = createServerSupabaseClient

// ─── Soft-delete helpers ───────────────────────────────────────────────────

type ConfigEntity = 'classes' | 'sections' | 'subjects' | 'academic_years' | 'grading_rules'
type ConfigEntityRow = {
    id: string
    school_id: string
    deleted_at?: string | null
    name?: string | null
    grade_name?: string | null
}

function labelColumnFor(entity: ConfigEntity): 'name' | 'grade_name' {
    return entity === 'grading_rules' ? 'grade_name' : 'name'
}

/**
 * Soft-delete a school-configuration row. Runs via the service-role client
 * (so it can write the `deleted_at` flag) but is explicitly scoped to the
 * caller's own school to preserve tenant isolation. Records an audit entry.
 */
async function softDeleteConfig(entity: ConfigEntity, id: string, action: string): Promise<void> {
    const supabase = await createServerSupabaseClient()
    const actor = await requireActor(supabase, ['school_admin'])
    if (!actor.school_id) throw new Error('Your account is not linked to any school.')

    const admin = await createAdminClient()
    const labelCol = labelColumnFor(entity)

    const { data: row, error: readErr } = await admin
        .from(entity)
        .select(`id, school_id, ${labelCol}`)
        .eq('id', id)
        .maybeSingle()
    if (readErr) throw new Error(readErr.message)
    const typedRow = row as ConfigEntityRow | null
    if (!typedRow || typedRow.school_id !== actor.school_id) {
        throw new Error('Item not found or not permitted.')
    }

    const { error } = await admin
        .from(entity)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('school_id', actor.school_id)
        .is('deleted_at', null)
    if (error) throw new Error(error.message)

    await logAudit({
        schoolId: actor.school_id,
        actorId: actor.id,
        actorRole: actor.role,
        action,
        entityType: entity,
        entityId: id,
        entityLabel: (typedRow[labelCol] as string | null) ?? null,
    })
}

/**
 * Restore a previously soft-deleted configuration row (clears `deleted_at`).
 * RLS hides soft-deleted rows from the session client, so this uses the
 * service-role client, still scoped to the caller's school.
 */
async function restoreConfig(entity: ConfigEntity, id: string, action: string): Promise<void> {
    const supabase = await createServerSupabaseClient()
    const actor = await requireActor(supabase, ['school_admin'])
    if (!actor.school_id) throw new Error('Your account is not linked to any school.')

    const admin = await createAdminClient()
    const labelCol = labelColumnFor(entity)

    const { data: row, error: readErr } = await admin
        .from(entity)
        .select(`id, school_id, ${labelCol}`)
        .eq('id', id)
        .maybeSingle()
    if (readErr) throw new Error(readErr.message)
    const typedRow = row as ConfigEntityRow | null
    if (!typedRow || typedRow.school_id !== actor.school_id) {
        throw new Error('Item not found or not permitted.')
    }

    const { error } = await admin
        .from(entity)
        .update({ deleted_at: null })
        .eq('id', id)
        .eq('school_id', actor.school_id)
        .not('deleted_at', 'is', null)
    if (error) throw new Error(error.message)

    await logAudit({
        schoolId: actor.school_id,
        actorId: actor.id,
        actorRole: actor.role,
        action,
        entityType: entity,
        entityId: id,
        entityLabel: (typedRow[labelCol] as string | null) ?? null,
    })
}

/** List soft-deleted configuration rows for the caller's school (for a restore UI). */
export async function getDeletedConfigEntities(
    entity: ConfigEntity,
): Promise<{ id: string; label: string | null; deletedAt: string }[]> {
    const supabase = await createServerSupabaseClient()
    const actor = await requireActor(supabase, ['school_admin'])
    if (!actor.school_id) throw new Error('Your account is not linked to any school.')

    const admin = await createAdminClient()
    const labelCol = labelColumnFor(entity)

    const { data, error } = await admin
        .from(entity)
        .select(`id, deleted_at, ${labelCol}`)
        .eq('school_id', actor.school_id)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
    if (error) throw new Error(error.message)

    return ((data ?? []) as unknown as ConfigEntityRow[]).map(r => ({
        id: r.id,
        label: (r[labelCol] as string | null) ?? null,
        deletedAt: String(r.deleted_at),
    }))
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
        .order('display_order', { ascending: true })
        .order('name', { ascending: true })

    if (error) throw new Error(error.message)
    return data
}

export async function createClass(schoolId: string, name: string, displayOrder: number) {
    const supabase = await getSupabase()
    const { error } = await supabase
        .from('classes')
        .insert([{ school_id: schoolId, name, display_order: displayOrder }])
    if (error) throw new Error(error.message)
}

export async function deleteClass(classId: string) {
    await softDeleteConfig('classes', classId, 'class.deleted')
}

export async function restoreClass(classId: string) {
    await restoreConfig('classes', classId, 'class.restored')
}

export async function createSection(schoolId: string, classId: string, name: string, capacity: number) {
    const supabase = await getSupabase()
    const { error } = await supabase
        .from('sections')
        .insert([{ school_id: schoolId, class_id: classId, name, capacity }])
    if (error) throw new Error(error.message)
}

export async function deleteSection(sectionId: string) {
    await softDeleteConfig('sections', sectionId, 'section.deleted')
}

export async function restoreSection(sectionId: string) {
    await restoreConfig('sections', sectionId, 'section.restored')
}

export async function createSubject(schoolId: string, classId: string, name: string, code: string) {
    const supabase = await getSupabase()
    // Append to the end of the class's subject order.
    const { data: last } = await supabase
        .from('subjects')
        .select('display_order')
        .eq('school_id', schoolId)
        .eq('class_id', classId)
        .is('deleted_at', null)
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle()
    const nextOrder = ((last as { display_order: number } | null)?.display_order ?? -1) + 1
    const { error } = await supabase
        .from('subjects')
        .insert([{ school_id: schoolId, class_id: classId, name, code, display_order: nextOrder }])
    if (error) throw new Error(error.message)
}

export async function updateSubjectOrder(subjectId: string, displayOrder: number) {
    const supabase = await getSupabase()
    const { error } = await supabase
        .from('subjects')
        .update({ display_order: displayOrder })
        .eq('id', subjectId)
    if (error) throw new Error(error.message)
}

export async function deleteSubject(subjectId: string) {
    await softDeleteConfig('subjects', subjectId, 'subject.deleted')
}

export async function restoreSubject(subjectId: string) {
    await restoreConfig('subjects', subjectId, 'subject.restored')
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
        await supabase
            .from('academic_years')
            .update({ is_current: false })
            .eq('school_id', schoolId)
            .eq('is_current', true)
    }

    const { error } = await supabase
        .from('academic_years')
        .insert([{ school_id: schoolId, name, start_date: startDate, end_date: endDate, is_current: isCurrent }])
    if (error) throw new Error(error.message)
}

export async function deleteAcademicYear(id: string) {
    await softDeleteConfig('academic_years', id, 'academic_year.deleted')
}

export async function restoreAcademicYear(id: string) {
    await restoreConfig('academic_years', id, 'academic_year.restored')
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
        .insert([{ school_id: schoolId, min_marks: minMarks, max_marks: maxMarks, grade_name: gradeName, grade_point: gradePoint }])
    if (error) throw new Error(error.message)
}

export async function deleteGradingRule(id: string) {
    await softDeleteConfig('grading_rules', id, 'grading_rule.deleted')
}

export async function restoreGradingRule(id: string) {
    await restoreConfig('grading_rules', id, 'grading_rule.restored')
}
