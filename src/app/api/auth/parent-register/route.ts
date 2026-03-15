import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database } from '@/types/database.types'
import { ROLES } from '@/lib/constants'

export const dynamic = 'force-dynamic'

const schoolCodeSchema = z.string().trim().min(2).max(20)
const admissionNumberSchema = z.string().trim().min(2).max(40)

const lookupSchema = z.object({
  action: z.literal('lookup'),
  schoolCode: schoolCodeSchema,
  admissionNumber: admissionNumberSchema,
})

const registerSchema = z
  .object({
    action: z.literal('register'),
    schoolCode: schoolCodeSchema,
    admissionNumber: admissionNumberSchema,
    parentEmail: z.string().trim().email(),
    parentPhone: z.string().trim().min(6).max(30),
    password: z
      .string()
      .min(8)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
        'Password must include uppercase, lowercase, and a number'
      ),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

const payloadSchema = z.union([lookupSchema, registerSchema])

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '')
}

function getPhoneMatchTokens(value: string) {
  const digits = normalizePhone(value)
  const tokens = new Set<string>()

  if (!digits) return tokens

  tokens.add(digits)

  // Accept international prefix style like 0091xxxxxxxxxx.
  if (digits.startsWith('00') && digits.length > 2) {
    tokens.add(digits.slice(2))
  }

  // Accept local trunk prefix style like 0xxxxxxxxxx.
  if (digits.startsWith('0') && digits.length > 1) {
    tokens.add(digits.slice(1))
  }

  // India-friendly matching: allow optional +91 / 91 for 10-digit local numbers.
  if (digits.length === 10) {
    tokens.add(`91${digits}`)
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    tokens.add(digits.slice(2))
  }

  return tokens
}

function phonesMatch(a: string, b: string) {
  const aTokens = getPhoneMatchTokens(a)
  const bTokens = getPhoneMatchTokens(b)

  if (aTokens.size === 0 || bTokens.size === 0) return false

  for (const token of aTokens) {
    if (bTokens.has(token)) return true
  }

  return false
}

function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

interface LookupStudentRow {
  id: string
  full_name: string
  admission_number: string
  class_id: string | null
  section_id: string | null
  is_active: boolean
  deleted_at: string | null
  classes: { name: string } | null
  sections: { name: string } | null
}

async function getSchoolByCode(admin: ReturnType<typeof createAdminClient>, schoolCode: string) {
  const { data, error } = await admin
    .from('schools')
    .select('id, name, code, is_active')
    .ilike('code', schoolCode.trim())
    .maybeSingle()

  if (error || !data || !data.is_active) return null
  return data
}

async function getStudentByAdmission(
  admin: ReturnType<typeof createAdminClient>,
  schoolId: string,
  admissionNumber: string
) {
  const { data, error } = await admin
    .from('students')
    .select('id, full_name, admission_number, class_id, section_id, is_active, deleted_at, classes(name), sections(name)')
    .eq('school_id', schoolId)
    .eq('admission_number', admissionNumber.trim())
    .maybeSingle()

  if (error || !data || !data.is_active || data.deleted_at) return null
  return data as LookupStudentRow
}

