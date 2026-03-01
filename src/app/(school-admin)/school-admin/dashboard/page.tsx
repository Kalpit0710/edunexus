'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState } from 'react'
import { getDashboardStats, type DashboardStats } from './actions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { IndianRupee, CalendarCheck, Users, GraduationCap, BookOpen, Rocket } from 'lucide-react'

export default function SchoolAdminDashboardPage() {
  const { school } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    activeTeachers: 0,
    classCount: 0,
    todayCollection: 0,
    needsOnboarding: false,
  })

  useEffect(() => {
    if (school?.id) {
      const today = new Date().toISOString().split('T')[0]!
      getDashboardStats(school.id, today)
        .then(setStats)
        .catch(e => console.error('Dashboard load error', e))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [school?.id])

  if (loading) {
    return <div className="p-8">Loading dashboard...</div>
  }

  const statCards = [
    { label: 'Total Students', value: stats.totalStudents, icon: Users, href: '/school-admin/students' },
    { label: 'Active Teachers', value: stats.activeTeachers, icon: GraduationCap, href: '/school-admin/teachers' },
    { label: 'Classes', value: stats.classCount, icon: BookOpen, href: '/school-admin/settings' },
    {
      label: "Today's Collection",
      value: `₹${stats.todayCollection.toLocaleString('en-IN')}`,
      icon: IndianRupee,
      href: '/school-admin/fees',
    },
  ]

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">School Admin Dashboard</h1>
        <p className="text-muted-foreground">
          {school?.name} · Overview for {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {stats.needsOnboarding && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-800 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <Rocket className="w-5 h-5" /> Let&apos;s Setup Your School
            </CardTitle>
            <CardDescription className="text-blue-600/80 dark:text-blue-400/80">
              Complete the guided setup to configure classes, academic years, and import students.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href={'/school-admin/onboarding' as any}>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">Start Guided Setup</Button>
            </Link>
          </CardFooter>
        </Card>
      )}

      {/* ── Stats grid ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map(card => (
          <Link key={card.label} href={card.href as any}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* ── Quick actions ── */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href={'/school-admin/attendance' as any}>
            <Button variant="outline"><CalendarCheck className="mr-2 h-4 w-4" /> Mark Attendance</Button>
          </Link>
          <Link href={'/school-admin/fees/collect' as any}>
            <Button variant="outline"><IndianRupee className="mr-2 h-4 w-4" /> Collect Fee</Button>
          </Link>
          <Link href={'/school-admin/students' as any}>
            <Button variant="outline"><Users className="mr-2 h-4 w-4" /> Manage Students</Button>
          </Link>
          <Link href={'/school-admin/teachers' as any}>
            <Button variant="outline"><GraduationCap className="mr-2 h-4 w-4" /> Manage Teachers</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

