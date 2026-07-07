'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { Route } from 'next'
import { useAuthStore } from '@/stores/auth.store'
import { createClient } from '@/lib/supabase/client'
import { getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { LayoutDashboard, LogOut, Briefcase, Package, ShoppingCart, Users, IndianRupee, ClockAlert, Bell, QrCode } from 'lucide-react'
import { toast } from 'sonner'

const navItems = [
    { href: '/manager/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/school-admin/students', label: 'Students', icon: Users },
    { href: '/school-admin/fees/collect', label: 'Collect Fee', icon: IndianRupee },
    { href: '/school-admin/fees/pending', label: 'Pending Fees', icon: ClockAlert },
    { href: '/manager/inventory', label: 'Inventory', icon: Package },
    { href: '/manager/inventory/pos', label: 'Point of Sale', icon: ShoppingCart },
    { href: '/manager/notifications', label: 'Notifications', icon: Bell },
    { href: '/manager/qr-scan', label: 'QR Scan', icon: QrCode },
]

export function ManagerSidebar() {
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

    const fullName = (user?.user_metadata?.full_name as string) || 'Manager'

    // Only the most specific matching nav item should be active. Otherwise a
    // parent route (e.g. /manager/inventory) also lights up on nested pages
    // (e.g. /manager/inventory/pos).
    const activeHref = navItems
        .filter(({ href }) => pathname === href || pathname.startsWith(href + '/'))
        .sort((a, b) => b.href.length - a.href.length)[0]?.href

    return (
        <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[#0a0a0a]">
            {/* School brand */}
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-600/10 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.2)]" aria-hidden="true">
                    <Briefcase className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-tight text-white">{school?.name ?? 'EduNexus'}</p>
                    <p className="text-xs text-zinc-500">Manager Portal</p>
                </div>
            </div>

            {/* Nav */}
            <nav aria-label="Manager navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5 scrollbar-hide">
                {navItems.map(({ href, label, icon: Icon }) => {
                    const active = href === activeHref
                    return (
                        <Link
                            key={href}
                            href={href as Route}
                            className={cn(
                                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                                active
                                    ? 'bg-white/10 text-white'
                                    : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                            )}
                            aria-current={active ? 'page' : undefined}
                        >
                            <Icon className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'text-blue-400' : 'text-zinc-500')} />
                            {label}
                            {active && (
                                <span aria-hidden="true" className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400" />
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
                        <p className="text-xs text-zinc-500">Manager</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        title="Sign out"
                        aria-label="Sign out"
                        className="text-zinc-500 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/10"
                    >
                        <LogOut className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
            </div>
        </aside>
    )
}
