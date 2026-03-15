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
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 h-14">
          <span className="font-bold text-primary tracking-tight text-lg">EduNexus</span>
          {children_.length > 1 && activeChild && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 text-xs">
                  {activeChild.fullName}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {children_.map(c => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={() => setActiveChildId(c.id)}
                    className={c.id === activeChildId ? 'font-semibold text-primary' : ''}
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
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background">
        <div className="grid grid-cols-5 h-16">
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.href || pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href as any}
                className={`flex flex-col items-center justify-center gap-1 text-[10px] transition-colors
                  ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? 'stroke-primary' : ''}`} />
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
