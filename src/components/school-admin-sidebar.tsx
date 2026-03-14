'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { createClient } from '@/lib/supabase/client'
import { getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard,
    Users,
    GraduationCap,
    CalendarCheck,
    IndianRupee,
    Settings,
    LogOut,
    School,
    BarChart2,
    ClockAlert,
    History,
} from 'lucide-react'
import { toast } from 'sonner'

const navItems = [
    { href: '/school-admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/school-admin/students', label: 'Students', icon: Users },
    { href: '/school-admin/teachers', label: 'Teachers', icon: GraduationCap },
    { href: '/school-admin/attendance', label: 'Attendance', icon: CalendarCheck },
    { href: '/school-admin/fees', label: 'Fees & Billing', icon: IndianRupee },
    { href: '/school-admin/fees/pending', label: 'Pending Fees', icon: ClockAlert },
    { href: '/school-admin/fees/history', label: 'Payment History', icon: History },
    { href: '/school-admin/reports', label: 'Reports', icon: BarChart2 },
    { href: '/school-admin/settings', label: 'Settings', icon: Settings },
]

export function SchoolAdminSidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const { school, user, reset } = useAuthStore()

    async function handleLogout() {
        const supabase = createClient()
        await supabase.auth.signOut()
        reset()
        toast.success('Signed out successfully')
        router.push('/login')
        router.refresh()
    }

    const fullName = (user?.user_metadata?.full_name as string) || 'Admin'

    return (
        <aside className="flex h-screen w-64 shrink-0 flex-col border-r bg-background">
            {/* School brand */}
            <div className="flex items-center gap-3 border-b px-5 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                    <School className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-tight">{school?.name ?? 'EduNexus'}</p>
                    <p className="text-xs text-muted-foreground truncate">{school?.code ?? 'School Admin'}</p>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                {navItems.map(({ href, label, icon: Icon }) => {
                    const active = pathname === href || (href !== '/school-admin/dashboard' && pathname.startsWith(href))
                    return (
                        <Link
                            key={href}
                            href={href as any}
                            className={cn(
                                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                                active
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                        >
                            <Icon className="h-4 w-4 shrink-0" />
                            {label}
                        </Link>
                    )
                })}
            </nav>

            {/* User footer */}
            <div className="border-t px-3 py-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                        {getInitials(fullName)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{fullName}</p>
                        <p className="text-xs text-muted-foreground">School Admin</p>
                    </div>
                    <button onClick={handleLogout} title="Sign out" className="text-muted-foreground hover:text-destructive transition-colors">
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </aside>
    )
}
