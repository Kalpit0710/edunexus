'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState } from 'react'
import { getDashboardStats, getWeeklyCollectionTrend, type DashboardStats } from './actions'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import Link from 'next/link'
import {
  IndianRupee, CalendarCheck, Users, GraduationCap,
  BookOpen, Rocket, AlertCircle, TrendingUp
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
    { label: 'Total Students', value: stats.totalStudents, icon: Users, href: '/school-admin/students', color: 'text-blue-500' },
    { label: 'Active Teachers', value: stats.activeTeachers, icon: GraduationCap, href: '/school-admin/teachers', color: 'text-violet-500' },
    { label: 'Classes', value: stats.classCount, icon: BookOpen, href: '/school-admin/settings', color: 'text-amber-500' },
    { label: "Today's Collection", value: `₹${stats.todayCollection.toLocaleString('en-IN')}`, icon: IndianRupee, href: '/school-admin/fees/collect', color: 'text-emerald-500' },
    { label: "Today's Attendance", value: `${stats.todayAttendancePct}%`, icon: CalendarCheck, href: '/school-admin/attendance', color: 'text-sky-500' },
    { label: 'Pending Fees', value: `₹${stats.totalPendingFees.toLocaleString('en-IN')}`, icon: AlertCircle, href: '/school-admin/fees/pending', color: stats.totalPendingFees > 0 ? 'text-destructive' : 'text-muted-foreground' },
  ]

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome back 👋</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {school?.name} &nbsp;·&nbsp;&nbsp;
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <Link href={'/school-admin/reports' as any}>
            <Button variant="outline" className="gap-2">
              <TrendingUp className="h-4 w-4" /> View Reports
            </Button>
          </Link>
        </div>
      </div>

      {/* Onboarding banner */}
      {stats.needsOnboarding && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-base">
              <Rocket className="w-5 h-5" /> Let&apos;s Setup Your School
            </CardTitle>
            <p className="text-sm text-blue-600/80 dark:text-blue-400/80">
              Complete the guided setup to configure classes, academic years, and import students.
            </p>
          </CardHeader>
          <CardFooter>
            <Link href={'/school-admin/onboarding' as any}>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">Start Guided Setup</Button>
            </Link>
          </CardFooter>
        </Card>
      )}

      {/* Stats grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          : statCards.map(card => (
            <Link key={card.label} href={card.href as any}>
              <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
                  <card.icon className={`h-4 w-4 ${card.color} group-hover:scale-110 transition-transform`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{card.value}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
      </div>

      {/* Weekly collection chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            7-Day Fee Collection Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trendLoading ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={trend} margin={{ left: -10, right: 10 }}>
                <defs>
                  <linearGradient id="collectionGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v > 0 ? `₹${(v / 1000).toFixed(0)}k` : '₹0'} />
                <Tooltip formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Collected']} />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#collectionGrad)"
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div>
        <h2 className="text-base font-semibold mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href={'/school-admin/attendance' as any}>
            <Button variant="outline" className="gap-2"><CalendarCheck className="h-4 w-4" /> Mark Attendance</Button>
          </Link>
          <Link href={'/school-admin/fees/collect' as any}>
            <Button variant="outline" className="gap-2"><IndianRupee className="h-4 w-4" /> Collect Fee</Button>
          </Link>
          <Link href={'/school-admin/fees/pending' as any}>
            <Button variant="outline" className="gap-2"><AlertCircle className="h-4 w-4" /> Pending Fees</Button>
          </Link>
          <Link href={'/school-admin/students' as any}>
            <Button variant="outline" className="gap-2"><Users className="h-4 w-4" /> Manage Students</Button>
          </Link>
          <Link href={'/school-admin/teachers' as any}>
            <Button variant="outline" className="gap-2"><GraduationCap className="h-4 w-4" /> Manage Teachers</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
