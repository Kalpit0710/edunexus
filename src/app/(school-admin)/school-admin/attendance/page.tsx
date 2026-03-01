'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import {
  getStudentsForAttendance,
  saveAttendance,
  type AttendanceStatus,
  type StudentAttendanceRow,
} from './actions'
import { getClasses, getSections } from '../settings/actions'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { BarChart2, CheckCheck, Save } from 'lucide-react'
import Link from 'next/link'

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; color: string }
> = {
  present:  { label: 'P',  color: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400' },
  absent:   { label: 'A',  color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400' },
  late:     { label: 'L',  color: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400' },
  half_day: { label: 'HD', color: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400' },
  holiday:  { label: 'H',  color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400' },
}

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'half_day', 'holiday']

export default function AttendancePage() {
  const { school, user } = useAuthStore()
  const [classes, setClasses] = useState<any[]>([])
  const [sections, setSections] = useState<any[]>([])
  const [selClass, setSelClass] = useState('')
  const [selSection, setSelSection] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0] ?? '')

  const [students, setStudents] = useState<StudentAttendanceRow[]>([])
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({})
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({})
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Load classes/sections once
  useEffect(() => {
    if (!school?.id) return
    Promise.all([getClasses(school.id), getSections(school.id)])
      .then(([cls, sec]) => { setClasses(cls); setSections(sec) })
      .catch((e: any) => toast.error(e.message))
  }, [school?.id])

  const filteredSections = sections.filter((s) => s.class_id === selClass)

  async function loadAttendance() {
    if (!school?.id || !selClass || !selSection || !date) {
      toast.error('Select class, section, and date first.')
      return
    }
    setLoadingStudents(true)
    setLoaded(false)
    try {
      const rows = await getStudentsForAttendance(school.id, selClass, selSection, date)
      setStudents(rows)
      // Pre-fill existing status
      const sm: Record<string, AttendanceStatus> = {}
      const rm: Record<string, string> = {}
      rows.forEach((r) => {
        sm[r.id] = r.attendance_status ?? 'present'
        rm[r.id] = r.remarks ?? ''
      })
      setStatusMap(sm)
      setRemarksMap(rm)
      setLoaded(true)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoadingStudents(false)
    }
  }

  function markAll(status: AttendanceStatus) {
    const updated: Record<string, AttendanceStatus> = {}
    students.forEach((s) => { updated[s.id] = status })
    setStatusMap(updated)
  }

  async function handleSave() {
    if (!school?.id || !user) return
    setSaving(true)
    try {
      const records = students.map((s) => ({
        student_id: s.id,
        status: statusMap[s.id] ?? 'present',
        remarks: remarksMap[s.id] || null,
      }))
      await saveAttendance(
        school.id, selClass, selSection, date,
        user.id, records
      )
      toast.success(`Attendance saved for ${students.length} student${students.length !== 1 ? 's' : ''}.`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Summary counts
  const summary = STATUSES.map((s) => ({
    key: s,
    count: students.filter((st) => (statusMap[st.id] ?? 'present') === s).length,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Daily Attendance</h2>
          <p className="text-muted-foreground">Mark and review student attendance.</p>
        </div>
        <Link href={'/school-admin/attendance/report' as any}>
          <Button variant="outline">
            <BarChart2 className="h-4 w-4 mr-2" />
            Monthly Report
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base">Select Class & Date</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Class</Label>
              <Select value={selClass} onValueChange={(v) => { setSelClass(v); setSelSection(''); setLoaded(false) }}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Section</Label>
              <Select value={selSection} onValueChange={(v) => { setSelSection(v); setLoaded(false) }} disabled={!selClass}>
                <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                <SelectContent>
                  {filteredSections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setLoaded(false) }} />
            </div>

            <div className="flex items-end">
              <Button
                onClick={loadAttendance}
                disabled={loadingStudents || !selClass || !selSection || !date}
                className="w-full"
              >
                {loadingStudents ? 'Loading…' : 'Load Students'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Grid */}
      {loaded && (
        <>
          {/* Summary + bulk actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div className="flex flex-wrap gap-2">
              {summary.map(({ key, count }) => (
                <div key={key} className={`text-xs px-2 py-1 rounded border font-medium ${STATUS_CONFIG[key]?.color}`}>
                  {STATUS_CONFIG[key]?.label}: {count}
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
                  No active students found in this section.
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
                              <div className="font-medium">
                                {student.full_name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {student.admission_number}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {student.roll_number ?? '—'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {STATUSES.map((s) => (
                                  <button
                                    key={s}
                                    onClick={() =>
                                      setStatusMap((prev) => ({ ...prev, [student.id]: s }))
                                    }
                                    className={`text-xs px-2 py-0.5 rounded border font-medium transition-all ${
                                      currentStatus === s
                                        ? STATUS_CONFIG[s]?.color + ' ring-1 ring-offset-1 ring-current'
                                        : 'bg-muted/40 text-muted-foreground border-transparent hover:border-border'
                                    }`}
                                  >
                                    {STATUS_CONFIG[s]?.label}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Input
                                className="h-7 text-xs"
                                placeholder="Optional"
                                value={remarksMap[student.id] ?? ''}
                                onChange={(e) =>
                                  setRemarksMap((prev) => ({
                                    ...prev,
                                    [student.id]: e.target.value,
                                  }))
                                }
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
