/**
 * Milestone 1.3 — Role-based routing logic
 * Tests the ROLE_ROUTES mapping in isolation (pure logic, no HTTP required).
 */
import { describe, it, expect } from 'vitest'
import { ROLES } from '@/lib/constants'

/** Mirror of the ROLE_ROUTES mapping in src/lib/supabase/middleware.ts */
const ROLE_ROUTES: Record<string, string> = {
  super_admin: '/super-admin/dashboard',
  school_admin: '/school-admin/dashboard',
  teacher: '/teacher/dashboard',
  manager: '/manager/dashboard',
  cashier: '/manager/dashboard',
  parent: '/parent/dashboard',
}

const PUBLIC_ROUTES = ['/login', '/reset-password', '/auth/callback']

function getDashboardPath(role: string): string {
  return ROLE_ROUTES[role] ?? '/school-admin/dashboard'
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((r) => pathname.startsWith(r))
}

describe('ROLE_ROUTES mapping (M1.3)', () => {
  it('super_admin routes to /super-admin/dashboard', () => {
    expect(getDashboardPath(ROLES.SUPER_ADMIN)).toBe('/super-admin/dashboard')
  })

  it('school_admin routes to /school-admin/dashboard', () => {
    expect(getDashboardPath(ROLES.SCHOOL_ADMIN)).toBe('/school-admin/dashboard')
  })

  it('teacher routes to /teacher/dashboard', () => {
    expect(getDashboardPath(ROLES.TEACHER)).toBe('/teacher/dashboard')
  })

  it('manager routes to /manager/dashboard', () => {
    expect(getDashboardPath(ROLES.MANAGER)).toBe('/manager/dashboard')
  })

  it('cashier routes to /manager/dashboard (shared POS panel)', () => {
    expect(getDashboardPath(ROLES.CASHIER)).toBe('/manager/dashboard')
  })

  it('parent routes to /parent/dashboard', () => {
    expect(getDashboardPath(ROLES.PARENT)).toBe('/parent/dashboard')
  })

  it('unknown role falls back to /school-admin/dashboard', () => {
    expect(getDashboardPath('unknown_role')).toBe('/school-admin/dashboard')
  })

  it('all defined roles have a route mapping', () => {
    Object.values(ROLES).forEach((role) => {
      expect(ROLE_ROUTES[role]).toBeDefined()
      expect(ROLE_ROUTES[role]).toMatch(/^\/[a-z-]+\/dashboard$/)
    })
  })
})

describe('Public routes guard (M1.3)', () => {
  it('/login is a public route', () => {
    expect(isPublicRoute('/login')).toBe(true)
  })

  it('/reset-password is a public route', () => {
    expect(isPublicRoute('/reset-password')).toBe(true)
  })

  it('/auth/callback is a public route', () => {
    expect(isPublicRoute('/auth/callback')).toBe(true)
  })

  it('/school-admin/dashboard is NOT a public route', () => {
    expect(isPublicRoute('/school-admin/dashboard')).toBe(false)
  })

  it('/teacher/dashboard is NOT a public route', () => {
    expect(isPublicRoute('/teacher/dashboard')).toBe(false)
  })

  it('sub-paths of public routes are also public', () => {
    expect(isPublicRoute('/reset-password/confirm')).toBe(true)
  })
})
