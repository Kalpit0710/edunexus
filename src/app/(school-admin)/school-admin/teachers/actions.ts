'use server'

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { createClient as getSupabase } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { schoolToday } from '@/lib/date-utils'
import { WelcomeEmail } from '@/emails/WelcomeEmail'
import { requireActor } from '@/lib/auth/require-actor'
import { logAudit } from '@/lib/audit'
import { validateTeacherCreateFields } from '@/lib/teacher-utils'

// ── Supabase helpers ─────────────────────────────────────────────────────────

/** Service-role client for admin auth operations (user creation / deletion) */
function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface TeacherRow {
  id: string
  school_id: string
  employee_id: string | null
  qualification: string | null
  specialization: string | null
  signature_url: string | null
  join_date: string
  is_active: boolean
  created_at: string
  updated_at: string
  user_profile: {
    id: string
    full_name: string
    email: string
    phone: string | null
    avatar_url: string | null
    is_active: boolean
  } | null
}

export interface CreateTeacherPayload {
  full_name: string
  email: string
  phone?: string
  password: string
  employee_id?: string
  qualification?: string
  specialization?: string
  join_date?: string
}

export interface UpdateTeacherPayload {
  full_name?: string
  phone?: string
  employee_id?: string
  qualification?: string
  specialization?: string
  signature_url?: string
  join_date?: string
}

// ── Read operations ───────────────────────────────────────────────────────────

export async function getTeachers(schoolId: string): Promise<TeacherRow[]> {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('teachers')
    .select(`
      *,
      user_profile:user_profiles (
        id, full_name, email, phone, avatar_url, is_active
      )
    `)
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as TeacherRow[]
}

export async function getTeacherById(teacherId: string) {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('teachers')
    .select(`
      *,
      user_profile:user_profiles (
        id, full_name, email, phone, avatar_url, is_active
      )
    `)
    .eq('id', teacherId)
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as TeacherRow
}

export async function getTeacherAssignments(teacherId: string) {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('teacher_section_assignments')
    .select(`
      id,
      is_class_teacher,
      section:sections ( id, name, class:classes ( id, name ) ),
      subject:subjects ( id, name )
    `)
    .eq('teacher_id', teacherId)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getClassesAndSections(schoolId: string) {
  const supabase = await getSupabase()
  const [classesRes, sectionsRes, subjectsRes] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, display_order')
      .eq('school_id', schoolId)
      .order('display_order'),
    supabase
      .from('sections')
      .select('id, name, class_id')
      .eq('school_id', schoolId),
    supabase
      .from('subjects')
      .select('id, name, class_id')
      .eq('school_id', schoolId),
  ])
  if (classesRes.error) throw new Error(classesRes.error.message)
  if (sectionsRes.error) throw new Error(sectionsRes.error.message)
  if (subjectsRes.error) throw new Error(subjectsRes.error.message)
  return {
    classes: classesRes.data ?? [],
    sections: sectionsRes.data ?? [],
    subjects: subjectsRes.data ?? [],
  }
}

// ── Write operations ──────────────────────────────────────────────────────────

/**
 * Creates an auth user, a user_profile, and a teachers record in one atomic
 * sequence.  Uses the service-role client to invite/create the auth user.
 */
