'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { getChildTimetable, getLinkedChildren, type ChildTimetable } from '../actions'
import { WEEKDAYS, DEFAULT_WORKING_DAYS, formatPeriodRange, weekdayLabel } from '@/lib/timetable-utils'
import { Skeleton } from '@/components/ui/skeleton'
import { DataLoadError } from '@/components/shared/DataLoadError'
import { CalendarRange } from 'lucide-react'

const DEFAULT_WORKING = WEEKDAYS.filter((w) => DEFAULT_WORKING_DAYS.includes(w.value))

export default function ParentTimetablePage() {
  const { user, school, activeChildId, setActiveChildId } = useAuthStore()
  const [data, setData] = useState<ChildTimetable | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Mobile day picker — default to today (clamped into the working week).
  const todayIso = ((new Date().getDay() + 6) % 7) + 1
  const [activeDay, setActiveDay] = useState(
    DEFAULT_WORKING.some((w) => w.value === todayIso) ? todayIso : (DEFAULT_WORKING[0]?.value ?? 1),
  )

  const load = useCallback(async () => {
    if (!school?.id || !user?.email) return
    setLoading(true)
    setError(null)
    try {
      let childId = activeChildId
      if (!childId) {
        const kids = await getLinkedChildren(user.email, school.id)
        childId = kids[0]?.id ?? null
        if (childId) setActiveChildId(childId)
      }
      if (!childId) {
        setData({ periods: [], entries: [], workingDays: DEFAULT_WORKING_DAYS })
        return
      }
      setData(await getChildTimetable(school.id, childId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the timetable.')
    } finally {
      setLoading(false)
    }
  }, [school?.id, user?.email, activeChildId, setActiveChildId])

  useEffect(() => {
    load()
  }, [load])

  const cellAt = (dayOfWeek: number, periodId: string) =>
    data?.entries.find((e) => e.dayOfWeek === dayOfWeek && e.periodId === periodId)

  const WORKING = WEEKDAYS.filter((w) => (data?.workingDays ?? DEFAULT_WORKING_DAYS).includes(w.value))

  return (
    <div className="px-4 py-5 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarRange className="h-5 w-5 text-blue-400" />
        <h1 className="text-lg font-bold text-white">Timetable</h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <DataLoadError message={error} onRetry={load} />
      ) : !data || data.periods.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] py-12 text-center text-sm text-zinc-500">
          No timetable published yet.
        </div>
      ) : (
        <>
          {/* Day selector (single-day view works best on phones). */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {WORKING.map((d) => (
              <button
                key={d.value}
                onClick={() => setActiveDay(d.value)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  activeDay === d.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/[0.04] text-zinc-400 hover:text-white'
                }`}
              >
                {d.short}
              </button>
            ))}
          </div>

          <p className="text-xs text-zinc-500">{weekdayLabel(activeDay, true)}</p>

          <div className="space-y-2">
            {data.periods.map((p) => {
              if (p.isBreak) {
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl border border-amber-500/15 bg-amber-500/[0.05] px-4 py-3"
                  >
                    <div className="w-20 shrink-0 text-xs text-amber-400/70">
                      {formatPeriodRange(p.startTime, p.endTime)}
                    </div>
                    <span className="text-sm font-medium text-amber-400/80">{p.name} · Break</span>
                  </div>
                )
              }
              const cell = cellAt(activeDay, p.id)
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
                >
                  <div className="w-20 shrink-0">
                    <p className="text-xs font-medium text-zinc-300">{p.name}</p>
                    <p className="text-[11px] text-zinc-500">{formatPeriodRange(p.startTime, p.endTime)}</p>
                  </div>
                  {cell ? (
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{cell.subjectName ?? '—'}</p>
                      <p className="truncate text-xs text-zinc-500">
                        {cell.teacherName ?? 'Teacher TBA'}
                        {cell.room ? ` · ${cell.room}` : ''}
                      </p>
                    </div>
                  ) : (
                    <span className="text-sm text-zinc-600">Free period</span>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
