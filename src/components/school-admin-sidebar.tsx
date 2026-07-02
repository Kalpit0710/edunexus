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
    BookOpen,
    Lock,
    ArrowUpCircle,
    CalendarRange,
    CalendarDays,
    BookMarked,
    Bus,
    Package,
    ShoppingCart,
} from 'lucide-react'
import { toast } from 'sonner'
import { usePlan } from '@/hooks/use-plan'
import { type Feature } from '@/lib/plan-features'

const navItems: { href: string; label: string; icon: typeof LayoutDashboard; feature: Feature }[] = [
    { href: '/school-admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, feature: 'dashboard' },
    { href: '/school-admin/students', label: 'Students', icon: Users, feature: 'students' },
    { href: '/school-admin/teachers', label: 'Teachers', icon: GraduationCap, feature: 'teachers' },
    { href: '/school-admin/timetable', label: 'Timetable', icon: CalendarRange, feature: 'teachers' },
    { href: '/school-admin/attendance', label: 'Attendance', icon: CalendarCheck, feature: 'attendance' },
    { href: '/school-admin/calendar', label: 'Calendar', icon: CalendarDays, feature: 'attendance' },
    { href: '/school-admin/report-cards', label: 'Report Cards', icon: BookOpen, feature: 'exams' },
    { href: '/school-admin/fees', label: 'Fees & Billing', icon: IndianRupee, feature: 'fees' },
    { href: '/school-admin/fees/pending', label: 'Pending Fees', icon: ClockAlert, feature: 'fees' },
    { href: '/school-admin/fees/history', label: 'Payment History', icon: History, feature: 'fees' },
    { href: '/school-admin/library', label: 'Library', icon: BookMarked, feature: 'inventory' },
    { href: '/manager/inventory', label: 'Inventory', icon: Package, feature: 'inventory' },
    { href: '/manager/inventory/pos', label: 'Bookstore POS', icon: ShoppingCart, feature: 'inventory' },
    { href: '/school-admin/transport', label: 'Transport', icon: Bus, feature: 'students' },
    { href: '/school-admin/reports', label: 'Reports', icon: BarChart2, feature: 'reports' },
    { href: '/school-admin/promotion', label: 'Promotion', icon: ArrowUpCircle, feature: 'students' },
    { href: '/school-admin/settings', label: 'Settings', icon: Settings, feature: 'settings' },
]

export function SchoolAdminSidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const { school, user, reset } = useAuthStore()
    const { hasFeature } = usePlan()

    async function handleLogout() {
        const supabase = createClient()
        await supabase.auth.signOut()
        reset()
        toast.success('Signed out successfully')
        router.push('/login')
        router.refresh()
    }

    const fullName = (user?.user_metadata?.full_name as string) || 'Admin'

    // Only the most specific matching nav item should be active. Otherwise a
    // parent route (e.g. /school-admin/fees) also lights up on nested pages
    // (e.g. /school-admin/fees/history or /school-admin/fees/pending).
    const activeHref = navItems
        .filter(({ href }) => pathname === href || pathname.startsWith(href + '/'))
        .sort((a, b) => b.href.length - a.href.length)[0]?.href

    return (
        <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[#0a0a0a]">
            {/* School brand */}
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-600/10 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.2)]">
                    <School className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-tight text-white">{school?.name ?? 'EduNexus'}</p>
                    <p className="text-xs text-zinc-500 truncate">{school?.code ?? 'School Admin'}</p>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5 scrollbar-hide">
                {navItems.map(({ href, label, icon: Icon, feature }) => {
                    const unlocked = hasFeature(feature)

                    if (!unlocked) {
                        return (
                            <Link
                                key={href}
                                href={`/school-admin/upgrade?feature=${feature}` as any}
                                title={`${label} is not included in your plan — upgrade to unlock`}
                                className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-600 transition-all duration-150 hover:bg-white/5 hover:text-zinc-400"
                            >
                                <Icon className="h-4 w-4 shrink-0 text-zinc-700 group-hover:text-zinc-500" />
                                <span className="truncate">{label}</span>
                                <Lock className="ml-auto h-3.5 w-3.5 shrink-0 text-zinc-700 group-hover:text-amber-400" />
                            </Link>
                        )
                    }

                    const active = href === activeHref
                    return (
                        <Link
                            key={href}
                            href={href as any}
                            className={cn(
                                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                                active
                                    ? 'bg-white/10 text-white'
                                    : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                            )}
                        >
                            <Icon className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'text-blue-400' : 'text-zinc-500')} />
                            {label}
                            {active && (
                                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400" />
                            )}
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
                        <p className="text-xs text-zinc-500">School Admin</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        title="Sign out"
                        className="text-zinc-500 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/10"
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </aside>
    )
}
