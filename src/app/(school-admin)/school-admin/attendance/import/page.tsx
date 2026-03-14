'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { saveAttendance, type AttendanceStatus } from '../actions'
import { getClasses, getSections } from '../../settings/actions'
import { getStudentsForAttendance } from '../actions'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Download, Upload, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import * as XLSX from 'xlsx'

type RowStatus = 'ok' | 'unknown_student' | 'bad_status'

interface ParsedRow {
    admission_number: string
    student_id?: string
    student_name?: string
    status: string
    remarks: string
    rowStatus: RowStatus
}

const VALID_STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'half_day', 'holiday']

export default function AttendanceImportPage() {
    const { school, user } = useAuthStore()
    const fileRef = useRef<HTMLInputElement>(null)

    const [classes, setClasses] = useState<any[]>([])
    const [sections, setSections] = useState<any[]>([])
    const [selClass, setSelClass] = useState('')
    const [selSection, setSelSection] = useState('')
    const [date, setDate] = useState(new Date().toISOString().split('T')[0] ?? '')

    const [parsed, setParsed] = useState<ParsedRow[]>([])
    const [isParsed, setIsParsed] = useState(false)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!school?.id) return
        Promise.all([getClasses(school.id), getSections(school.id)])
            .then(([cls, sec]) => { setClasses(cls); setSections(sec) })
            .catch((e: any) => toast.error(e.message))
    }, [school?.id])

    const filteredSections = sections.filter(s => s.class_id === selClass)

    function downloadTemplate() {
        const ws = XLSX.utils.aoa_to_sheet([
            ['admission_number', 'status', 'remarks'],
            ['ADM-001', 'present', ''],
            ['ADM-002', 'absent', 'Sick leave'],
            ['ADM-003', 'late', 'Arrived at 9:30'],
            ['ADM-004', 'half_day', ''],
            ['ADM-005', 'holiday', ''],
        ])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Attendance')
        XLSX.writeFile(wb, 'attendance_import_template.xlsx')
    }

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !school?.id || !selClass || !selSection || !date) {
            toast.error('Select class, section, date before uploading the file.')
            return
        }

        try {
            const buffer = await file.arrayBuffer()
            const wb = XLSX.read(buffer, { type: 'array' })
            const ws = wb.Sheets[wb.SheetNames[0]!]!
            const data = XLSX.utils.sheet_to_json<any>(ws)

            if (data.length === 0) {
                toast.error('The file appears to be empty.')
                return
            }

            // Check required columns
            const firstRow = data[0]
            if (!('admission_number' in firstRow) || !('status' in firstRow)) {
                toast.error('File must have columns: admission_number, status, remarks')
                return
            }

            // Fetch student list for this section
            const students = await getStudentsForAttendance(school.id, selClass, selSection, date)
            const admMap = new Map(students.map(s => [s.admission_number?.toLowerCase(), s]))

            const rows: ParsedRow[] = data.map((row: any) => {
                const admNo = String(row.admission_number ?? '').trim()
                const statusRaw = String(row.status ?? '').trim().toLowerCase().replace(' ', '_')
                const remarks = String(row.remarks ?? '').trim()
                const student = admMap.get(admNo.toLowerCase())
                let rowStatus: RowStatus = 'ok'
                if (!student) rowStatus = 'unknown_student'
                else if (!VALID_STATUSES.includes(statusRaw as AttendanceStatus)) rowStatus = 'bad_status'
                return {
                    admission_number: admNo,
                    student_id: student?.id,
                    student_name: student?.full_name,
                    status: statusRaw,
                    remarks,
                    rowStatus,
                }
            })

            setParsed(rows)
            setIsParsed(true)
        } catch (e: any) {
            toast.error('Failed to parse file: ' + e.message)
        }
    }

    async function handleImport() {
        const validRows = parsed.filter(r => r.rowStatus === 'ok')
        if (validRows.length === 0) {
            toast.error('No valid rows to import.')
            return
        }
        if (!school?.id || !user) return
        setSaving(true)
        try {
            const records = validRows.map(r => ({
                student_id: r.student_id!,
                status: r.status as AttendanceStatus,
                remarks: r.remarks || null,
            }))
            await saveAttendance(school.id, selClass, selSection, date, user.id, records)
            toast.success(`Imported attendance for ${validRows.length} students.`)
            setParsed([])
            setIsParsed(false)
            if (fileRef.current) fileRef.current.value = ''
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setSaving(false)
        }
    }

    const validCount = parsed.filter(r => r.rowStatus === 'ok').length
    const invalidCount = parsed.filter(r => r.rowStatus !== 'ok').length

    const ROW_ICON: Record<RowStatus, React.ReactNode> = {
        ok: <CheckCircle className="h-3.5 w-3.5 text-green-500" />,
        unknown_student: <XCircle className="h-3.5 w-3.5 text-red-500" />,
        bad_status: <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />,
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Link href={'/school-admin/attendance' as any}>
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Daily Attendance
                </Button>
            </Link>

            <div>
                <h2 className="text-2xl font-bold tracking-tight">Import Attendance from Excel</h2>
                <p className="text-muted-foreground">Upload a spreadsheet to bulk-mark attendance for a class section.</p>
            </div>

            {/* Step 1: Download template */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Step 1 — Download Template</CardTitle>
                    <CardDescription>Use this template as the base for your Excel file.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button variant="outline" onClick={downloadTemplate}>
                        <Download className="h-4 w-4 mr-2" />
                        Download Template (.xlsx)
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                        Valid status values: <code className="bg-muted px-1 rounded">present</code>,{' '}
                        <code className="bg-muted px-1 rounded">absent</code>,{' '}
                        <code className="bg-muted px-1 rounded">late</code>,{' '}
                        <code className="bg-muted px-1 rounded">half_day</code>,{' '}
                        <code className="bg-muted px-1 rounded">holiday</code>
                    </p>
                </CardContent>
            </Card>

            {/* Step 2: Select class, section, date */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Step 2 — Select Class, Section & Date</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="space-y-1">
                            <Label className="text-xs">Class</Label>
                            <Select value={selClass} onValueChange={v => { setSelClass(v); setSelSection(''); setIsParsed(false) }}>
                                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent>
                                    {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Section</Label>
                            <Select value={selSection} onValueChange={v => { setSelSection(v); setIsParsed(false) }} disabled={!selClass}>
                                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent>
                                    {filteredSections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Date</Label>
                            <Input type="date" value={date} onChange={e => { setDate(e.target.value); setIsParsed(false) }} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Step 3: Upload */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Step 3 — Upload File</CardTitle>
                    <CardDescription>Upload your filled-in Excel file. Rows will be validated before import.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4">
                        <Input
                            ref={fileRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="max-w-xs"
                            onChange={handleFileChange}
                            disabled={!selClass || !selSection || !date}
                        />
                    </div>
                    {!selClass || !selSection || !date ? (
                        <p className="text-xs text-muted-foreground mt-2">Select class, section, and date first.</p>
                    ) : null}
                </CardContent>
            </Card>

            {/* Preview */}
            {isParsed && (
                <Card>
                    <CardHeader className="border-b pb-3">
                        <CardTitle className="text-base flex items-center gap-3">
                            Preview
                            <span className="text-xs font-normal text-green-600">{validCount} valid</span>
                            {invalidCount > 0 && <span className="text-xs font-normal text-red-500">{invalidCount} with errors (will be skipped)</span>}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto max-h-96 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 border-b text-xs uppercase sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-medium">Adm. No</th>
                                        <th className="px-4 py-2 text-left font-medium">Student</th>
                                        <th className="px-4 py-2 text-left font-medium">Status</th>
                                        <th className="px-4 py-2 text-left font-medium">Remarks</th>
                                        <th className="px-4 py-2 text-left font-medium">Validation</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {parsed.map((row, i) => (
                                        <tr key={i} className={row.rowStatus !== 'ok' ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                                            <td className="px-4 py-2">{row.admission_number}</td>
                                            <td className="px-4 py-2">{row.student_name ?? <span className="text-muted-foreground italic">Not found</span>}</td>
                                            <td className="px-4 py-2 font-mono text-xs">{row.status}</td>
                                            <td className="px-4 py-2 text-muted-foreground">{row.remarks || '—'}</td>
                                            <td className="px-4 py-2">
                                                <div className="flex items-center gap-1.5">
                                                    {ROW_ICON[row.rowStatus]}
                                                    <span className="text-xs">
                                                        {row.rowStatus === 'ok' ? 'Ready' :
                                                            row.rowStatus === 'unknown_student' ? 'Student not found in this section' :
                                                                'Invalid status value'}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {isParsed && validCount > 0 && (
                <div className="flex justify-end">
                    <Button size="lg" onClick={handleImport} disabled={saving}>
                        <Upload className="h-4 w-4 mr-2" />
                        {saving ? 'Importing…' : `Import ${validCount} Records`}
                    </Button>
                </div>
            )}
        </div>
    )
}
