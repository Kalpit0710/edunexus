'use server'

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import {
  DEFAULT_PLAN_PRICE,
  SUBSCRIPTION_PLANS,
  monthlyRevenueForSchool,
  type PlanPriceMap,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from '@/lib/subscription'
import { logAudit } from '@/lib/audit'

// ── Supabase helpers ─────────────────────────────────────────────────────────

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
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
            /* called from a Server Component — safe to ignore */
          }
        },
      },
    }
  )
}

/** Service-role client (bypasses RLS) for cross-tenant platform operations. */
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * Defense-in-depth: verify the caller is an authenticated super_admin before any
 * privileged cross-tenant operation. Throws if not. Returns the actor identity
 * for audit logging.
 */
async function requireSuperAdmin(): Promise<{ id: string; email: string | null; role: string }> {
  const supabase = await getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (error || !profile || (profile as { role: string }).role !== 'super_admin') {
    throw new Error('Forbidden: super admin access required')
  }

  return { id: user.id, email: user.email ?? null, role: 'super_admin' }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface SchoolRow {
  id: string
  name: string
  code: string
  email: string | null
  phone: string | null
  city: string | null
  state: string | null
  is_active: boolean
  subscription_plan: SubscriptionPlan
  subscription_status: SubscriptionStatus
  trial_ends_at: string | null
  created_at: string
  admin_count?: number
  student_count?: number
}

export interface PlatformStats {
  totalSchools: number
  activeSchools: number
  suspendedSchools: number
  trialSchools: number
  totalStudents: number
  totalUsers: number
  monthlyRevenue: number
  planBreakdown: { plan: SubscriptionPlan; count: number }[]
  recentSchools: {
    id: string
    name: string
    code: string
    created_at: string
    subscription_plan: SubscriptionPlan
    subscription_status: SubscriptionStatus
  }[]
}

export interface CreateSchoolPayload {
  name: string
  code: string
  email: string | null
  phone: string | null
  city: string | null
  state: string | null
  subscription_plan: SubscriptionPlan
  subscription_status: SubscriptionStatus
  trial_ends_at: string | null
  admin_full_name: string
  admin_email: string
  admin_password: string
}

export interface UpdateSchoolPayload {
  name?: string
  email?: string | null
  phone?: string | null
  city?: string | null
  state?: string | null
  subscription_plan?: SubscriptionPlan
  subscription_status?: SubscriptionStatus
  trial_ends_at?: string | null
}

// ── Reads ──────────────────────────────────────────────────────────────────

export async function getPlatformStats(): Promise<PlatformStats> {
  await requireSuperAdmin()
  const admin = getAdminClient()

  const [{ data: schools }, { count: studentCount }, { count: userCount }] =
    await Promise.all([
      admin
        .from('schools')
        .select(
          'id, name, code, subscription_plan, subscription_status, created_at, is_active'
        ),
      admin.from('students').select('id', { count: 'exact', head: true }).eq('is_active', true),
      admin.from('user_profiles').select('id', { count: 'exact', head: true }),
    ])

  const rows = (schools ?? []) as Array<{
    id: string
    name: string
    code: string
    subscription_plan: SubscriptionPlan
    subscription_status: SubscriptionStatus
    created_at: string
    is_active: boolean
  }>

  const planBreakdown = (['basic', 'standard', 'premium'] as SubscriptionPlan[]).map(
    (plan) => ({ plan, count: rows.filter((r) => r.subscription_plan === plan).length })
  )

  const prices = await resolvePlanPricing(admin)
  const monthlyRevenue = rows.reduce(
    (sum, r) => sum + monthlyRevenueForSchool(r.subscription_plan, r.subscription_status, prices),
    0
  )

  const recentSchools = [...rows]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      created_at: r.created_at,
      subscription_plan: r.subscription_plan,
      subscription_status: r.subscription_status,
    }))

  return {
    totalSchools: rows.length,
    activeSchools: rows.filter((r) => r.subscription_status === 'active').length,
    suspendedSchools: rows.filter((r) => r.subscription_status === 'suspended').length,
    trialSchools: rows.filter((r) => r.subscription_status === 'trial').length,
    totalStudents: studentCount ?? 0,
    totalUsers: userCount ?? 0,
    monthlyRevenue,
    planBreakdown,
    recentSchools,
  }
}

