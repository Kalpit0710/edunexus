'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, CheckCircle2, PauseCircle, Clock, Users, GraduationCap, IndianRupee, ArrowRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { getPlatformStats, type PlatformStats } from '../actions'
import { PLAN_LABEL, STATUS_LABEL, formatInr } from '@/lib/subscription'
import { getErrorMessage } from '@/lib/utils'
import { toast } from 'sonner'

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-500/15 text-green-400 border-green-500/20',
  trial: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  suspended: 'bg-red-500/15 text-red-400 border-red-500/20',
}

export default function SuperAdminDashboardPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPlatformStats()
      .then(setStats)
      .catch((e) => toast.error('Failed to load platform stats: ' + getErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  const statCards = stats
    ? [
        { label: 'Total Schools', value: stats.totalSchools, icon: Building2, accent: 'text-blue-400' },
        { label: 'Active', value: stats.activeSchools, icon: CheckCircle2, accent: 'text-green-400' },
        { label: 'Trial', value: stats.trialSchools, icon: Clock, accent: 'text-amber-400' },
        { label: 'Suspended', value: stats.suspendedSchools, icon: PauseCircle, accent: 'text-red-400' },
        { label: 'Total Students', value: stats.totalStudents, icon: GraduationCap, accent: 'text-violet-400' },
        { label: 'Total Users', value: stats.totalUsers, icon: Users, accent: 'text-cyan-400' },
      ]
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Platform Overview</p>
          <h1 className="text-2xl font-bold tracking-tight text-white">Super Admin Dashboard 🛡️</h1>
          <p className="text-sm text-muted-foreground">Manage all schools and subscriptions across EduNexus.</p>
        </div>
        <Link
          href="/super-admin/schools"
          className="inline-flex h-10 items-center gap-2 self-start rounded-full bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-500"
        >
          Manage Schools <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Monthly revenue highlight */}
      <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-br from-blue-600/10 to-transparent p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-600/10 text-blue-400">
            <IndianRupee className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Monthly Recurring Revenue</p>
            {loading || !stats ? (
              <Skeleton className="mt-1 h-8 w-40 bg-white/5" />
            ) : (
              <p className="text-3xl font-bold text-white">{formatInr(stats.monthlyRevenue)}</p>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-500">From schools on an active subscription. Trial &amp; suspended excluded.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl bg-white/5" />
            ))
          : statCards.map(({ label, value, icon: Icon, accent }) => (
              <div key={label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <Icon className={`h-5 w-5 ${accent}`} />
                </div>
                <p className="mt-3 text-3xl font-bold text-white">{value}</p>
              </div>
            ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Plan breakdown */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-sm font-semibold text-white">Subscription Plans</p>
          {loading || !stats ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded-lg bg-white/5" />
              ))}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {stats.planBreakdown.map(({ plan, count }) => (
                <div key={plan} className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300">{PLAN_LABEL[plan]}</span>
                  <span className="text-sm font-semibold text-white">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent sign-ups */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-sm font-semibold text-white">Recent Sign-ups</p>
          {loading || !stats ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg bg-white/5" />
              ))}
            </div>
          ) : stats.recentSchools.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No schools onboarded yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {stats.recentSchools.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/super-admin/schools/${s.id}` as never}
                    className="flex items-center justify-between rounded-xl px-3 py-2 transition-colors hover:bg-white/5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{s.name}</p>
                      <p className="text-xs text-zinc-500">{s.code} · {PLAN_LABEL[s.subscription_plan]}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${STATUS_BADGE[s.subscription_status]}`}>
                      {STATUS_LABEL[s.subscription_status]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
