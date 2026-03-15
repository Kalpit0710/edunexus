import {
  normalizeParentContact,
  selectBestSiblingParent,
  type ParentLinkCandidate,
} from '@/lib/student-parent-link'

interface ExistingPrimaryParentRow {
  id: string
  auth_user_id: string | null
}

interface QueryError {
  message: string
}

export interface StudentParentSyncInput {
  schoolId: string
  studentId: string
  studentFullName: string
  parentName?: unknown
  parentEmail?: unknown
  parentContact?: unknown
  clearWhenEmpty?: boolean
}

export async function unlinkParentsForStudent(db: any, schoolId: string, studentId: string): Promise<void> {
  const { error } = await db
    .from('parents')
    .delete()
    .eq('school_id', schoolId)
    .eq('student_id', studentId)

  if (error) {
    throw new Error(`Unable to remove parent links for student: ${error.message}`)
  }
}

export async function syncPrimaryParentForStudent(
  db: any,
  input: StudentParentSyncInput,
): Promise<void> {
  const parent = normalizeParentContact({
    parent_name: input.parentName,
    parent_email: input.parentEmail,
    parent_contact: input.parentContact,
  })

  const { data: existingPrimary, error: existingPrimaryError } = await db
    .from('parents')
    .select('id, auth_user_id')
    .eq('school_id', input.schoolId)
    .eq('student_id', input.studentId)
    .eq('is_primary', true)
    .maybeSingle() as {
      data: ExistingPrimaryParentRow | null
      error: QueryError | null
    }

  if (existingPrimaryError) {
    throw new Error(`Unable to read existing parent details: ${existingPrimaryError.message}`)
  }

  if (!parent.hasDetails) {
    if (input.clearWhenEmpty) {
      await unlinkParentsForStudent(db, input.schoolId, input.studentId)
    }
    return
  }

  let inheritedAuthUserId = existingPrimary?.auth_user_id ?? null

  if (!inheritedAuthUserId && parent.parentEmail) {
    const { data: siblingCandidates, error: siblingError } = await db
      .from('parents')
      .select('auth_user_id, email, phone, is_primary')
      .eq('school_id', input.schoolId)
      .neq('student_id', input.studentId)
      .ilike('email', parent.parentEmail) as {
        data: ParentLinkCandidate[] | null
        error: QueryError | null
      }

    if (siblingError) {
      throw new Error(`Unable to read existing parent links: ${siblingError.message}`)
    }

    const bestSiblingParent = selectBestSiblingParent(
      siblingCandidates ?? [],
      parent.parentEmail,
      parent.parentPhone,
    )

    inheritedAuthUserId = bestSiblingParent?.auth_user_id ?? null
  }

  const parentPayload = {
    full_name: parent.parentName || `Parent of ${input.studentFullName}`,
    relation: 'parent',
    phone: parent.parentPhone || null,
    email: parent.parentEmail || null,
    auth_user_id: inheritedAuthUserId,
    is_primary: true,
  }

  if (existingPrimary?.id) {
    const { error: updateError } = await db
      .from('parents')
      .update(parentPayload)
      .eq('id', existingPrimary.id)

    if (updateError) {
      throw new Error(`Unable to update parent details: ${updateError.message}`)
    }
    return
  }

  const { error: insertError } = await db
    .from('parents')
    .insert([
      {
        school_id: input.schoolId,
        student_id: input.studentId,
        ...parentPayload,
      },
    ])

  if (insertError) {
    throw new Error(`Unable to create parent details: ${insertError.message}`)
  }
}