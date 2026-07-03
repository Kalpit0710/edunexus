'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, CalendarCheck, BookOpen, BookText, CalendarRange, IndianRupee, Megaphone, ChevronDown, LogOut } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { useAuthStore } from '@/stores/auth.store'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
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
  { href: '/parent/today', icon: Home, label: 'Today' },
  { href: '/parent/attendance', icon: CalendarCheck, label: 'Attendance' },
  { href: '/parent/timetable', icon: CalendarRange, label: 'Timetable' },
  { href: '/parent/homework', icon: BookText, label: 'Homework' },
  { href: '/parent/results', icon: BookOpen, label: 'Results' },
  { href: '/parent/fees', icon: IndianRupee, label: 'Fees' },
  { href: '/parent/announcements', icon: Megaphone, label: 'More' },
]

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, school, activeChildId, setActiveChildId, reset } = useAuthStore()
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
      // Read the latest activeChildId imperatively so switching children does not
      // re-trigger this fetch (and so the dep array stays honest).
      if (!useAuthStore.getState().activeChildId && list.length > 0) {
        setActiveChildId(list[0]?.id ?? null)
      }
    })
  }, [user?.email, school?.id, setActiveChildId])

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a]">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0a0a0a]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0a0a0a]/80">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <BrandLogo size={28} className="h-7 w-7" priority />
            <span className="font-bold text-white tracking-tight text-base">EduNexus</span>
          </div>
          <div className="flex items-center gap-2">
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              title="Sign out"
              className="gap-1.5 text-xs rounded-full border-white/10 bg-white/5 text-zinc-300 hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06] bg-[#0a0a0a]/95 backdrop-blur">
        <div className="grid grid-cols-7 h-16">
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
