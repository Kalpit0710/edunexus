import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database.types'

/** Role → dashboard route mapping */
const ROLE_ROUTES: Record<string, string> = {
  super_admin: '/super-admin/dashboard',
  school_admin: '/school-admin/dashboard',
  teacher: '/teacher/dashboard',
  manager: '/manager/dashboard',
  cashier: '/manager/dashboard',
  parent: '/parent/dashboard',
}

/** Route prefix → roles permitted to access it */
const ROLE_PREFIXES: { prefix: string; roles: string[] }[] = [
  { prefix: '/super-admin', roles: ['super_admin'] },
  { prefix: '/school-admin', roles: ['school_admin'] },
  { prefix: '/teacher', roles: ['teacher'] },
  { prefix: '/manager', roles: ['manager', 'cashier'] },
  { prefix: '/parent', roles: ['parent'] },
]

/** Routes that don't require authentication */
const PUBLIC_ROUTES = [
  '/login',
  '/create-account',
  '/reset-password',
  '/auth/callback',
  '/api/auth/parent-register',
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
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route))

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
      const url = request.nextUrl.clone()
      url.pathname = ROLE_ROUTES[role] ?? '/login'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
