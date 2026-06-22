'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { getMyTimetable, type MyTimetable } from './actions'
import { WEEKDAYS, formatPeriodRange } from '@/lib/timetable-utils'
import { InlineLoader } from '@/components/loaders/page-loaders'
import { DataLoadError } from '@/components/shared/DataLoadError'
import { CalendarRange } from 'lucide-react'

export default function TeacherTimetablePage() {
  const { school } = useAuthStore()
  const schoolId = school?.id ?? ''
  const [data, setData] = useState<MyTimetable | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    setError(null)
    try {
      setData(await getMyTimetable(schoolId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your timetable.')
    } finally {
      setLoading(false)
    }
  }, [schoolId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <InlineLoader label="Loading your timetable…" className="mt-20" />
  if (error) return <DataLoadError message={error} onRetry={load} />
  if (!data) return null

  const WORKING = WEEKDAYS.filter((w) => data.workingDays.includes(w.value))

  const cellAt = (dayOfWeek: number, periodId: string) =>
    data.entries.find((e) => e.dayOfWeek === dayOfWeek && e.periodId === periodId)

  return (
    <div className="px-6 py-6 space-y-5 max-w-5xl">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-600/10 text-blue-400">
          <CalendarRange className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">My Timetable</h1>
          <p className="text-sm text-zinc-500">Your weekly teaching schedule.</p>
        </div>
      </header>

      {!data.teacherFound ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] py-12 text-center text-sm text-zinc-500">
          Your teacher profile isn’t linked yet. Please contact your school admin.
        </div>
      ) : data.periods.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] py-12 text-center text-sm text-zinc-500">
          No timetable has been published yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-white/[0.03]">
                <th className="sticky left-0 z-10 bg-[#0a0a0a] px-3 py-2 text-left text-xs font-medium text-zinc-400">
                  Period
                </th>
                {WORKING.map((d) => (
                  <th key={d.value} className="px-3 py-2 text-left text-xs font-medium text-zinc-400">
                    {d.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.periods.map((p) => (
                <tr key={p.id} className="border-t border-white/[0.06]">
                  <td className="sticky left-0 z-10 bg-[#0a0a0a] px-3 py-2 align-top">
                    <p className="font-medium text-white">{p.name}</p>
                    <p className="text-xs text-zinc-500">{formatPeriodRange(p.startTime, p.endTime)}</p>
                  </td>
                  {WORKING.map((d) => {
                    if (p.isBreak) {
                      return (
                        <td key={d.value} className="px-2 py-1.5">
                          <div className="rounded-md bg-amber-500/[0.06] px-2 py-2 text-center text-xs text-amber-400/70">
                            Break
                          </div>
                        </td>
                      )
                    }
                    const cell = cellAt(d.value, p.id)
                    return (
                      <td key={d.value} className="px-2 py-1.5">
                        {cell ? (
                          <div className="rounded-md border border-white/5 bg-white/[0.02] px-2 py-2">
                            <p className="truncate text-xs font-medium text-white">{cell.sectionLabel}</p>
                            <p className="truncate text-[11px] text-zinc-500">
                              {cell.subjectName ?? '—'}
                              {cell.room ? ` · ${cell.room}` : ''}
                            </p>
                          </div>
                        ) : (
                          <div className="px-2 py-2 text-center text-xs text-zinc-700">Free</div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
