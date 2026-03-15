'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState, useMemo } from 'react'
import { getPendingFees, type PendingFeeRow } from '../actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Search, ArrowLeft, CircleDollarSign, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import * as xlsx from 'xlsx'

export default function PendingFeesPage() {
    const { school } = useAuthStore()
    const [rows, setRows] = useState<PendingFeeRow[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => {
        if (!school?.id) return
        setLoading(true)
        getPendingFees(school.id)
            .then(setRows)
            .catch(e => toast.error(e.message))
            .finally(() => setLoading(false))
    }, [school?.id])

    const filtered = useMemo(() => {
        if (!search.trim()) return rows
        const t = search.toLowerCase()
        return rows.filter(
            r =>
                r.studentName.toLowerCase().includes(t) ||
                r.admissionNumber.toLowerCase().includes(t) ||
                r.className.toLowerCase().includes(t),
        )
    }, [rows, search])

    const totalOutstanding = rows.reduce((s, r) => s + r.balance, 0)

    const handleExport = () => {
        if (!filtered.length) { toast.error('No data to export'); return }
        const ws = xlsx.utils.json_to_sheet(
            filtered.map(r => ({
                'Admission No': r.admissionNumber,
                'Student Name': r.studentName,
                'Class': `${r.className} ${r.sectionName}`.trim(),
                'Total Fee (₹)': r.totalFee,
                'Paid (₹)': r.totalPaid,
                'Balance (₹)': r.balance,
            })),
        )
        const wb = xlsx.utils.book_new()
        xlsx.utils.book_append_sheet(wb, ws, 'Pending Fees')
        xlsx.writeFile(wb, `pending_fees_${new Date().toISOString().split('T')[0]}.xlsx`)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <Link href={'/school-admin/fees' as any}>
                        <Button variant="outline" size="icon" className="h-9 w-9">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Pending Fees</h1>
                        <p className="text-muted-foreground text-sm">Students with outstanding fee balance</p>
                    </div>
                </div>
                <Button variant="outline" onClick={handleExport} disabled={loading || !filtered.length}>
                    Export Excel
                </Button>
            </div>

            {/* Summary card */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card className="border-destructive/30 bg-destructive/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-destructive">Total Outstanding</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-destructive">
                            ₹{totalOutstanding.toLocaleString('en-IN')}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Students with Dues</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{rows.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Balance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">
                            ₹{rows.length ? Math.round(totalOutstanding / rows.length).toLocaleString('en-IN') : '0'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Table */}
            <Card>
                <CardHeader className="pb-3 border-b">
                    <div className="flex items-center gap-2 max-w-sm">
                        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Input
                            placeholder="Search student, admission no. or class..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="h-9 border-0 shadow-none focus-visible:ring-0 px-0 bg-transparent"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-6 space-y-3">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full rounded-md" />
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
                            <AlertCircle className="h-10 w-10 opacity-40" />
                            <p className="font-medium">{search ? 'No students match your search.' : 'No pending fees! All students are up to date.'}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Student</th>
                                        <th className="px-6 py-3 font-medium">Class</th>
                                        <th className="px-6 py-3 font-medium text-right">Total Fee</th>
                                        <th className="px-6 py-3 font-medium text-right">Paid</th>
                                        <th className="px-6 py-3 font-medium text-right">Balance</th>
                                        <th className="px-6 py-3 font-medium text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filtered.map(row => (
                                        <tr key={row.studentId} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <p className="font-medium">{row.studentName}</p>
                                                <p className="text-xs text-muted-foreground">{row.admissionNumber}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge variant="secondary" className="text-xs">
                                                    {row.className}{row.sectionName ? ` - ${row.sectionName}` : ''}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right text-muted-foreground">
                                                ₹{row.totalFee.toLocaleString('en-IN')}
                                            </td>
                                            <td className="px-6 py-4 text-right text-emerald-600 dark:text-emerald-400">
                                                ₹{row.totalPaid.toLocaleString('en-IN')}
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-destructive">
                                                ₹{row.balance.toLocaleString('en-IN')}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link href={`/school-admin/fees/collect?q=${encodeURIComponent(row.admissionNumber)}` as any}>
                                                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                                                        <CircleDollarSign className="h-3.5 w-3.5" />
                                                        Collect
                                                    </Button>
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
            {!loading && filtered.length > 0 && (
                <p className="text-xs text-muted-foreground">
                    Showing {filtered.length} of {rows.length} students with outstanding fees
                </p>
            )}
        </div>
    )
}
