'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CalendarCheck, BookOpen, IndianRupee, Megaphone, ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState } from 'react'
import { getLinkedChildren, type ParentChildData } from './parent/actions'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/parent/dashboard', icon: Home, label: 'Home' },
  { href: '/parent/attendance', icon: CalendarCheck, label: 'Attendance' },
  { href: '/parent/results', icon: BookOpen, label: 'Results' },
  { href: '/parent/fees', icon: IndianRupee, label: 'Fees' },
  { href: '/parent/announcements', icon: Megaphone, label: 'More' },
]

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, school, activeChildId, setActiveChildId } = useAuthStore()
  const [children_, setChildren_] = useState<ParentChildData[]>([])
  const activeChild = children_.find(c => c.id === activeChildId) ?? children_[0] ?? null

  useEffect(() => {
    if (!user?.email || !school?.id) return
    getLinkedChildren(user.email, school.id).then(list => {
      setChildren_(list)
      if (!activeChildId && list.length > 0) setActiveChildId(list[0]?.id ?? null)
    })
  }, [user?.email, school?.id])

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a]">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0a0a0a]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0a0a0a]/80">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-600/10">
              <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 3.741-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
              </svg>
            </div>
            <span className="font-bold text-white tracking-tight text-base">EduNexus</span>
          </div>
          {children_.length > 1 && activeChild && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  {activeChild.fullName}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#111] border-white/10">
                {children_.map(c => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={() => setActiveChildId(c.id)}
                    className={cn(
                      'text-zinc-300 focus:bg-white/10 focus:text-white cursor-pointer',
                      c.id === activeChildId ? 'font-semibold text-blue-400' : ''
                    )}
                  >
                    {c.fullName} — {c.className}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06] bg-[#0a0a0a]/95 backdrop-blur">
        <div className="grid grid-cols-5 h-16">
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.href || pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href as any}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 text-[10px] transition-all duration-150',
                  isActive ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                <item.icon className={cn('h-5 w-5 transition-colors', isActive ? 'text-blue-400' : 'text-zinc-500')} />
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
