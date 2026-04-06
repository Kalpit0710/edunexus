'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState } from 'react'
import { getTeacherDashboardData, type TeacherDashboardData } from './actions'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import {
  CalendarCheck, BookOpen, Clock, Users, GraduationCap, BarChart2, ArrowRight
} from 'lucide-react'

export default function TeacherDashboardPage() {
  const { user, school } = useAuthStore()
  const [stats, setStats] = useState<TeacherDashboardData>({
    teacherId: null, assignments: [], pendingAttendance: [], totalStudents: 0, todayAttendancePct: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (school?.id && user?.id) {
      getTeacherDashboardData(school.id, user.id)
        .then(setStats)
        .catch(e => console.error(e))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [school?.id, user?.id])

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  const fullName = (user?.user_metadata?.full_name as string) || 'Teacher'

  const statCards = [
    { label: 'Total Assignments', value: stats.assignments.length, icon: BookOpen, accent: '#3b82f6' },
    { label: 'Class Teacher Of', value: stats.assignments.filter(a => a.isClassTeacher).length, icon: Users, accent: '#8b5cf6' },
    { label: 'Students Taught', value: stats.totalStudents, icon: GraduationCap, accent: '#06b6d4' },
    {
      label: "Today's Attendance",
      value: stats.assignments.filter(a => a.isClassTeacher).length > 0
        ? `${stats.todayAttendancePct}%`
        : '—',
      icon: BarChart2,
      accent: stats.todayAttendancePct >= 80 ? '#10b981' : stats.todayAttendancePct > 0 ? '#f59e0b' : '#6b7280',
    },
    {
      label: 'Pending Attendance',
      value: stats.pendingAttendance.length,
      icon: CalendarCheck,
      accent: stats.pendingAttendance.length > 0 ? '#f59e0b' : '#10b981',
    },
  ]

  const quickActions = [
    { href: '/teacher/attendance', label: 'Mark Attendance', icon: CalendarCheck },
    { href: '/teacher/exams', label: 'View Exams', icon: BookOpen },
  ]

  if (loading) return (
    <div className="p-6 space-y-5">
      <Skeleton className="h-10 w-64 bg-white/5 rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-28 rounded-2xl bg-white/5" />)}
      </div>
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-violet-600/10 via-violet-500/5 to-transparent p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-600/10 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
              <span className="text-xs font-medium text-violet-300 uppercase tracking-wider">{today}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Welcome, {fullName} 👋</h1>
            <p className="text-sm text-zinc-400 mt-1">{school?.name}</p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-violet-500/25 bg-violet-600/15">
            <GraduationCap className="h-6 w-6 text-violet-400" />
          </div>
        </div>
      </div>

      {/* Pending attendance alert */}
      {stats.pendingAttendance.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15">
              <Clock className="h-5 w-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white">Attendance Pending</p>
              {stats.pendingAttendance.map(sec => (
                <p key={sec} className="text-sm text-zinc-400 mt-0.5">{sec} — not yet marked for today</p>
              ))}
            </div>
            <Link href={'/teacher/attendance' as any} className="shrink-0">
              <Button className="rounded-full bg-amber-500 text-[#0a0a0a] hover:bg-amber-400 text-sm font-semibold">
                <CalendarCheck className="mr-1.5 h-4 w-4" /> Mark Now
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Stats — 5 cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        {statCards.map(card => (
          <div
            key={card.label}
            className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5"
          >
            <div
              className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full blur-2xl opacity-20"
              style={{ backgroundColor: card.accent }}
            />
            <div className="relative">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{card.label}</p>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-xl border"
                  style={{ backgroundColor: `${card.accent}14`, borderColor: `${card.accent}30`, color: card.accent }}
                >
                  <card.icon className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* My classes */}
      {stats.assignments.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">My Classes</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.assignments.map((a, i) => (
              <div key={i} className="relative rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 hover:bg-white/[0.05] transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-white text-sm">{a.className} — {a.sectionName}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{a.subjectName}</p>
                  </div>
                  {a.isClassTeacher && (
                    <span className="inline-flex items-center rounded-full border border-violet-500/20 bg-violet-600/10 px-2 py-0.5 text-[10px] font-medium text-violet-300">
                      Class Teacher
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                <action.icon className="h-3.5 w-3.5 text-violet-400" />
                {action.label}
                <ArrowRight className="h-3 w-3 opacity-50" />
              </Button>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
