'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { usePathname, useRouter } from 'next/navigation'
import { Home, CalendarCheck, BookOpen, BookText, CalendarRange, IndianRupee, Megaphone, Bus, CalendarDays, LogOut, GraduationCap, ChevronDown, Users } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'
import { getLinkedChildren, type ParentChildData } from '@/app/(parent)/parent/actions'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn, getInitials } from '@/lib/utils'

const navItems: Array<{ href: Route; label: string; icon: typeof Home }> = [
  { href: '/parent/today', label: 'Today', icon: Home },
  { href: '/parent/attendance', label: 'Attendance', icon: CalendarCheck },
  { href: '/parent/timetable', label: 'Timetable', icon: CalendarRange },
  { href: '/parent/homework', label: 'Homework', icon: BookText },
  { href: '/parent/results', label: 'Results', icon: BookOpen },
  { href: '/parent/fees', label: 'Fees', icon: IndianRupee },
  { href: '/parent/family', label: 'Family', icon: Users },
  { href: '/parent/transport', label: 'Transport', icon: Bus },
  { href: '/parent/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/parent/announcements', label: 'Announcements', icon: Megaphone },
]

export function ParentSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, school, reset, activeChildId, setActiveChildId } = useAuthStore()
  const [children_, setChildren_] = useState<ParentChildData[]>([])
  
  const activeChild = children_.find(c => c.id === activeChildId) ?? children_[0] ?? null

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    reset()
    toast.success('Signed out successfully')
    router.push('/login')
    router.refresh()
  }

  useEffect(() => {
    if (!user?.email || !school?.id) return
    getLinkedChildren(user.email, school.id).then(list => {
      setChildren_(list)
      if (!useAuthStore.getState().activeChildId && list.length > 0) {
        setActiveChildId(list[0]?.id ?? null)
      }
    })
  }, [user?.email, school?.id, setActiveChildId])

  const fullName = (user?.user_metadata?.full_name as string) || 'Parent'

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[#0a0a0a]">
      {/* School brand & Child Selector */}
      <div className="flex flex-col gap-3 border-b border-white/[0.06] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-600/10 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.2)]">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-white">{school?.name ?? 'EduNexus'}</p>
            <p className="text-xs text-zinc-500">Parent Portal</p>
          </div>
        </div>

        {/* Child Selector */}
        {children_.length > 0 && activeChild && (
          <DropdownMenu>
            <DropdownMenuTrigger className="mt-1 flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left transition-colors hover:bg-white/10">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{activeChild.fullName}</p>
                <p className="truncate text-xs text-zinc-500">{activeChild.className}</p>
              </div>
              {children_.length > 1 && <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />}
            </DropdownMenuTrigger>
            {children_.length > 1 && (
              <DropdownMenuContent align="start" className="w-[214px] bg-[#111] border-white/10">
                {children_.map(c => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={() => setActiveChildId(c.id)}
                    className={cn(
                      'flex flex-col items-start gap-0.5 text-zinc-300 focus:bg-white/10 focus:text-white cursor-pointer py-2',
                      c.id === activeChildId ? 'bg-white/5 font-medium text-blue-400' : ''
                    )}
                  >
                    <span>{c.fullName}</span>
                    <span className="text-xs opacity-70">{c.className}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            )}
          </DropdownMenu>
        )}
      </div>

      {/* Nav */}
      <nav aria-label="Parent navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-hide">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'text-blue-400' : 'text-zinc-500')} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/[0.06] px-3 py-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600/15 border border-blue-500/20 text-blue-300 text-xs font-semibold">
            {getInitials(fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{fullName}</p>
            <p className="text-xs text-zinc-500">Parent</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            aria-label="Sign out"
            className="text-zinc-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  )
}
