'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { getTeachers, toggleTeacherStatus, type TeacherRow } from './actions'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { UserPlus, Search, Edit, Eye, Power } from 'lucide-react'
import Link from 'next/link'
import { getInitials } from '@/lib/utils'

type StatusFilter = 'all' | 'active' | 'inactive'

export default function TeachersPage() {
  const { school } = useAuthStore()
  const [teachers, setTeachers] = useState<TeacherRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    if (school?.id) fetchTeachers()
  }, [school?.id])

  async function fetchTeachers() {
    if (!school?.id) return
    setLoading(true)
    try {
      const data = await getTeachers(school.id)
      setTeachers(data)
    } catch (e: any) {
      toast.error('Failed to load teachers: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleStatus(teacher: TeacherRow) {
    const nextState = !teacher.is_active
    const label = nextState ? 'activated' : 'deactivated'
    try {
      await toggleTeacherStatus(
        teacher.id,
        teacher.user_profile!.id,
        nextState
      )
      toast.success(`Teacher ${label}`)
      fetchTeachers()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const filtered = teachers.filter((t) => {
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && t.is_active) ||
      (statusFilter === 'inactive' && !t.is_active)

    if (!matchStatus) return false

    if (!search) return true
    const term = search.toLowerCase()
    const name = t.user_profile?.full_name?.toLowerCase() ?? ''
    const email = t.user_profile?.email?.toLowerCase() ?? ''
    const empId = t.employee_id?.toLowerCase() ?? ''
    const spec = t.specialization?.toLowerCase() ?? ''
    return (
      name.includes(term) ||
      email.includes(term) ||
      empId.includes(term) ||
      spec.includes(term)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Teacher Directory</h2>
          <p className="text-muted-foreground">
            Manage teachers, assign classes, and control portal access.
          </p>
        </div>
        <Link href={'/school-admin/teachers/new' as any}>
          <Button>
            <UserPlus className="w-4 h-4 mr-2" />
            Add Teacher
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Search */}
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search by name, email, employee ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 border-0 shadow-none focus-visible:ring-0 px-0 rounded-none bg-transparent"
              />
            </div>
            {/* Status filter pills */}
            <div className="flex gap-2">
              {(['all', 'active', 'inactive'] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors capitalize ${
                    statusFilter === s
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-muted-foreground border-transparent hover:border-border'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading teachers...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {search || statusFilter !== 'all'
                ? 'No teachers match your filters.'
                : 'No teachers yet. Add your first teacher to get started.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-6 py-3 font-medium">Teacher</th>
                    <th className="px-6 py-3 font-medium">Employee ID</th>
                    <th className="px-6 py-3 font-medium">Specialization</th>
                    <th className="px-6 py-3 font-medium">Joined</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((teacher) => (
                    <tr key={teacher.id} className="hover:bg-muted/30 transition-colors">
                      {/* Teacher info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
                            {getInitials(teacher.user_profile?.full_name ?? '?')}
                          </div>
                          <div>
                            <Link href={`/school-admin/teachers/${teacher.id}` as any}>
                              <p className="font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                                {teacher.user_profile?.full_name ?? '—'}
                              </p>
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {teacher.user_profile?.email ?? ''}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-muted-foreground">
                        {teacher.employee_id ?? '—'}
                      </td>

                      <td className="px-6 py-4">{teacher.specialization ?? '—'}</td>

                      <td className="px-6 py-4 text-muted-foreground">
                        {teacher.join_date
                          ? new Date(teacher.join_date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>

                      <td className="px-6 py-4">
                        <Badge variant={teacher.is_active ? 'default' : 'secondary'}>
                          {teacher.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>

                      <td className="px-6 py-4 text-right space-x-1">
                        <Link href={`/school-admin/teachers/${teacher.id}` as any}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            title="View profile"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/school-admin/teachers/${teacher.id}/edit` as any}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleStatus(teacher)}
                          className={`h-8 w-8 ${
                            teacher.is_active
                              ? 'text-muted-foreground hover:text-red-500'
                              : 'text-muted-foreground hover:text-green-600'
                          }`}
                          title={teacher.is_active ? 'Deactivate' : 'Activate'}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {!loading && (
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {teachers.length} teacher
          {teachers.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
