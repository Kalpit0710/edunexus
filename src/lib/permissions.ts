// ─────────────────────────────────────────────────────────────────────────────
// Granular role permissions — catalog + defaults.
//
// Permissions are `${module}.${capability}` keys. Each school can override the
// per-role defaults via the `role_permissions` table; absence of an override
// means "use the default below", so existing schools keep their current
// behaviour until an admin tightens something.
//
// This module is pure (no DB / no server-only) so it can be imported on both
// the client (UI gating) and the server (enforcement).
// ─────────────────────────────────────────────────────────────────────────────

/** Roles whose capabilities are configurable. super_admin always has everything;
 *  parent is governed separately (portal access), not by this matrix. */
export const CONFIGURABLE_ROLES = ['school_admin', 'manager', 'teacher', 'cashier'] as const
export type ConfigurableRole = (typeof CONFIGURABLE_ROLES)[number]

export const ROLE_LABEL: Record<ConfigurableRole, string> = {
  school_admin: 'School Admin',
  manager: 'Manager',
  teacher: 'Teacher',
  cashier: 'Cashier',
}

export interface PermissionDef {
  key: string
  label: string
  module: string
}

/** The full capability catalog, grouped by module. */
export const PERMISSIONS: PermissionDef[] = [
  { module: 'Students', key: 'students.view', label: 'View students' },
  { module: 'Students', key: 'students.create', label: 'Admit / create students' },
  { module: 'Students', key: 'students.edit', label: 'Edit students' },
  { module: 'Students', key: 'students.delete', label: 'Delete students' },

  { module: 'Attendance', key: 'attendance.view', label: 'View attendance' },
  { module: 'Attendance', key: 'attendance.mark', label: 'Mark attendance' },

  { module: 'Teachers', key: 'teachers.view', label: 'View teachers' },
  { module: 'Teachers', key: 'teachers.manage', label: 'Add / edit / deactivate teachers' },

  { module: 'Fees', key: 'fees.view', label: 'View fees' },
  { module: 'Fees', key: 'fees.collect', label: 'Collect fees' },
  { module: 'Fees', key: 'fees.configure', label: 'Configure fee structures' },

  { module: 'Report Cards', key: 'exams.view', label: 'View report cards' },
  { module: 'Report Cards', key: 'exams.enter_marks', label: 'Enter marks' },
  { module: 'Report Cards', key: 'exams.configure', label: 'Configure report cards' },
  { module: 'Report Cards', key: 'exams.publish', label: 'Publish / lock results' },

  { module: 'Reports', key: 'reports.view', label: 'View reports & analytics' },

  { module: 'Communication', key: 'communication.view', label: 'View announcements' },
  { module: 'Communication', key: 'communication.send', label: 'Send announcements' },

  { module: 'Inventory', key: 'inventory.view', label: 'View inventory' },
  { module: 'Inventory', key: 'inventory.manage', label: 'Manage inventory & sales' },

  { module: 'Timetable', key: 'timetable.view', label: 'View timetable' },
  { module: 'Timetable', key: 'timetable.manage', label: 'Manage timetable' },

  { module: 'Transport', key: 'transport.view', label: 'View transport' },
  { module: 'Transport', key: 'transport.manage', label: 'Manage transport' },

  { module: 'Library', key: 'library.view', label: 'View library' },
  { module: 'Library', key: 'library.manage', label: 'Manage library' },

  { module: 'Settings', key: 'settings.manage', label: 'Manage school settings' },
]

export const PERMISSION_KEYS: string[] = PERMISSIONS.map((p) => p.key)

/** Built-in per-role defaults. School admin gets everything. */
const ALL = new Set(PERMISSION_KEYS)

export const DEFAULT_ROLE_PERMISSIONS: Record<ConfigurableRole, Set<string>> = {
  school_admin: ALL,
  manager: new Set([
    'students.view',
    'students.create',
    'students.edit',
    'attendance.view',
    'attendance.mark',
    'teachers.view',
    'fees.view',
    'fees.collect',
    'fees.configure',
    'exams.view',
    'exams.enter_marks',
    'exams.configure',
    'exams.publish',
    'reports.view',
    'communication.view',
    'communication.send',
    'inventory.view',
    'inventory.manage',
    'timetable.view',
    'timetable.manage',
    'transport.view',
    'transport.manage',
    'library.view',
    'library.manage',
  ]),
  teacher: new Set([
    'students.view',
    'attendance.view',
    'attendance.mark',
    'exams.view',
    'exams.enter_marks',
    'reports.view',
    'communication.view',
    'communication.send',
    'timetable.view',
    'transport.view',
    'library.view',
  ]),
  cashier: new Set(['students.view', 'fees.view', 'fees.collect', 'reports.view', 'inventory.view', 'inventory.manage']),
}

/** Is `role` a configurable role? */
export function isConfigurableRole(role: string): role is ConfigurableRole {
  return (CONFIGURABLE_ROLES as readonly string[]).includes(role)
}

/** Default allow for a role + permission (before any school override). */
export function defaultAllows(role: string, permission: string): boolean {
  if (role === 'super_admin') return true
  if (!isConfigurableRole(role)) return false
  return DEFAULT_ROLE_PERMISSIONS[role].has(permission)
}

export interface PermissionOverride {
  permission: string
  allowed: boolean
}

/**
 * Effective allowed permission keys for a role given its school's override rows.
 * super_admin → ['*'] (everything). Overrides win over defaults.
 */
export function computeEffectivePermissions(role: string, overrides: PermissionOverride[]): string[] {
  if (role === 'super_admin') return ['*']
  if (!isConfigurableRole(role)) return []
  const overrideMap = new Map(overrides.map((o) => [o.permission, o.allowed]))
  return PERMISSION_KEYS.filter((key) =>
    overrideMap.has(key) ? Boolean(overrideMap.get(key)) : DEFAULT_ROLE_PERMISSIONS[role].has(key),
  )
}

/** Client-side check against an effective permission set (supports '*'). */
export function permissionSetAllows(effective: string[], permission: string): boolean {
  return effective.includes('*') || effective.includes(permission)
}
