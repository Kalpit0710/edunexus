'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState } from 'react'
import { getDashboardStats, getWeeklyCollectionTrend, type DashboardStats } from './actions'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import Link from 'next/link'
import {
  IndianRupee, CalendarCheck, Users, GraduationCap,
  BookOpen, Rocket, AlertCircle, TrendingUp, ArrowRight
} from 'lucide-react'

export default function SchoolAdminDashboardPage() {
  const { school } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [trendLoading, setTrendLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0, activeTeachers: 0, classCount: 0,
    todayCollection: 0, totalPendingFees: 0, todayAttendancePct: 0, needsOnboarding: false,
  })
  const [trend, setTrend] = useState<{ date: string; label: string; amount: number }[]>([])

  useEffect(() => {
    if (!school?.id) return
    const today = new Date().toISOString().split('T')[0]!
    getDashboardStats(school.id, today)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false))
    getWeeklyCollectionTrend(school.id)
      .then(setTrend)
      .catch(console.error)
      .finally(() => setTrendLoading(false))
  }, [school?.id])

  const statCards = [
    { label: 'Total Students', value: stats.totalStudents, icon: Users, href: '/school-admin/students', accent: '#3b82f6' },
    { label: 'Active Teachers', value: stats.activeTeachers, icon: GraduationCap, href: '/school-admin/teachers', accent: '#8b5cf6' },
    { label: 'Classes', value: stats.classCount, icon: BookOpen, href: '/school-admin/settings', accent: '#f59e0b' },
    { label: "Today's Collection", value: `₹${stats.todayCollection.toLocaleString('en-IN')}`, icon: IndianRupee, href: '/school-admin/fees/collect', accent: '#10b981' },
    { label: "Today's Attendance", value: `${stats.todayAttendancePct}%`, icon: CalendarCheck, href: '/school-admin/attendance', accent: '#06b6d4' },
    { label: 'Pending Fees', value: `₹${stats.totalPendingFees.toLocaleString('en-IN')}`, icon: AlertCircle, href: '/school-admin/fees/pending', accent: stats.totalPendingFees > 0 ? '#ef4444' : '#6b7280' },
  ]

  const quickActions = [
    { href: '/school-admin/attendance', label: 'Mark Attendance', icon: CalendarCheck },
    { href: '/school-admin/fees/collect', label: 'Collect Fee', icon: IndianRupee },
    { href: '/school-admin/fees/pending', label: 'Pending Fees', icon: AlertCircle },
    { href: '/school-admin/students', label: 'Manage Students', icon: Users },
    { href: '/school-admin/teachers', label: 'Manage Teachers', icon: GraduationCap },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-blue-600/10 via-blue-500/5 to-transparent p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-600/10 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs font-medium text-blue-300 uppercase tracking-wider">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Welcome back 👋
            </h1>
            <p className="text-sm text-zinc-400 mt-1">{school?.name ?? 'Your school'}</p>
          </div>
          <Link href={'/school-admin/reports' as any}>
            <Button
              variant="outline"
              className="gap-2 rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20 transition-all"
            >
              <TrendingUp className="h-4 w-4 text-blue-400" />
              View Reports
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Onboarding banner */}
      {stats.needsOnboarding && (
        <div className="rounded-2xl border border-blue-500/20 bg-blue-600/8 p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-600/15">
              <Rocket className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white">Let&apos;s Setup Your School</p>
              <p className="text-sm text-zinc-400 mt-0.5">
                Complete the guided setup to configure classes, academic years, and import students.
              </p>
            </div>
            <Link href={'/school-admin/onboarding' as any} className="shrink-0">
              <Button className="rounded-full bg-blue-600 text-white hover:bg-blue-500 text-sm shadow-lg shadow-blue-600/20">
                Start Setup
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl bg-white/5" />)
          : statCards.map(card => (
            <Link key={card.label} href={card.href as any}>
              <div className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200 cursor-pointer hover:-translate-y-0.5">
                <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full blur-2xl opacity-20 transition-opacity group-hover:opacity-40"
                  style={{ backgroundColor: card.accent }} />
                <div className="relative">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{card.label}</p>
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-xl border"
                      style={{
                        backgroundColor: `${card.accent}14`,
                        borderColor: `${card.accent}30`,
                        color: card.accent,
                      }}
                    >
                      <card.icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-white">{card.value}</p>
                </div>
              </div>
            </Link>
          ))}
      </div>

      {/* Weekly collection chart */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Fee Collection Trend</p>
            <p className="text-xs text-zinc-500">Last 7 days</p>
          </div>
        </div>
        {trendLoading ? (
          <Skeleton className="h-48 w-full rounded-xl bg-white/5" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trend} margin={{ left: -10, right: 10 }}>
              <defs>
                <linearGradient id="collectionGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} tickFormatter={v => v > 0 ? `₹${(v / 1000).toFixed(0)}k` : '₹0'} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '13px',
                }}
                formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Collected']}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#collectionGrad)"
                dot={{ fill: '#3b82f6', strokeWidth: 0, r: 3 }}
                activeDot={{ fill: '#3b82f6', r: 4, strokeWidth: 2, stroke: 'rgba(59,130,246,0.3)' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Quick Actions</p>
        <div className="flex flex-wrap gap-2">
          {quickActions.map(action => (
            <Link key={action.href} href={action.href as any}>
              <Button
                variant="outline"
                className="gap-2 rounded-full border-white/[0.08] bg-white/[0.04] text-zinc-300 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.14] transition-all text-sm"
              >
                <action.icon className="h-3.5 w-3.5 text-blue-400" />
                {action.label}
              </Button>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
