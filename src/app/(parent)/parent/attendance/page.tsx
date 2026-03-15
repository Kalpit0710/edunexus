'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState, useCallback } from 'react'
import {
  getChildAttendanceCalendar,
  type AttendanceDayRecord,
} from '../actions'
import { ChevronLeft, ChevronRight, CalendarCheck } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const STATUS_CONFIG = {
  present: { bg: 'bg-emerald-500', label: 'Present' },
  absent: { bg: 'bg-red-500', label: 'Absent' },
  late: { bg: 'bg-amber-400', label: 'Late' },
  half_day: { bg: 'bg-blue-400', label: 'Half Day' },
  holiday: { bg: 'bg-purple-400', label: 'Holiday' },
}

export default function AttendancePage() {
  const { user, school, activeChildId } = useAuthStore()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [records, setRecords] = useState<AttendanceDayRecord[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const childId = activeChildId
    if (!childId || !school?.id) return
    setLoading(true)
    const data = await getChildAttendanceCalendar(childId, school.id, month, year)
    setRecords(data)
    setLoading(false)
  }, [activeChildId, school?.id, month, year])

  useEffect(() => { load() }, [load])

  const prev = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  const next = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const recordMap = new Map(records.map(r => [r.date, r.status]))

  const present = records.filter(r => r.status === 'present').length
  const absent = records.filter(r => r.status === 'absent').length
  const late = records.filter(r => r.status === 'late').length

  return (
    <div className="p-5 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-500/25 bg-blue-600/10">
          <CalendarCheck className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Attendance</h1>
          <p className="text-xs text-zinc-500">Monthly calendar view</p>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Present: {present}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300">
          <span className="h-2 w-2 rounded-full bg-red-400" />
          Absent: {absent}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          Late: {late}
        </span>
      </div>

      {/* Calendar card */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
        {/* Month navigator */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prev} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-all">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-semibold text-white">{MONTHS[month - 1]} {year}</p>
          <button onClick={next} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-all">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-9 rounded-lg bg-white/5" />
            ))}
          </div>
        ) : (
          <>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAYS.map(d => (
                <div key={d} className="text-center text-[10px] font-semibold text-zinc-600 py-1">{d}</div>
              ))}
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const status = recordMap.get(dateStr)
                const config = status ? STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] : null
                const isToday = dateStr === now.toISOString().split('T')[0]

                return (
                  <div
                    key={day}
                    className={`relative flex items-center justify-center h-9 rounded-lg text-xs font-medium transition-all
                      ${config ? config.bg + ' text-white' : 'bg-white/[0.04] text-zinc-500 hover:bg-white/[0.07]'}
                      ${isToday ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-[#0a0a0a]' : ''}
                    `}
                    title={status ?? 'No record'}
                  >
                    {day}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-white/[0.06]">
              {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                <div key={key} className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <div className={`h-2.5 w-2.5 rounded-full ${val.bg}`} />
                  {val.label}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