export async function createTeacher(
  schoolId: string,
  payload: CreateTeacherPayload
): Promise<string> {
  const session = await getSupabase()
  const actor = await requireActor(session, ['school_admin'])
  const admin = getAdminClient()

  // Validate input at the trust boundary (runtime) before creating any account.
  const validationErrors = validateTeacherCreateFields({
    full_name: payload.full_name,
    email: payload.email,
    password: payload.password,
    join_date: payload.join_date ?? '',
  })
  const trimmedPhone = payload.phone?.trim() ?? ''
  if (trimmedPhone && (trimmedPhone.length < 6 || trimmedPhone.length > 30)) {
    validationErrors.push('a valid phone number is required')
  }
  if (validationErrors.length > 0) {
    throw new Error(validationErrors.join('; '))
  }

  // 1. Create Supabase Auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: payload.email,
    password: payload.password,
    email_confirm: true,
    user_metadata: {
      role: 'teacher',
      school_id: schoolId,
      full_name: payload.full_name,
    },
  })
  if (authError) {
    const exists = authError.message.toLowerCase().includes('already')
    throw new Error(
      exists
        ? 'An account with this email already exists. Please use a different email address.'
        : 'We could not create the login account for this teacher. Please try again.'
    )
  }

  const authUserId = authData.user.id

  try {
    // 2. Create user_profile
    const { data: profileData, error: profileError } = await admin
      .from('user_profiles')
      .insert({
        school_id: schoolId,
        auth_user_id: authUserId,
        full_name: payload.full_name,
        email: payload.email,
        phone: payload.phone ?? null,
        role: 'teacher',
        is_active: true,
      })
      .select('id')
      .single()

    if (profileError) throw new Error('We could not save the teacher profile. Please try again.')

    // 3. Create teacher record
    const { data: teacherData, error: teacherError } = await admin
      .from('teachers')
      .insert({
        school_id: schoolId,
        user_profile_id: profileData.id,
        employee_id: payload.employee_id ?? null,
        qualification: payload.qualification ?? null,
        specialization: payload.specialization ?? null,
        join_date: payload.join_date ?? schoolToday(),
        is_active: true,
      })
      .select('id')
      .single()

    if (teacherError) throw new Error('We could not save the teacher details. Please try again.')

    // Audit trail: staff onboarding is a critical record creation.
    await logAudit({
      schoolId,
      actorId: actor.id,
      actorRole: actor.role,
      action: 'teacher.created',
      entityType: 'teacher',
      entityId: teacherData.id,
      entityLabel: payload.full_name,
      metadata: { email: payload.email, employeeId: payload.employee_id ?? null },
    })

    // 4. Send Welcome Email
    try {
      // Get school name
      const { data: schoolData } = await admin.from('schools').select('name').eq('id', schoolId).single()
      
      await sendEmail({
        to: payload.email,
        subject: `Welcome to ${schoolData?.name || 'EduNexus'}`,
        react: WelcomeEmail({
          name: payload.full_name,
          role: 'Teacher',
          schoolName: schoolData?.name || 'EduNexus',
          loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`,
          temporaryPassword: payload.password
        }),
        schoolId,
        recipientId: authUserId,
        event: 'welcome'
      })
    } catch (e) {
      console.error('Failed to send welcome email:', e)
      // We don't throw here to avoid failing the teacher creation if email fails
    }

    return teacherData.id
  } catch (err) {
    // Rollback: delete auth user if subsequent steps failed
    await admin.auth.admin.deleteUser(authUserId)
    throw err
  }
}

export async function updateTeacher(
  teacherId: string,
  userProfileId: string,
  payload: UpdateTeacherPayload
): Promise<void> {
  const supabase = await getSupabase()

  // Update user_profile fields
  if (payload.full_name || payload.phone !== undefined) {
    const profileUpdate: Database['public']['Tables']['user_profiles']['Update'] = {}
    if (payload.full_name) profileUpdate.full_name = payload.full_name
    if (payload.phone !== undefined) profileUpdate.phone = payload.phone

    const { error } = await supabase
      .from('user_profiles')
      .update(profileUpdate)
      .eq('id', userProfileId)
    if (error) throw new Error(error.message)
  }

  // Update teacher-specific fields
  const teacherUpdate: Database['public']['Tables']['teachers']['Update'] = {}
  if (payload.employee_id !== undefined) teacherUpdate.employee_id = payload.employee_id
  if (payload.qualification !== undefined) teacherUpdate.qualification = payload.qualification
  if (payload.specialization !== undefined) teacherUpdate.specialization = payload.specialization
  if (payload.signature_url !== undefined) teacherUpdate.signature_url = payload.signature_url || null
  if (payload.join_date) teacherUpdate.join_date = payload.join_date

  if (Object.keys(teacherUpdate).length > 0) {
    const { error } = await supabase
      .from('teachers')
      .update(teacherUpdate)
      .eq('id', teacherId)
    if (error) throw new Error(error.message)
  }
}

export async function toggleTeacherStatus(
  teacherId: string,
  userProfileId: string,
  isActive: boolean
): Promise<void> {
  const supabase = await getSupabase()
  const actor = await requireActor(supabase, ['school_admin'])
  const [teacherRes, profileRes] = await Promise.all([
    supabase.from('teachers').update({ is_active: isActive }).eq('id', teacherId),
    supabase.from('user_profiles').update({ is_active: isActive }).eq('id', userProfileId),
  ])
  if (teacherRes.error) throw new Error(teacherRes.error.message)
  if (profileRes.error) throw new Error(profileRes.error.message)

  // Audit trail: enabling/disabling staff access is security-relevant.
  await logAudit({
    schoolId: actor.school_id,
    actorId: actor.id,
    actorRole: actor.role,
    action: isActive ? 'teacher.activated' : 'teacher.deactivated',
    entityType: 'teacher',
    entityId: teacherId,
  })
}

export async function assignTeacherToSection(
  schoolId: string,
  teacherId: string,
  sectionId: string,
  subjectId: string | null,
  isClassTeacher: boolean
): Promise<void> {
  const supabase = await getSupabase()
  const { error } = await supabase.from('teacher_section_assignments').insert({
    school_id: schoolId,
    teacher_id: teacherId,
    section_id: sectionId,
    subject_id: subjectId,
    is_class_teacher: isClassTeacher,
  } as any)
  if (error) throw new Error(error.message)
}

export async function removeAssignment(assignmentId: string): Promise<void> {
  const supabase = await getSupabase()
  const { error } = await supabase
    .from('teacher_section_assignments')
    .delete()
    .eq('id', assignmentId)
  if (error) throw new Error(error.message)
}
