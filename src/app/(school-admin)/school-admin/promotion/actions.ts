'use server'

import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { requireActor } from '@/lib/auth/require-actor'
import { logAudit } from '@/lib/audit'
import { validatePromotionMapping, type PromotionClass, type PromotionMapping } from '@/lib/promotion-utils'

export interface PromotionClassRow extends PromotionClass {
  activeStudents: number
}

export interface PromotionAcademicYear {
  id: string
  name: string
  is_current: boolean
}

export interface PromotionData {
  classes: PromotionClassRow[]
  academicYears: PromotionAcademicYear[]
}

/** Load classes (with active-student counts) + academic years for the promotion screen. */
export async function getPromotionData(schoolId: string): Promise<PromotionData> {
  const supabase = await createServerSupabaseClient()
  const actor = await requireActor(supabase, ['school_admin'])
  if (!actor.school_id || actor.school_id !== schoolId) {
    throw new Error('Not permitted for this school.')
  }

  const [classesRes, studentsRes, yearsRes] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, display_order')
      .eq('school_id', schoolId)
      .order('display_order', { ascending: true }),
    supabase
      .from('students')
      .select('class_id')
      .eq('school_id', schoolId)
      .eq('is_active', true),
    supabase
      .from('academic_years')
      .select('id, name, is_current')
      .eq('school_id', schoolId)
      .order('start_date', { ascending: false }),
  ])

  if (classesRes.error) throw new Error(classesRes.error.message)
  if (studentsRes.error) throw new Error(studentsRes.error.message)
  if (yearsRes.error) throw new Error(yearsRes.error.message)

  const counts = new Map<string, number>()
  for (const row of studentsRes.data ?? []) {
    const cid = (row as { class_id: string | null }).class_id
    if (cid) counts.set(cid, (counts.get(cid) ?? 0) + 1)
  }

  const classes: PromotionClassRow[] = (classesRes.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    display_order: c.display_order,
    activeStudents: counts.get(c.id) ?? 0,
  }))

  return {
    classes,
    academicYears: (yearsRes.data ?? []) as PromotionAcademicYear[],
  }
}

export interface PromoteStudentsInput {
  schoolId: string
  /** New current academic year, or null to leave the year unchanged. */
  targetYearId: string | null
  mappings: PromotionMapping[]
  /** Typed confirmation — must equal "PROMOTE". */
  confirm: string
}

export interface PromoteStudentsResult {
  promoted: number
  graduated: number
  arrearsCarried: number
}

/**
 * Atomically promote students (RPC), graduate the final class, and optionally
 * roll the academic year forward. Tenant-guarded server-side and in the RPC.
 */
export async function promoteStudents(input: PromoteStudentsInput): Promise<PromoteStudentsResult> {
  const supabase = await createServerSupabaseClient()
  const actor = await requireActor(supabase, ['school_admin'])
  if (!actor.school_id || actor.school_id !== input.schoolId) {
    throw new Error('Not permitted for this school.')
  }

  if (input.confirm !== 'PROMOTE') {
    throw new Error('Please type PROMOTE to confirm.')
  }

  // Validate the mapping against the live class list.
  const { data: classRows, error: classErr } = await supabase
    .from('classes')
    .select('id, name, display_order')
    .eq('school_id', input.schoolId)
  if (classErr) throw new Error(classErr.message)

  const validationError = validatePromotionMapping(
    input.mappings,
    (classRows ?? []) as PromotionClass[],
  )
  if (validationError) throw new Error(validationError)

  const rpcMappings = input.mappings.map((m) => ({ from: m.fromClassId, to: m.toClassId }))

  const { data, error } = await supabase.rpc('promote_students', {
    p_school_id: input.schoolId,
    // The RPC accepts NULL ("leave the year unchanged"); generated arg types
    // mark it required, so assert through. Runtime null is handled in SQL.
    p_target_year: input.targetYearId as string,
    p_mappings: rpcMappings,
  })
  if (error) throw new Error(error.message)

  const rpcResult = (data ?? { promoted: 0, graduated: 0, arrears_carried: 0 }) as {
    promoted?: number
    graduated?: number
    arrears_carried?: number
  }

  const result: PromoteStudentsResult = {
    promoted: Number(rpcResult.promoted ?? 0),
    graduated: Number(rpcResult.graduated ?? 0),
    arrearsCarried: Number(rpcResult.arrears_carried ?? 0),
  }

  await logAudit({
    schoolId: input.schoolId,
    actorId: actor.id,
    actorRole: actor.role,
    action: 'students.promoted',
    entityType: 'school',
    entityId: input.schoolId,
    entityLabel: `Promoted ${result.promoted}, graduated ${result.graduated}, arrears ${result.arrearsCarried}`,
  })

  return result
}
