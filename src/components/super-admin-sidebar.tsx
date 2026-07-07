'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { createClient } from '@/lib/supabase/client'
import { getInitials, cn } from '@/lib/utils'
import { LayoutDashboard, Building2, LogOut, Users, ScrollText, Tag, Bell } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { toast } from 'sonner'

const navItems = [
  { href: '/super-admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/super-admin/schools', label: 'Schools', icon: Building2 },
  { href: '/super-admin/users', label: 'Users', icon: Users },
  { href: '/super-admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/super-admin/pricing', label: 'Pricing', icon: Tag },
  { href: '/super-admin/audit', label: 'Audit Log', icon: ScrollText },
]

export function SuperAdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, reset } = useAuthStore()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    reset()
    toast.success('Signed out successfully')
    router.push('/login')
    router.refresh()
  }

  const fullName = (user?.user_metadata?.full_name as string) || 'Super Admin'

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[#0a0a0a]">
      {/* Platform brand */}
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
        <BrandLogo size={36} className="h-9 w-9 shrink-0" priority />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-white">EduNexus</p>
          <p className="truncate text-xs text-zinc-500">Platform Admin</p>
        </div>
      </div>

      {/* Nav */}
      <nav aria-label="Platform admin navigation" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4 scrollbar-hide">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== '/super-admin/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href as never}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-blue-600/15 text-white'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User + logout */}
      <div className="flex items-center gap-3 border-t border-white/[0.06] px-4 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600/15 text-xs font-semibold text-blue-300">
          {getInitials(fullName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{fullName}</p>
          <p className="truncate text-xs text-zinc-500">Super Admin</p>
        </div>
        <button
          onClick={handleLogout}
          title="Sign out"
          aria-label="Sign out"
          className="text-zinc-500 transition-colors hover:text-red-400"
        >
          <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </div>
    </aside>
  )
}
