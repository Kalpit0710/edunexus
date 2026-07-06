'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { schoolToday } from '@/lib/date-utils'
import { getErrorMessage } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DateInput } from '@/components/ui/date-input'
import { InlineLoader } from '@/components/loaders/page-loaders'
import { DataLoadError } from '@/components/shared/DataLoadError'
import { CalendarCheck, CheckCheck, Save } from 'lucide-react'
import {
  getTeacherAttendanceContext,
  getSectionStudentsForAttendance,
  saveSectionAttendance,
  type AttendanceStatus,
  type StudentAttendanceRow,
} from './actions'

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; color: string }
> = {
  present: { label: 'P', color: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400' },
  absent: { label: 'A', color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400' },
  late: { label: 'L', color: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400' },
  half_day: { label: 'HD', color: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400' },
  holiday: { label: 'H', color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400' },
}

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'half_day', 'holiday']

export default function TeacherAttendancePage() {
  const { school } = useAuthStore()

  const [teacherFound, setTeacherFound] = useState(true)
  const [sections, setSections] = useState<Array<{ classId: string; className: string; sectionId: string; sectionName: string }>>([])
  const [selSection, setSelSection] = useState('')
  const [date, setDate] = useState(schoolToday())

  const [students, setStudents] = useState<StudentAttendanceRow[]>([])
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({})
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({})

  const [loading, setLoading] = useState(true)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadContext() {
      if (!school?.id) return
      setLoading(true)
      setError(null)
      try {
        const ctx = await getTeacherAttendanceContext(school.id)
        setTeacherFound(ctx.teacherFound)
        setSections(ctx.classTeacherSections)
        if (ctx.classTeacherSections[0]) {
          setSelSection(ctx.classTeacherSections[0].sectionId)
        }
      } catch (e) {
        setError(getErrorMessage(e))
      } finally {
        setLoading(false)
      }
    }

    loadContext()
  }, [school?.id])

  const selectedSection = useMemo(
    () => sections.find((s) => s.sectionId === selSection) ?? null,
    [sections, selSection],
  )

  async function loadAttendance() {
    if (!school?.id || !selSection || !date) {
      toast.error('Select class-section and date first.')
      return
    }

    setLoadingStudents(true)
    setLoaded(false)

    try {
      const rows = await getSectionStudentsForAttendance(school.id, selSection, date)
      setStudents(rows)

      const nextStatus: Record<string, AttendanceStatus> = {}
      const nextRemarks: Record<string, string> = {}
      rows.forEach((r) => {
        nextStatus[r.id] = r.attendance_status ?? 'present'
        nextRemarks[r.id] = r.remarks ?? ''
      })

      setStatusMap(nextStatus)
      setRemarksMap(nextRemarks)
      setLoaded(true)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setLoadingStudents(false)
    }
  }

  async function handleSave() {
    if (!school?.id || !selSection) return

    setSaving(true)
    try {
      await saveSectionAttendance(
        school.id,
        selSection,
        date,
        students.map((s) => ({
          student_id: s.id,
          status: statusMap[s.id] ?? 'present',
          remarks: remarksMap[s.id] || null,
        })),
      )
      toast.success(`Attendance saved for ${students.length} student${students.length !== 1 ? 's' : ''}.`)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  function markAll(status: AttendanceStatus) {
    const updated: Record<string, AttendanceStatus> = {}
    students.forEach((s) => {
      updated[s.id] = status
    })
    setStatusMap(updated)
  }

  const summary = STATUSES.map((s) => ({
    key: s,
    count: students.filter((st) => (statusMap[st.id] ?? 'present') === s).length,
  }))

  if (loading) return <InlineLoader label="Loading attendance..." />
  if (error) return <DataLoadError message={error} onRetry={() => window.location.reload()} />

  if (!teacherFound) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Your teacher profile isn’t set up yet. Ask your school admin to assign you to a class-section.
        </CardContent>
      </Card>
    )
  }

  if (sections.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          You have no class assigned yet. Ask your school admin to assign you as class teacher.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <CalendarCheck className="h-6 w-6 text-blue-500" /> Daily Attendance
        </h2>
        <p className="text-muted-foreground">Mark attendance for your class-teacher sections.</p>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base">Select Class & Date</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Class & Section</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={selSection}
                onChange={(e) => {
                  setSelSection(e.target.value)
                  setLoaded(false)
                }}
              >
                {sections.map((s) => (
                  <option key={s.sectionId} value={s.sectionId}>
                    {s.className} — {s.sectionName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <DateInput value={date} onChange={(e) => { setDate(e.target.value); setLoaded(false) }} />
            </div>

            <div className="flex items-end">
              <Button onClick={loadAttendance} disabled={loadingStudents || !selSection || !date} className="w-full">
                {loadingStudents ? 'Loading…' : 'Load Students'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loaded && (
        <>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div className="flex flex-wrap gap-2">
              {summary.map(({ key, count }) => (
                <div key={key} className={`text-xs px-2 py-1 rounded border font-medium ${STATUS_CONFIG[key].color}`}>
                  {STATUS_CONFIG[key].label}: {count}
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={() => markAll('present')}>
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark All Present
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {students.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No active students found in {selectedSection?.className} — {selectedSection?.sectionName}.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b text-xs text-muted-foreground uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium w-10">#</th>
                        <th className="px-4 py-3 text-left font-medium">Student</th>
                        <th className="px-4 py-3 text-left font-medium">Roll No</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-left font-medium">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {students.map((student, i) => {
                        const currentStatus = statusMap[student.id] ?? 'present'
                        return (
                          <tr key={student.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium">{student.full_name}</div>
                              <div className="text-xs text-muted-foreground">{student.admission_number}</div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{student.roll_number ?? '—'}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {STATUSES.map((s) => (
                                  <button
                                    key={s}
                                    onClick={() => setStatusMap((prev) => ({ ...prev, [student.id]: s }))}
                                    className={`text-xs px-2 py-0.5 rounded border font-medium transition-all ${
                                      currentStatus === s
                                        ? STATUS_CONFIG[s].color + ' ring-1 ring-offset-1 ring-current'
                                        : 'bg-muted/40 text-muted-foreground border-transparent hover:border-border'
                                    }`}
                                  >
                                    {STATUS_CONFIG[s].label}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Input
                                className="h-7 text-xs"
                                placeholder="Optional"
                                value={remarksMap[student.id] ?? ''}
                                onChange={(e) => setRemarksMap((prev) => ({ ...prev, [student.id]: e.target.value }))}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {students.length > 0 && (
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} size="lg">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving…' : 'Save Attendance'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
