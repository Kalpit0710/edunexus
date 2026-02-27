import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database.types'

/** Role → dashboard route mapping */
const ROLE_ROUTES: Record<string, string> = {
  super_admin: '/dashboard',
  school_admin: '/dashboard',
  teacher: '/dashboard',
  manager: '/dashboard',
  cashier: '/dashboard',
  parent: '/dashboard',
}

/** Routes that don't require authentication */
const PUBLIC_ROUTES = ['/login', '/reset-password', '/auth/callback']

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
        setAll(cookiesToSet) {
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
    const rolePrefix =
      role === 'super_admin'
        ? '/super-admin'
        : role === 'school_admin'
          ? '/school-admin'
          : role === 'teacher'
            ? '/teacher'
            : role === 'manager' || role === 'cashier'
              ? '/manager'
              : '/parent'

    const url = request.nextUrl.clone()
    url.pathname = `${rolePrefix}${ROLE_ROUTES[role] ?? '/dashboard'}`
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