export async function getSchools(): Promise<SchoolRow[]> {
  await requireSuperAdmin()
  const admin = getAdminClient()

  const { data, error } = await admin
    .from('schools')
    .select(
      'id, name, code, email, phone, city, state, is_active, subscription_plan, subscription_status, trial_ends_at, created_at'
    )
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as SchoolRow[]
}

export async function getSchoolById(id: string): Promise<SchoolRow | null> {
  await requireSuperAdmin()
  const admin = getAdminClient()

  const { data, error } = await admin
    .from('schools')
    .select(
      'id, name, code, email, phone, city, state, is_active, subscription_plan, subscription_status, trial_ends_at, created_at'
    )
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const [{ count: adminCount }, { count: studentCount }] = await Promise.all([
    admin
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', id)
      .eq('role', 'school_admin'),
    admin
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', id)
      .eq('is_active', true),
  ])

  return {
    ...(data as unknown as SchoolRow),
    admin_count: adminCount ?? 0,
    student_count: studentCount ?? 0,
  }
}

// ── Writes ─────────────────────────────────────────────────────────────────

/**
 * Creates a school and provisions its first School Admin (auth user + profile)
 * in one sequence. Rolls back the auth user if any later step fails.
 */
export async function createSchool(payload: CreateSchoolPayload): Promise<string> {
  const actor = await requireSuperAdmin()
  const admin = getAdminClient()

  // 1. Create the school
  const { data: school, error: schoolError } = await admin
    .from('schools')
    .insert({
      name: payload.name,
      code: payload.code,
      email: payload.email,
      phone: payload.phone,
      city: payload.city,
      state: payload.state,
      is_active: payload.subscription_status !== 'suspended',
      subscription_plan: payload.subscription_plan,
      subscription_status: payload.subscription_status,
      trial_ends_at: payload.trial_ends_at,
    })
    .select('id')
    .single()

  if (schoolError || !school) {
    throw new Error('School creation failed: ' + (schoolError?.message ?? 'unknown'))
  }
  const schoolId = (school as { id: string }).id

  // 2. Create the first School Admin auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: payload.admin_email,
    password: payload.admin_password,
    email_confirm: true,
    user_metadata: { role: 'school_admin', school_id: schoolId, full_name: payload.admin_full_name },
    app_metadata: { role: 'school_admin', school_id: schoolId },
  })

  if (authError || !authData.user) {
    // rollback school
    await admin.from('schools').delete().eq('id', schoolId)
    throw new Error('Admin auth creation failed: ' + (authError?.message ?? 'unknown'))
  }

  // 3. Create the admin's user_profile
  const { error: profileError } = await admin.from('user_profiles').insert({
    school_id: schoolId,
    auth_user_id: authData.user.id,
    full_name: payload.admin_full_name,
    email: payload.admin_email,
    role: 'school_admin',
    is_active: true,
  })

  if (profileError) {
    // rollback auth user + school
    await admin.auth.admin.deleteUser(authData.user.id)
    await admin.from('schools').delete().eq('id', schoolId)
    throw new Error('Admin profile creation failed: ' + profileError.message)
  }

  await logAudit({
    schoolId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: 'school.created',
    entityType: 'school',
    entityId: schoolId,
    entityLabel: payload.name,
    metadata: { code: payload.code, plan: payload.subscription_plan, status: payload.subscription_status, admin_email: payload.admin_email },
  })

  return schoolId
}

export async function updateSchool(id: string, payload: UpdateSchoolPayload): Promise<void> {
  const actor = await requireSuperAdmin()
  const admin = getAdminClient()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (payload.name !== undefined) update.name = payload.name
  if (payload.email !== undefined) update.email = payload.email
  if (payload.phone !== undefined) update.phone = payload.phone
  if (payload.city !== undefined) update.city = payload.city
  if (payload.state !== undefined) update.state = payload.state
  if (payload.subscription_plan !== undefined) update.subscription_plan = payload.subscription_plan
  if (payload.trial_ends_at !== undefined) update.trial_ends_at = payload.trial_ends_at
  if (payload.subscription_status !== undefined) {
    update.subscription_status = payload.subscription_status
    update.is_active = payload.subscription_status !== 'suspended'
  }

  const { error } = await admin.from('schools').update(update).eq('id', id)
  if (error) throw new Error(error.message)

  await logAudit({
    schoolId: id,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: 'school.updated',
    entityType: 'school',
    entityId: id,
    entityLabel: payload.name ?? null,
    metadata: { changes: update },
  })
}

