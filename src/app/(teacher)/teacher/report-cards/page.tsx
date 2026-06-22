'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import {
  getReportSetup,
  getClassResultsOverview,
  type ReportSetup,
  type ClassResultRow,
} from '@/app/(school-admin)/school-admin/report-cards/actions'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { InlineLoader } from '@/components/loaders/page-loaders'
import { DataLoadError } from '@/components/shared/DataLoadError'
import { FileText, Pencil, Printer } from 'lucide-react'

export default function TeacherReportCardsPage() {
  const { school } = useAuthStore()
  const schoolId = school?.id ?? ''

  const [setup, setSetup] = useState<ReportSetup | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [classId, setClassId] = useState('')
  const [sectionId, setSectionId] = useState('')

  const load = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getReportSetup(schoolId)
      setSetup(data)
      const firstClass = data.classes[0]
      if (firstClass) setClassId((prev) => prev || firstClass.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load report cards.')
    } finally {
      setLoading(false)
    }
  }, [schoolId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <InlineLoader label="Loading report cards…" className="mt-20" />
  if (error) return <DataLoadError message={error} onRetry={load} />
  if (!setup) return null

  const selectedClass = setup.classes.find((c) => c.id === classId) ?? null

  return (
    <div className="space-y-5 max-w-5xl">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-600/10 text-blue-400">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Report Cards</h1>
          <p className="text-sm text-zinc-500">Enter term marks and print student report cards.</p>
        </div>
      </header>

      {setup.classes.length === 0 ? (
        <Card className="border-white/10 bg-white/[0.02] p-10 text-center text-sm text-zinc-500">
          No classes found.
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Class</Label>
              <Select
                value={classId}
                onValueChange={(v) => {
                  setClassId(v)
                  setSectionId('')
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {setup.classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedClass && selectedClass.sections.length > 0 && (
              <div className="space-y-1.5">
                <Label>Section</Label>
                <Select value={sectionId || '__all__'} onValueChange={(v) => setSectionId(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All sections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All sections</SelectItem>
                    {selectedClass.sections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {classId && <StudentsTable schoolId={schoolId} classId={classId} sectionId={sectionId} />}
        </>
      )}
    </div>
  )
}

function StudentsTable({
  schoolId,
  classId,
  sectionId,
}: {
  schoolId: string
  classId: string
  sectionId: string
}) {
  const [rows, setRows] = useState<ClassResultRow[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!schoolId || !classId) return
    setLoading(true)
    try {
      setRows(await getClassResultsOverview(schoolId, classId, sectionId || undefined))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load students.')
    } finally {
      setLoading(false)
    }
  }, [schoolId, classId, sectionId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <InlineLoader label="Loading students…" className="mt-10" />
  if (rows.length === 0) {
    return (
      <Card className="border-white/10 bg-white/[0.02] p-10 text-center text-sm text-zinc-500">
        No active students in this class.
      </Card>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-white/[0.03] text-left text-xs font-medium text-zinc-400">
            <th className="px-3 py-2.5">Rank</th>
            <th className="px-3 py-2.5">Roll</th>
            <th className="px-3 py-2.5">Student</th>
            <th className="px-3 py-2.5 text-right">Total</th>
            <th className="px-3 py-2.5 text-right">%</th>
            <th className="px-3 py-2.5">Grade</th>
            <th className="px-3 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.studentId} className="border-t border-white/[0.06] hover:bg-white/[0.02]">
              <td className="px-3 py-2.5 font-semibold text-zinc-300">#{r.rank}</td>
              <td className="px-3 py-2.5 text-zinc-400">{r.rollNumber ?? '—'}</td>
              <td className="px-3 py-2.5">
                <p className="font-medium text-white">{r.fullName}</p>
                <p className="text-xs text-zinc-500">{r.admissionNumber}</p>
              </td>
              <td className="px-3 py-2.5 text-right text-zinc-300">
                {r.totalObtained} / {r.totalMax}
              </td>
              <td className="px-3 py-2.5 text-right font-semibold text-white">{r.percentage}%</td>
              <td className="px-3 py-2.5">
                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-zinc-300">
                  {r.grade ?? '—'}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center justify-end gap-1.5">
                  <Link href={`/teacher/report-cards/${r.studentId}/marks` as never}>
                    <Button variant="outline" size="sm">
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Marks
                    </Button>
                  </Link>
                  <Link href={`/report-card/${r.studentId}/print` as never} target="_blank">
                    <Button variant="ghost" size="sm">
                      <Printer className="mr-1 h-3.5 w-3.5" /> Print
                    </Button>
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
