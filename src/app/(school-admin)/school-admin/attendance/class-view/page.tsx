'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { getMonthlyAttendanceReport, getStudentsForAttendance, type AttendanceStatus } from '../actions'
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
import * as XLSX from 'xlsx'

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
]

const STATUS_SHORT: Record<string, string> = {
    present: 'P',
    absent: 'A',
    late: 'L',
    half_day: 'HD',
    holiday: 'H',
}

const STATUS_COLOR: Record<string, string> = {
    present: 'bg-green-100 text-green-800',
    absent: 'bg-red-100 text-red-800',
    late: 'bg-yellow-100 text-yellow-800',
    half_day: 'bg-orange-100 text-orange-800',
    holiday: 'bg-blue-100 text-blue-800',
    none: 'bg-muted text-muted-foreground',
}

function pctColor(pct: number) {
    if (pct >= 85) return 'text-green-600 font-semibold'
    if (pct >= 75) return 'text-yellow-600 font-semibold'
    return 'text-red-600 font-semibold'
}

export default function ClassAttendanceViewPage() {
    const { school } = useAuthStore()
    const now = new Date()

    const [classes, setClasses] = useState<any[]>([])
    const [sections, setSections] = useState<any[]>([])
    const [selClass, setSelClass] = useState('')
    const [selSection, setSelSection] = useState('')
    const [month, setMonth] = useState(String(now.getMonth() + 1))
    const [year, setYear] = useState(String(now.getFullYear()))

    // date-wise grid: { date -> { studentId -> status } }
    const [students, setStudents] = useState<any[]>([])
    const [dates, setDates] = useState<string[]>([])
    const [grid, setGrid] = useState<Record<string, Record<string, AttendanceStatus | null>>>({})
    const [loading, setLoading] = useState(false)
    const [loaded, setLoaded] = useState(false)

    useEffect(() => {
        if (!school?.id) return
        Promise.all([getClasses(school.id), getSections(school.id)])
            .then(([cls, sec]) => { setClasses(cls); setSections(sec) })
            .catch((e: any) => toast.error(e.message))
    }, [school?.id])

    const filteredSections = sections.filter(s => s.class_id === selClass)

    async function loadGrid() {
        if (!school?.id || !selClass || !selSection) {
            toast.error('Select class and section.')
            return
        }
        setLoading(true)
        setLoaded(false)
        try {
            const y = Number(year)
            const m = Number(month)
            const lastDay = new Date(y, m, 0).getDate()

            // Get all dates in month
            const allDates: string[] = []
            for (let d = 1; d <= lastDay; d++) {
                allDates.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
            }

            // Fetch all dates in parallel (only fetch dates up to today)
            const today = new Date().toISOString().split('T')[0]!
            const pastDates = allDates.filter(d => d <= today)

            const results = await Promise.all(
                pastDates.map(d => getStudentsForAttendance(school!.id, selClass, selSection, d))
            )

            // Build student list from first result
            const studentList = results[0]?.map(r => ({ id: r.id, name: r.full_name, admission_number: r.admission_number, roll_number: r.roll_number })) ?? []
            setStudents(studentList)

            // Build grid: date -> studentId -> status
            const g: Record<string, Record<string, AttendanceStatus | null>> = {}
            pastDates.forEach((date, i) => {
                g[date] = {}
                results[i]?.forEach(r => {
                    g[date]![r.id] = r.attendance_status
                })
            })
            setGrid(g)

            // Only show dates that have at least one record
            const markedDates = pastDates.filter(d => {
                const dayGrid = g[d] ?? {}
                return Object.values(dayGrid).some(v => v !== null)
            })
            setDates(markedDates)
            setLoaded(true)
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setLoading(false)
        }
    }

    function handleExportXLSX() {
        if (!loaded || students.length === 0) return

        const headers = ['#', 'Name', 'Adm. No', ...dates.map(d => {
            const dt = new Date(d)
            return `${dt.getDate()}/${dt.getMonth() + 1}`
        }), 'P', 'A', 'L', 'HD', '%']

        const rows = students.map((s, i) => {
            const statusRow = dates.map(d => {
                const st = grid[d]?.[s.id] ?? null
                return st ? STATUS_SHORT[st] ?? '?' : '-'
            })
            const present = dates.filter(d => grid[d]?.[s.id] === 'present').length
            const absent = dates.filter(d => grid[d]?.[s.id] === 'absent').length
            const late = dates.filter(d => grid[d]?.[s.id] === 'late').length
            const half = dates.filter(d => grid[d]?.[s.id] === 'half_day').length
            const total = dates.length
            const pct = total > 0 ? Math.round(((present + late + half * 0.5) / total) * 100) : 0
            return [i + 1, s.name, s.admission_number, ...statusRow, present, absent, late, half, `${pct}%`]
        })

        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Attendance')
        XLSX.writeFile(wb, `class_attendance_${MONTHS[Number(month) - 1]}_${year}.xlsx`)
    }

    const className = classes.find(c => c.id === selClass)?.name ?? ''
    const sectionName = sections.find(s => s.id === selSection)?.name ?? ''

    return (
        <div className="space-y-6">
            <Link href={'/school-admin/attendance' as any}>
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Daily Attendance
                </Button>
            </Link>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Class Attendance View</h2>
                    <p className="text-muted-foreground">Date-wise attendance grid for a class section.</p>
                </div>
                {loaded && dates.length > 0 && (
                    <Button variant="outline" onClick={handleExportXLSX}>
                        <Download className="h-4 w-4 mr-2" />
                        Export Excel
                    </Button>
                )}
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-base">Select Class & Month</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                        <div className="space-y-1">
                            <Label className="text-xs">Class</Label>
                            <Select value={selClass} onValueChange={v => { setSelClass(v); setSelSection(''); setLoaded(false) }}>
                                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent>
                                    {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Section</Label>
                            <Select value={selSection} onValueChange={v => { setSelSection(v); setLoaded(false) }} disabled={!selClass}>
                                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent>
                                    {filteredSections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Month</Label>
                            <Select value={month} onValueChange={v => { setMonth(v); setLoaded(false) }}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Year</Label>
                            <Select value={year} onValueChange={v => { setYear(v); setLoaded(false) }}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-end">
                            <Button onClick={loadGrid} disabled={loading || !selClass || !selSection} className="w-full">
                                {loading ? 'Loading…' : 'Load Grid'}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Grid */}
            {loaded && (
                <>
                    {dates.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
                                No attendance records found for {className} - {sectionName} in {MONTHS[Number(month) - 1]} {year}.
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardHeader className="border-b pb-3">
                                <CardTitle className="text-base">
                                    {className} – {sectionName} &nbsp;·&nbsp;
                                    <span className="font-normal text-muted-foreground">{MONTHS[Number(month) - 1]} {year}</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="text-xs w-full">
                                        <thead className="bg-muted/50 border-b">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-medium sticky left-0 bg-muted/80">#</th>
                                                <th className="px-3 py-2 text-left font-medium sticky left-6 bg-muted/80 min-w-[140px]">Name</th>
                                                {dates.map(d => {
                                                    const dt = new Date(d)
                                                    return (
                                                        <th key={d} className="px-1 py-2 text-center font-medium min-w-[28px]">
                                                            <div>{dt.getDate()}</div>
                                                            <div className="text-muted-foreground font-normal text-[9px]">
                                                                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][dt.getDay()]}
                                                            </div>
                                                        </th>
                                                    )
                                                })}
                                                <th className="px-2 py-2 text-center font-medium">P</th>
                                                <th className="px-2 py-2 text-center font-medium">A</th>
                                                <th className="px-2 py-2 text-center font-medium">L</th>
                                                <th className="px-2 py-2 text-center font-medium">HD</th>
                                                <th className="px-2 py-2 text-right font-medium pr-4">%</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {students.map((s, i) => {
                                                const present = dates.filter(d => grid[d]?.[s.id] === 'present').length
                                                const absent = dates.filter(d => grid[d]?.[s.id] === 'absent').length
                                                const late = dates.filter(d => grid[d]?.[s.id] === 'late').length
                                                const half = dates.filter(d => grid[d]?.[s.id] === 'half_day').length
                                                const total = dates.length
                                                const pct = total > 0 ? Math.round(((present + late + half * 0.5) / total) * 100) : 0
                                                return (
                                                    <tr key={s.id} className="hover:bg-muted/20">
                                                        <td className="px-3 py-2 text-muted-foreground sticky left-0 bg-background">{i + 1}</td>
                                                        <td className="px-3 py-2 sticky left-6 bg-background">
                                                            <div className="font-medium whitespace-nowrap">{s.name}</div>
                                                            <div className="text-muted-foreground text-[10px]">{s.admission_number}</div>
                                                        </td>
                                                        {dates.map(d => {
                                                            const st = grid[d]?.[s.id] ?? null
                                                            const colorClass = STATUS_COLOR[st ?? 'none']!
                                                            return (
                                                                <td key={d} className="px-1 py-2 text-center">
                                                                    <span className={`inline-block w-6 h-6 rounded text-[10px] font-bold leading-6 ${colorClass}`}>
                                                                        {st ? (STATUS_SHORT[st] ?? '?') : '·'}
                                                                    </span>
                                                                </td>
                                                            )
                                                        })}
                                                        <td className="px-2 py-2 text-center text-green-700 font-semibold">{present}</td>
                                                        <td className="px-2 py-2 text-center text-red-700 font-semibold">{absent}</td>
                                                        <td className="px-2 py-2 text-center text-yellow-700 font-semibold">{late}</td>
                                                        <td className="px-2 py-2 text-center text-orange-700 font-semibold">{half}</td>
                                                        <td className={`px-4 py-2 text-right ${pctColor(pct)}`}>{pct}%</td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                    {/* Legend */}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {Object.entries(STATUS_SHORT).map(([k, v]) => (
                            <span key={k} className={`px-2 py-0.5 rounded font-medium ${STATUS_COLOR[k]}`}>{v} = {k.replace('_', ' ')}</span>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