function studentPreviewResponse(
  school: { name: string; code: string },
  student: LookupStudentRow
) {
  return {
    schoolName: school.name,
    schoolCode: school.code,
    studentId: student.id,
    studentName: student.full_name,
    admissionNumber: student.admission_number,
    className: student.classes?.name ?? 'N/A',
    sectionName: student.sections?.name ?? 'N/A',
  }
}

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON payload' }, { status: 400 })
  }

  const parsed = payloadSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json(
      {
        success: false,
        message: issue?.message ?? 'Invalid input',
      },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  if (parsed.data.action === 'lookup') {
    const school = await getSchoolByCode(admin, parsed.data.schoolCode)
    if (!school) {
      return NextResponse.json(
        { success: false, message: 'School code not found or inactive' },
        { status: 404 }
      )
    }

    const student = await getStudentByAdmission(admin, school.id, parsed.data.admissionNumber)
    if (!student) {
      return NextResponse.json(
        { success: false, message: 'Student registration number not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      student: studentPreviewResponse(school, student),
    })
  }

  const school = await getSchoolByCode(admin, parsed.data.schoolCode)
  if (!school) {
    return NextResponse.json(
      { success: false, message: 'School code not found or inactive' },
      { status: 404 }
    )
  }

  const student = await getStudentByAdmission(admin, school.id, parsed.data.admissionNumber)
  if (!student) {
    return NextResponse.json(
      { success: false, message: 'Student registration number not found' },
      { status: 404 }
    )
  }

  const normalizedEmail = normalizeEmail(parsed.data.parentEmail)
  const normalizedPhone = normalizePhone(parsed.data.parentPhone)

  if (!normalizedPhone) {
    return NextResponse.json(
      { success: false, message: 'Please enter a valid parent phone number (for example: +91 98765 43210 or 9876543210)' },
      { status: 400 }
    )
  }

  const { data: parentCandidates, error: parentCandidatesError } = await admin
    .from('parents')
    .select('id, student_id, full_name, email, phone, auth_user_id, is_primary')
    .eq('school_id', school.id)
    .ilike('email', normalizedEmail)

  if (parentCandidatesError) {
    return NextResponse.json(
      { success: false, message: 'Unable to verify parent details right now' },
      { status: 500 }
    )
  }

  const matchingParents = (parentCandidates ?? []).filter((row) =>
    phonesMatch(row.phone ?? '', normalizedPhone)
  )

  const matchesRequestedStudent = matchingParents.some((row) => row.student_id === student.id)
  if (!matchesRequestedStudent) {
    return NextResponse.json(
      {
        success: false,
        message:
          'Parent email and phone do not match school records for this student',
      },
      { status: 400 }
    )
  }

  if (matchingParents.some((row) => !!row.auth_user_id)) {
    return NextResponse.json(
      {
        success: false,
        message: 'An account already exists for this parent. Please use login.',
      },
      { status: 409 }
    )
  }

  const primaryParent =
    matchingParents.find((row) => row.student_id === student.id && row.is_primary) ??
    matchingParents.find((row) => row.student_id === student.id) ??
    matchingParents[0]

  const { data: createdAuth, error: authCreateError } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: primaryParent?.full_name ?? 'Parent' },
    app_metadata: { role: ROLES.PARENT, school_id: school.id },
  })

  if (authCreateError || !createdAuth?.user?.id) {
    const msg = authCreateError?.message ?? 'Unable to create account'
    const isConflict = /already|registered|exists/i.test(msg)
    return NextResponse.json(
      {
        success: false,
        message: isConflict
          ? 'An account already exists for this email. Please use login.'
          : 'Unable to create account right now. Please try again.',
      },
      { status: isConflict ? 409 : 500 }
    )
  }

  const authUserId = createdAuth.user.id

  const { error: profileError } = await admin
    .from('user_profiles')
    .upsert(
      {
        auth_user_id: authUserId,
        school_id: school.id,
        full_name: primaryParent?.full_name ?? 'Parent',
        email: normalizedEmail,
        phone: parsed.data.parentPhone.trim(),
        role: ROLES.PARENT,
        is_active: true,
      },
      { onConflict: 'auth_user_id' }
    )

  if (profileError) {
    return NextResponse.json(
      { success: false, message: 'Account created but profile linking failed. Contact support.' },
      { status: 500 }
    )
  }

  const parentIdsToLink = matchingParents.map((row) => row.id)
  const { error: linkParentsError } = await admin
    .from('parents')
    .update({
      auth_user_id: authUserId,
      email: normalizedEmail,
      phone: parsed.data.parentPhone.trim(),
    })
    .in('id', parentIdsToLink)

  if (linkParentsError) {
    return NextResponse.json(
      { success: false, message: 'Account created but student linking failed. Contact support.' },
      { status: 500 }
    )
  }

  const linkedStudentIds = Array.from(new Set(matchingParents.map((row) => row.student_id)))

  const { data: linkedStudentsData } = await admin
    .from('students')
    .select('id, full_name, admission_number')
    .eq('school_id', school.id)
    .in('id', linkedStudentIds)

  return NextResponse.json({
    success: true,
    message: 'Parent account created successfully',
    account: {
      email: normalizedEmail,
      schoolCode: school.code,
      linkedStudents: (linkedStudentsData ?? []).map((row) => ({
        id: row.id,
        fullName: row.full_name,
        admissionNumber: row.admission_number,
      })),
    },
  })
}
