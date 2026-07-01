import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { ROLES } from '@/lib/constants'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'
import {
  schoolRegisterSchema,
  normalizeSchoolCode,
  normalizeEmail,
  computeTrialEndsAt,
  TRIAL_PLAN,
} from '@/lib/school-onboarding'

export const dynamic = 'force-dynamic'

function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: Request) {
  // Abuse guard: throttle by client IP (no-op when Upstash is unset).
  const rl = await checkRateLimit(getClientIp(request), {
    name: 'school-register',
    limit: 5,
    windowSeconds: 60,
  })
  if (!rl.success) {
    return NextResponse.json(
      { success: false, message: 'Too many attempts. Please try again in a minute.' },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON payload' }, { status: 400 })
  }

  const parsed = schoolRegisterSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json(
      { success: false, message: issue?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }

  const input = parsed.data
  const admin = createAdminClient()

  const code = normalizeSchoolCode(input.schoolCode)
  const adminEmail = normalizeEmail(input.adminEmail)
  const schoolEmail = input.schoolEmail ? normalizeEmail(input.schoolEmail) : null

  // 1. Enforce unique school code (case-insensitive).
  const { data: existing, error: codeError } = await admin
    .from('schools')
    .select('id')
    .ilike('code', code)
    .maybeSingle()

  if (codeError) {
    return NextResponse.json(
      { success: false, message: 'Unable to start registration right now. Please try again.' },
      { status: 500 }
    )
  }
  if (existing) {
    return NextResponse.json(
      { success: false, message: 'That school code is already taken. Please choose another.' },
      { status: 409 }
    )
  }

  // 2. Create the school in trial status.
  const trialEndsAt = computeTrialEndsAt()
  const { data: school, error: schoolError } = await admin
    .from('schools')
    .insert({
      name: input.schoolName.trim(),
      code,
      email: schoolEmail,
      phone: input.schoolPhone?.trim() || null,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      is_active: true,
      subscription_plan: TRIAL_PLAN,
      subscription_status: 'trial',
      trial_ends_at: trialEndsAt,
    })
    .select('id')
    .single()

  if (schoolError || !school) {
    return NextResponse.json(
      { success: false, message: 'We could not create your school. Please try again.' },
      { status: 500 }
    )
  }
  const schoolId = school.id

  // 3. Create the first School Admin auth user.
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: adminEmail,
    password: input.password,
    email_confirm: true,
    user_metadata: { role: ROLES.SCHOOL_ADMIN, school_id: schoolId, full_name: input.adminFullName.trim() },
    app_metadata: { role: ROLES.SCHOOL_ADMIN, school_id: schoolId },
  })

  if (authError || !authData?.user) {
    // rollback school
    await admin.from('schools').delete().eq('id', schoolId)
    const exists = /already|registered|exists/i.test(authError?.message ?? '')
    return NextResponse.json(
      {
        success: false,
        message: exists
          ? 'An account with this email already exists. Please use login instead.'
          : 'We could not create your administrator account. Please try again.',
      },
      { status: exists ? 409 : 500 }
    )
  }

  // 4. Create the admin's user_profile.
  const { error: profileError } = await admin.from('user_profiles').insert({
    school_id: schoolId,
    auth_user_id: authData.user.id,
    full_name: input.adminFullName.trim(),
    email: adminEmail,
    role: ROLES.SCHOOL_ADMIN,
    is_active: true,
  })

  if (profileError) {
    // rollback auth user + school
    await admin.auth.admin.deleteUser(authData.user.id)
    await admin.from('schools').delete().eq('id', schoolId)
    return NextResponse.json(
      { success: false, message: 'We could not finish setting up your account. Please try again.' },
      { status: 500 }
    )
  }

  await logAudit({
    schoolId,
    actorId: authData.user.id,
    actorEmail: adminEmail,
    actorRole: ROLES.SCHOOL_ADMIN,
    action: 'school.self_registered',
    entityType: 'school',
    entityId: schoolId,
    entityLabel: input.schoolName.trim(),
    metadata: { code, plan: TRIAL_PLAN, status: 'trial', trial_ends_at: trialEndsAt, source: 'self-serve' },
  })

  return NextResponse.json({
    success: true,
    message: 'Your school is ready. You can now sign in.',
    schoolCode: code,
    trialEndsAt,
  })
}
