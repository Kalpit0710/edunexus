'use client'

import { useAuthStore } from '@/stores/auth.store'
import { SchoolAdminSidebar } from './school-admin-sidebar'
import { ManagerSidebar } from './manager-sidebar'

/**
 * Role-aware sidebar for the shared `/school-admin` surfaces.
 *
 * Managers and cashiers may use a few school-admin pages (student records and
 * fee collection). Rather than dropping them into the School Admin shell — which
 * exposes admin-only nav they can't use — keep their own Manager chrome so the
 * experience is consistent with the rest of the manager area.
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
