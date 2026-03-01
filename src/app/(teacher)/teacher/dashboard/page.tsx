'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState } from 'react'
import { getTeacherDashboardData, type TeacherDashboardData } from './actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { CalendarCheck, BookOpen, Clock, Users } from 'lucide-react'

export default function TeacherDashboardPage() {
  const { user, school } = useAuthStore()
  const [stats, setStats] = useState<TeacherDashboardData>({ teacherId: null, assignments: [], pendingAttendance: [] })
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

  if (loading) return <div className="p-8">Loading dashboard...</div>


  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Teacher Dashboard</h1>
        <p className="text-muted-foreground">{today}</p>
      </div>

      {/* Pending attendance alert */}
      {stats.pendingAttendance.length > 0 && (
        <Card className="border-orange-300 bg-orange-50/50 dark:bg-orange-900/10 dark:border-orange-800">
          <CardHeader>
            <CardTitle className="text-base text-orange-700 dark:text-orange-300 flex items-center gap-2">
              <Clock className="h-4 w-4" /> Attendance Pending
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.pendingAttendance.map(sec => (
              <p key={sec} className="text-sm">
                {sec} — attendance not yet marked for today
              </p>
            ))}
            <Link href={'/school-admin/attendance' as any}>
              <Button size="sm" className="mt-2">
                <CalendarCheck className="mr-2 h-4 w-4" /> Mark Attendance
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.assignments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Class Teacher Of</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.assignments.filter(a => a.isClassTeacher).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Attendance</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingAttendance.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* My classes */}
      {stats.assignments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">My Classes</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.assignments.map((a, i) => (
              <Card key={i} className="relative">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{a.className} — {a.sectionName}</p>
                      <p className="text-sm text-muted-foreground">{a.subjectName}</p>
                    </div>
                    {a.isClassTeacher && (
                      <Badge variant="secondary" className="text-xs">Class Teacher</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
