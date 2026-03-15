'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState, useCallback } from 'react'
import {
  getChildAttendanceCalendar,
  type AttendanceDayRecord,
} from '../actions'
import { ChevronLeft, ChevronRight, CalendarCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const STATUS_CONFIG = {
  present: { color: 'bg-emerald-500', label: 'Present' },
  absent: { color: 'bg-red-500', label: 'Absent' },
  late: { color: 'bg-amber-400', label: 'Late' },
  half_day: { color: 'bg-blue-400', label: 'Half Day' },
  holiday: { color: 'bg-purple-400', label: 'Holiday' },
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

  // Build calendar
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const recordMap = new Map(records.map(r => [r.date, r.status]))

  const present = records.filter(r => r.status === 'present').length
  const absent = records.filter(r => r.status === 'absent').length
  const late = records.filter(r => r.status === 'late').length

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CalendarCheck className="h-6 w-6 text-blue-500" /> Attendance
        </h1>
      </div>

      {/* Summary badges */}
      <div className="flex gap-2 flex-wrap">
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">✅ Present: {present}</Badge>
        <Badge className="bg-red-100 text-red-700 border-red-200">❌ Absent: {absent}</Badge>
        <Badge className="bg-amber-100 text-amber-700 border-amber-200">⏰ Late: {late}</Badge>
      </div>

      {/* Month navigator */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <button onClick={prev} className="p-1 rounded hover:bg-muted transition-colors">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <CardTitle className="text-base">{MONTHS[month - 1]} {year}</CardTitle>
            <button onClick={next} className="p-1 rounded hover:bg-muted transition-colors">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-9 rounded" />
              ))}
            </div>
          ) : (
            <>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS.map(d => (
                  <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const status = recordMap.get(dateStr)
                  const config = status ? STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] : null
                  const isToday = dateStr === now.toISOString().split('T')[0]

                  return (
                    <div
                      key={day}
                      className={`relative flex flex-col items-center justify-center h-9 rounded text-xs font-medium transition-all
                        ${config ? config.color + ' text-white' : 'bg-muted/50 text-muted-foreground'}
                        ${isToday ? 'ring-2 ring-primary ring-offset-1' : ''}
                      `}
                      title={status ?? 'No record'}
                    >
                      {day}
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t">
                {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className={`h-3 w-3 rounded-full ${val.color}`} />
                    {val.label}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
