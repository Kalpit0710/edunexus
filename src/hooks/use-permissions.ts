'use client'

import { useAuthStore } from '@/stores/auth.store'
import { permissionSetAllows } from '@/lib/permissions'

/**
 * Client-side access to the current user's effective permissions (role defaults
 * + per-school overrides, loaded at sign-in). Use `can(key)` to gate UI; the
 * server still enforces via `requirePermission`, so this is convenience only.
 */
export function usePermissions() {
  const permissions = useAuthStore((s) => s.permissions)
  const effectivePermissions = Array.isArray(permissions) ? permissions : []

  return {
    permissions: effectivePermissions,
    can: (permission: string) => permissionSetAllows(effectivePermissions, permission),
  }
}
