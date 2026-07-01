import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database.types'
import { evaluateSubscriptionAccess } from '@/lib/subscription-access'

/** Role → dashboard route mapping */
const ROLE_ROUTES: Record<string, string> = {
  super_admin: '/super-admin/dashboard',
  school_admin: '/school-admin/dashboard',
  teacher: '/teacher/dashboard',
  manager: '/manager/dashboard',
  cashier: '/manager/dashboard',
  parent: '/parent/today',
}

/** Route prefix → roles permitted to access it */
const ROLE_PREFIXES: { prefix: string; roles: string[] }[] = [
  { prefix: '/super-admin', roles: ['super_admin'] },
  { prefix: '/school-admin', roles: ['school_admin'] },
  { prefix: '/teacher', roles: ['teacher'] },
  // School admins share the manager surface (inventory + bookstore POS).
  { prefix: '/manager', roles: ['manager', 'cashier', 'school_admin'] },
  { prefix: '/parent', roles: ['parent'] },
]

/**
 * School-admin sub-surfaces that managers/cashiers may also use: student
 * records and fee collection / receipts. Gated precisely in server actions.
 */
const MANAGER_SHARED_PREFIXES = ['/school-admin/students', '/school-admin/fees']

/** Routes that don't require authentication */
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/create-account',
  '/register-school',
  '/reset-password',
  '/auth/callback',
  '/api/auth/parent-register',
  '/api/auth/school-register',
  '/api/health',
  '/api/cron/weekly-digest',
  '/api/cron/fee-reminders',
  '/api/debug/sentry',
]

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || (route !== '/' && pathname.startsWith(route))
  )

  // Not authenticated → redirect to login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated on public route → redirect to role dashboard
  if (user && isPublicRoute && pathname !== '/auth/callback') {
    const role = (user.user_metadata?.role as string | undefined) ?? 'school_admin'
    const dashboardPath = ROLE_ROUTES[role] ?? '/school-admin/dashboard'
    const url = request.nextUrl.clone()
    url.pathname = dashboardPath
    return NextResponse.redirect(url)
  }

  // Authenticated but accessing another role's area → redirect to own dashboard.
  // app_metadata.role is server-controlled (not user-editable) so it is the
  // trusted source; fall back to user_metadata for older sessions.
  if (user && !isPublicRoute) {
    const role =
      (user.app_metadata?.role as string | undefined) ??
      (user.user_metadata?.role as string | undefined) ??
      'school_admin'
    const match = ROLE_PREFIXES.find((r) => pathname.startsWith(r.prefix))
    if (match && !match.roles.includes(role)) {
      // Managers/cashiers share specific school-admin surfaces: viewing/editing
      // students and collecting fees (issuing receipts). Precise capability
      // gating still happens in the server actions via requirePermission and RLS.
      const sharedManagerOk =
        (role === 'manager' || role === 'cashier') &&
        MANAGER_SHARED_PREFIXES.some(
          (p) => pathname === p || pathname.startsWith(p + '/'),
        )
      if (!sharedManagerOk) {
        const url = request.nextUrl.clone()
        url.pathname = ROLE_ROUTES[role] ?? '/login'
        return NextResponse.redirect(url)
      }
    }

    // Subscription lockout (B0.1): block a school whose subscription is
    // suspended or whose trial has expired. Super-admins are exempt (no school).
    // The `/subscription-inactive` page is excluded to avoid a redirect loop.
    if (role !== 'super_admin' && pathname !== '/subscription-inactive') {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('school_id, schools(subscription_status, trial_ends_at)')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      const schoolRel = (profile as { schools?: unknown } | null)?.schools
      const school = (Array.isArray(schoolRel) ? schoolRel[0] : schoolRel) as
        | { subscription_status?: string | null; trial_ends_at?: string | null }
        | undefined

      // Only act when we positively read a school row; fail-open otherwise so a
      // transient read issue never locks legitimate users out.
      if (school) {
        const { allowed } = evaluateSubscriptionAccess(
          school.subscription_status,
          school.trial_ends_at,
        )
        if (!allowed) {
          const url = request.nextUrl.clone()
          url.pathname = '/subscription-inactive'
          return NextResponse.redirect(url)
        }
      }
    }
  }

  return supabaseResponse
}