/** Suspend (or reactivate) a school. Suspending also disables `is_active`. */
export async function setSchoolSuspended(id: string, suspended: boolean): Promise<void> {
  const actor = await requireSuperAdmin()
  const admin = getAdminClient()

  const { error } = await admin
    .from('schools')
    .update({
      subscription_status: suspended ? 'suspended' : 'active',
      is_active: !suspended,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(error.message)

  await logAudit({
    schoolId: id,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: suspended ? 'school.suspended' : 'school.reactivated',
    entityType: 'school',
    entityId: id,
  })
}

// ── Plan Price Configuration (Milestone 3) ───────────────────────────────────

/** Resolve plan prices from the DB, falling back to code defaults per plan. */
async function resolvePlanPricing(
  admin: ReturnType<typeof getAdminClient>
): Promise<PlanPriceMap> {
  const prices: PlanPriceMap = { ...DEFAULT_PLAN_PRICE }
  const { data } = await admin.from('plan_prices').select('plan, price_inr')
  for (const row of (data ?? []) as Array<{ plan: SubscriptionPlan; price_inr: number }>) {
    if (SUBSCRIPTION_PLANS.includes(row.plan)) prices[row.plan] = row.price_inr
  }
  return prices
}

/** Current plan pricing (DB-backed, with code defaults as fallback). */
export async function getPlanPricing(): Promise<PlanPriceMap> {
  await requireSuperAdmin()
  return resolvePlanPricing(getAdminClient())
}

/** Update monthly plan prices (super-admin only, audited). */
export async function updatePlanPricing(
  next: Partial<Record<SubscriptionPlan, number>>
): Promise<PlanPriceMap> {
  const actor = await requireSuperAdmin()
  const admin = getAdminClient()
  const current = await resolvePlanPricing(admin)

  const updates: Array<{ plan: SubscriptionPlan; price_inr: number; updated_by: string; updated_at: string }> = []
  for (const plan of SUBSCRIPTION_PLANS) {
    const value = next[plan]
    if (value === undefined) continue
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Invalid price for ${plan}: prices must be whole, non-negative numbers.`)
    }
    if (value !== current[plan]) {
      updates.push({ plan, price_inr: value, updated_by: actor.id, updated_at: new Date().toISOString() })
    }
  }

  if (updates.length === 0) return current

  const { error } = await admin.from('plan_prices').upsert(updates, { onConflict: 'plan' })
  if (error) throw new Error(error.message)

  const resolved = await resolvePlanPricing(admin)
  await logAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: 'plan_price.updated',
    entityType: 'plan_price',
    metadata: {
      changes: updates.map((u) => ({ plan: u.plan, from: current[u.plan], to: u.price_inr })),
    },
  })
  return resolved
}

// ── Global Users Directory (Milestone 2) ─────────────────────────────────────

export interface PlatformUserRow {
  id: string
  auth_user_id: string
  full_name: string
  email: string
  phone: string | null
  role: string
  is_active: boolean
  created_at: string
  school_id: string | null
  school_name: string | null
  school_code: string | null
}

/** Every user profile across all schools (plus super admins). */
export async function getAllUsers(): Promise<PlatformUserRow[]> {
  await requireSuperAdmin()
  const admin = getAdminClient()

  const { data, error } = await admin
    .from('user_profiles')
    .select('id, auth_user_id, full_name, email, phone, role, is_active, created_at, school_id, schools(name, code)')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return ((data ?? []) as any[]).map((u) => {
    const school = Array.isArray(u.schools) ? u.schools[0] : u.schools
    return {
      id: u.id,
      auth_user_id: u.auth_user_id,
      full_name: u.full_name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      is_active: u.is_active,
      created_at: u.created_at,
      school_id: u.school_id,
      school_name: school?.name ?? null,
      school_code: school?.code ?? null,
    }
  })
}

/** Activate or deactivate a user platform-wide (updates profile is_active). */
export async function setUserActive(profileId: string, active: boolean): Promise<void> {
  const actor = await requireSuperAdmin()
  const admin = getAdminClient()

  const { data: updated, error } = await admin
    .from('user_profiles')
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq('id', profileId)
    .select('school_id, full_name, auth_user_id')
    .single()

  if (error) throw new Error(error.message)

  const row = updated as { school_id: string | null; full_name: string; auth_user_id: string } | null
  await logAudit({
    schoolId: row?.school_id ?? null,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: active ? 'user.activated' : 'user.deactivated',
    entityType: 'user',
    entityId: row?.auth_user_id ?? null,
    entityLabel: row?.full_name ?? null,
  })
}

/** Set a new password for any user (super admin support action). */
export async function resetUserPassword(authUserId: string, newPassword: string): Promise<void> {
  const actor = await requireSuperAdmin()
  if (!newPassword || newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters')
  }
  const admin = getAdminClient()

  const { error } = await admin.auth.admin.updateUserById(authUserId, { password: newPassword })
  if (error) throw new Error(error.message)

  await logAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: 'user.password_reset',
    entityType: 'user',
    entityId: authUserId,
  })
}

// ── Audit Log (Milestone 3) ──────────────────────────────────────────────────

export interface AuditLogRow {
  id: string
  school_id: string | null
  actor_email: string | null
  actor_role: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  entity_label: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  school_name: string | null
}

/** Recent platform audit entries (most recent first). */
export async function getAuditLogs(limit = 200): Promise<AuditLogRow[]> {
  await requireSuperAdmin()
  const admin = getAdminClient()

  const { data, error } = await admin
    .from('audit_logs')
    .select('id, school_id, actor_email, actor_role, action, entity_type, entity_id, entity_label, metadata, created_at, schools(name)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    // Table may not exist yet (migration not applied) — surface a clear message.
    throw new Error(error.message)
  }

  return ((data ?? []) as any[]).map((r) => {
    const school = Array.isArray(r.schools) ? r.schools[0] : r.schools
    return {
      id: r.id,
      school_id: r.school_id,
      actor_email: r.actor_email,
      actor_role: r.actor_role,
      action: r.action,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      entity_label: r.entity_label,
      metadata: r.metadata,
      created_at: r.created_at,
      school_name: school?.name ?? null,
    }
  })
}

// ── Per-school drill-down (Milestone 2) ──────────────────────────────────────

export interface SchoolOverview {
  students: number
  teachers: number
  classes: number
  totalCollected: number
  todayCollected: number
  attendanceTodayPct: number | null
  recentActivity: {
    id: string
    action: string
    entity_label: string | null
    actor_email: string | null
    created_at: string
  }[]
}

/** Aggregated operational snapshot for a single school. */
export async function getSchoolOverview(schoolId: string): Promise<SchoolOverview> {
  await requireSuperAdmin()
  const admin = getAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const [studentsRes, teachersRes, classesRes, paymentsRes, attendanceRes, auditRes] =
    await Promise.all([
      admin.from('students').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true),
      admin.from('teachers').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true),
      admin.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
      admin.from('fee_payments').select('paid_amount, payment_date').eq('school_id', schoolId),
      admin.from('attendance_records').select('status').eq('school_id', schoolId).eq('date', today),
      admin
        .from('audit_logs')
        .select('id, action, entity_label, actor_email, created_at')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

  const payments = (paymentsRes.data ?? []) as { paid_amount: number; payment_date: string }[]
  const totalCollected = payments.reduce((s, p) => s + Number(p.paid_amount || 0), 0)
  const todayCollected = payments
    .filter((p) => p.payment_date === today)
    .reduce((s, p) => s + Number(p.paid_amount || 0), 0)

  const att = (attendanceRes.data ?? []) as { status: string }[]
  const attendanceTodayPct = att.length
    ? Math.round((att.filter((a) => a.status === 'present').length / att.length) * 100)
    : null

  return {
    students: studentsRes.count ?? 0,
    teachers: teachersRes.count ?? 0,
    classes: classesRes.count ?? 0,
    totalCollected,
    todayCollected,
    attendanceTodayPct,
    recentActivity: ((auditRes.data ?? []) as any[]).map((r) => ({
      id: r.id,
      action: r.action,
      entity_label: r.entity_label,
      actor_email: r.actor_email,
      created_at: r.created_at,
    })),
  }
}

// ── Impersonation (Milestone 3) ──────────────────────────────────────────────

const IMPERSONATION_MINUTES = 30
const ORIGIN_COOKIE = 'sa_imp_origin'
const BANNER_COOKIE = 'imp_banner'

const ROLE_ROUTE: Record<string, string> = {
  school_admin: '/school-admin/dashboard',
  teacher: '/teacher/dashboard',
  manager: '/manager/dashboard',
  cashier: '/manager/dashboard',
  parent: '/parent/dashboard',
}

/**
 * Begin a time-boxed, audited impersonation of a non-super-admin user.
 * Captures the super admin's session for later restoration, mints a one-time
 * magic-link token for the target via the Admin API, and assumes their session.
 * Returns the route to redirect to.
 */
export async function startImpersonation(targetProfileId: string): Promise<string> {
  const actor = await requireSuperAdmin()
  const admin = getAdminClient()
  const supabase = await getSupabase()
  const cookieStore = await cookies()

  const { data: target, error: targetErr } = await admin
    .from('user_profiles')
    .select('auth_user_id, email, full_name, role, school_id')
    .eq('id', targetProfileId)
    .single()

  if (targetErr || !target) throw new Error('Target user not found')
  const t = target as {
    auth_user_id: string
    email: string
    full_name: string
    role: string
    school_id: string | null
  }
  if (t.role === 'super_admin') throw new Error('Cannot impersonate a super admin')

  // Capture the super admin's session so we can restore it on exit.
  const {
    data: { session: saSession },
  } = await supabase.auth.getSession()
  if (!saSession) throw new Error('No active super admin session to restore later')

  const expiresAt = Date.now() + IMPERSONATION_MINUTES * 60 * 1000
  const maxAge = IMPERSONATION_MINUTES * 60

  cookieStore.set(
    ORIGIN_COOKIE,
    JSON.stringify({
      access_token: saSession.access_token,
      refresh_token: saSession.refresh_token,
      super_admin_email: actor.email,
      expires_at: expiresAt,
    }),
    { httpOnly: true, sameSite: 'lax', path: '/', maxAge }
  )

  // Mint a one-time magic link token for the target and verify it to assume
  // their session (cookies are rewritten by the SSR client).
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: t.email,
  })
  const tokenHash = link?.properties?.hashed_token
  if (linkErr || !tokenHash) {
    cookieStore.delete(ORIGIN_COOKIE)
    throw new Error('Failed to mint impersonation token: ' + (linkErr?.message ?? 'unknown'))
  }

  const { error: verifyErr } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  })
  if (verifyErr) {
    cookieStore.delete(ORIGIN_COOKIE)
    throw new Error('Failed to start impersonation: ' + verifyErr.message)
  }

  // Client-readable banner marker.
  cookieStore.set(
    BANNER_COOKIE,
    JSON.stringify({ email: t.email, name: t.full_name, role: t.role, expires_at: expiresAt }),
    { httpOnly: false, sameSite: 'lax', path: '/', maxAge }
  )

  await logAudit({
    schoolId: t.school_id,
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: 'impersonation.started',
    entityType: 'user',
    entityId: t.auth_user_id,
    entityLabel: t.full_name,
    metadata: { target_email: t.email, expires_at: new Date(expiresAt).toISOString() },
  })

  return ROLE_ROUTE[t.role] ?? '/school-admin/dashboard'
}

/**
 * End the current impersonation and restore the original super admin session.
 * Returns the route to redirect to.
 */
export async function stopImpersonation(): Promise<string> {
  const cookieStore = await cookies()
  const supabase = await getSupabase()

  const originRaw = cookieStore.get(ORIGIN_COOKIE)?.value
  cookieStore.delete(ORIGIN_COOKIE)
  cookieStore.delete(BANNER_COOKIE)

  if (!originRaw) {
    return '/login'
  }

  let origin: { access_token: string; refresh_token: string; super_admin_email: string | null }
  try {
    origin = JSON.parse(originRaw)
  } catch {
    await supabase.auth.signOut()
    return '/login'
  }

  const { error } = await supabase.auth.setSession({
    access_token: origin.access_token,
    refresh_token: origin.refresh_token,
  })

  if (error) {
    // Original session could not be restored (e.g. expired) — sign out for safety.
    await supabase.auth.signOut()
    return '/login'
  }

  await logAudit({
    actorEmail: origin.super_admin_email,
    actorRole: 'super_admin',
    action: 'impersonation.ended',
  })

  return '/super-admin/users'
}
