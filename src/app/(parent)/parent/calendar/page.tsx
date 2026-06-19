'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { getSchoolCalendar, type CalendarEntryRow } from '../actions'
import { categoryClasses, categoryLabel, formatDateRange } from '@/lib/calendar-utils'
import { schoolToday } from '@/lib/date-utils'
import { Skeleton } from '@/components/ui/skeleton'
import { DataLoadError } from '@/components/shared/DataLoadError'
import { CalendarDays } from 'lucide-react'

export default function ParentCalendarPage() {
  const { school } = useAuthStore()
  const [rows, setRows] = useState<CalendarEntryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const today = schoolToday()

  const load = useCallback(async () => {
    if (!school?.id) return
    setLoading(true)
    setError(null)
    try {
      setRows(await getSchoolCalendar(school.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the calendar.')
    } finally {
      setLoading(false)
    }
  }, [school?.id])

  useEffect(() => {
    load()
  }, [load])

  const upcoming = rows.filter((h) => (h.endDate ?? h.startDate) >= today)
  const past = rows.filter((h) => (h.endDate ?? h.startDate) < today)

  return (
    <div className="px-4 py-5 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-blue-400" />
        <h1 className="text-lg font-bold text-white">School Calendar</h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <DataLoadError message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] py-12 text-center text-sm text-zinc-500">
          No calendar entries yet.
        </div>
      ) : (
        <div className="space-y-5">
          <Section title="Upcoming" rows={upcoming} />
          <Section title="Past" rows={past} dimmed />
        </div>
      )}
    </div>
  )
}

function Section({ title, rows, dimmed = false }: { title: string; rows: CalendarEntryRow[]; dimmed?: boolean }) {
  if (rows.length === 0) return null
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</p>
      {rows.map((h) => (
        <div
          key={h.id}
          className={`flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 ${
            dimmed ? 'opacity-60' : ''
          }`}
        >
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${categoryClasses(h.category)}`}>
            {categoryLabel(h.category)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{h.title}</p>
            <p className="text-xs text-zinc-500">
              {formatDateRange(h.startDate, h.endDate)}
              {h.description ? ` · ${h.description}` : ''}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
