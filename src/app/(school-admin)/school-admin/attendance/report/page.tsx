'use client'

import { useState } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { getMonthlyAttendanceReport, type MonthlyAttendanceRow } from '../actions'
import { getClasses, getSections } from '../../settings/actions'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Download } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function pctColor(pct: number): string {
  if (pct >= 85) return 'text-green-600 font-semibold'
  if (pct >= 75) return 'text-yellow-600 font-semibold'
  return 'text-red-600 font-semibold'
}

export default function AttendanceReportPage() {
  const { school } = useAuthStore()
  const now = new Date()

  const [classes, setClasses] = useState<any[]>([])
  const [sections, setSections] = useState<any[]>([])
  const [selClass, setSelClass] = useState('')
  const [selSection, setSelSection] = useState('')
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const [year, setYear] = useState(String(now.getFullYear()))

  const [report, setReport] = useState<MonthlyAttendanceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!school?.id) return
    Promise.all([getClasses(school.id), getSections(school.id)])
      .then(([cls, sec]) => { setClasses(cls); setSections(sec) })
      .catch((e: any) => toast.error(e.message))
  }, [school?.id])

  const filteredSections = sections.filter((s) => s.class_id === selClass)

  async function loadReport() {
    if (!school?.id || !selClass || !selSection) {
      toast.error('Select class and section.')
      return
    }
    setLoading(true)
    setLoaded(false)
    try {
      const data = await getMonthlyAttendanceReport(
        school.id, selClass, selSection,
        Number(year), Number(month)
      )
      setReport(data)
      setLoaded(true)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handleExportCSV() {
    if (report.length === 0) return
    const header = 'Name,Admission No,Present,Absent,Late,Half Day,Total Days,% Attendance'
    const rows = report.map((r) =>
      `"${r.student_name}",${r.admission_number},${r.present},${r.absent},${r.late},${r.half_day},${r.total_school_days},${r.percentage}%`
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance_report_${MONTHS[Number(month) - 1]}_${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const avgPct = report.length > 0
    ? Math.round(report.reduce((s, r) => s + r.percentage, 0) / report.length)
    : 0

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href={'/school-admin/attendance' as any}>
        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Daily Attendance
        </Button>
      </Link>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Monthly Attendance Report</h2>
          <p className="text-muted-foreground">Per-student summary for a class section.</p>
        </div>
        {loaded && report.length > 0 && (
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base">Report Filters</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Class</Label>
              <Select value={selClass} onValueChange={(v) => { setSelClass(v); setSelSection(''); setLoaded(false) }}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Section</Label>
              <Select value={selSection} onValueChange={(v) => { setSelSection(v); setLoaded(false) }} disabled={!selClass}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {filteredSections.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Month</Label>
              <Select value={month} onValueChange={(v) => { setMonth(v); setLoaded(false) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Year</Label>
              <Select value={year} onValueChange={(v) => { setYear(v); setLoaded(false) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={loadReport}
                disabled={loading || !selClass || !selSection}
                className="w-full"
              >
                {loading ? 'Loading…' : 'Generate'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Table */}
      {loaded && (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Students</p>
                <p className="text-2xl font-bold">{report.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">School Days</p>
                <p className="text-2xl font-bold">{report[0]?.total_school_days ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Avg. Attendance</p>
                <p className={`text-2xl font-bold ${pctColor(avgPct)}`}>{avgPct}%</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              {report.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No attendance data for the selected period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b text-xs text-muted-foreground uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Student</th>
                        <th className="px-4 py-3 text-center font-medium">P</th>
                        <th className="px-4 py-3 text-center font-medium">A</th>
                        <th className="px-4 py-3 text-center font-medium">L</th>
                        <th className="px-4 py-3 text-center font-medium">HD</th>
                        <th className="px-4 py-3 text-center font-medium">Days</th>
                        <th className="px-4 py-3 text-right font-medium">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {report
                        .slice()
                        .sort((a, b) => b.percentage - a.percentage)
                        .map((row) => (
                          <tr key={row.student_id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium">{row.student_name}</div>
                              <div className="text-xs text-muted-foreground">{row.admission_number}</div>
                            </td>
                            <td className="px-4 py-3 text-center text-green-700 font-medium">{row.present}</td>
                            <td className="px-4 py-3 text-center text-red-700 font-medium">{row.absent}</td>
                            <td className="px-4 py-3 text-center text-yellow-700 font-medium">{row.late}</td>
                            <td className="px-4 py-3 text-center text-orange-700 font-medium">{row.half_day}</td>
                            <td className="px-4 py-3 text-center text-muted-foreground">{row.total_school_days}</td>
                            <td className={`px-4 py-3 text-right ${pctColor(row.percentage)}`}>
                              {row.percentage}%
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
