'use client'

import { useAuthStore } from '@/stores/auth.store'
import { SchoolAdminSidebar } from './school-admin-sidebar'
import { ManagerSidebar } from './manager-sidebar'

/**
 * Role-aware sidebar for surfaces shared between school admins and
 * managers/cashiers (the `/school-admin` student/fee pages and the `/manager`
 * inventory + POS pages).
 *
 * Each role keeps its own chrome regardless of which route group the page lives
 * in: a school admin browsing `/manager/inventory` still sees the School Admin
 * nav (not the Manager Portal), and a manager stays in the Manager shell. This
 * avoids exposing nav a role can't use and prevents the confusing "switched to
 * manager view" effect when an admin opens Inventory.
 */
export function SchoolAreaSidebar() {
  const user = useAuthStore((s) => s.user)
  const role = user?.user_metadata?.role

  // While auth is still hydrating (user unknown), render a neutral sidebar shell
  // of the same width so neither role sees a flash of the other's navigation and
  // there's no layout shift once the real sidebar mounts.
  if (!user) {
    return <aside className="h-screen w-64 shrink-0 border-r border-white/[0.06] bg-[#0a0a0a]" aria-hidden />
  }

  if (role === 'manager' || role === 'cashier') {
    return <ManagerSidebar />
  }
  return <SchoolAdminSidebar />
}
