'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState, useMemo } from 'react'
import { getAllPayments, type FeePaymentRow } from '../actions'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Search, ArrowLeft, Download, FileText } from 'lucide-react'
import Link from 'next/link'
import * as xlsx from 'xlsx'

const MODE_LABELS: Record<string, string> = {
    cash: 'Cash', cheque: 'Cheque', upi: 'UPI',
    neft: 'NEFT/RTGS', card: 'Card', online: 'Online',
}

const MODE_COLORS: Record<string, string> = {
    cash: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    cheque: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    upi: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    neft: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    card: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    online: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
}

export default function PaymentHistoryPage() {
    const { school } = useAuthStore()

    const today = new Date().toISOString().split('T')[0]!
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString().split('T')[0]!

    const [fromDate, setFromDate] = useState(firstOfMonth)
    const [toDate, setToDate] = useState(today)
    const [search, setSearch] = useState('')
    const [payments, setPayments] = useState<FeePaymentRow[]>([])
    const [loading, setLoading] = useState(true)

    const load = async () => {
        if (!school?.id) return
        setLoading(true)
        try {
            const data = await getAllPayments(school.id, { fromDate, toDate })
            setPayments(data)
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [school?.id])

    const filtered = useMemo(() => {
        if (!search.trim()) return payments
        const t = search.toLowerCase()
        return payments.filter(
            p =>
                p.student_name?.toLowerCase().includes(t) ||
                p.student_admission_number?.toLowerCase().includes(t) ||
                p.receipt_number?.toLowerCase().includes(t),
        )
    }, [payments, search])

    const totalCollected = filtered.reduce((s, p) => s + Number(p.paid_amount), 0)
    const totalDiscount = filtered.reduce((s, p) => s + Number(p.discount_amount), 0)

    const handleExport = () => {
        if (!filtered.length) { toast.error('No data to export'); return }
        const ws = xlsx.utils.json_to_sheet(
            filtered.map(p => ({
                'Receipt No': p.receipt_number,
                'Date': p.payment_date,
                'Student': p.student_name,
                'Admission No': p.student_admission_number,
                'Total (₹)': p.total_amount,
                'Paid (₹)': p.paid_amount,
                'Discount (₹)': p.discount_amount,
                'Mode': MODE_LABELS[p.payment_mode] ?? p.payment_mode,
                'Reference': p.reference_number ?? '',
                'Remarks': p.remarks ?? '',
            })),
        )
        const wb = xlsx.utils.book_new()
        xlsx.utils.book_append_sheet(wb, ws, 'Payment History')
        xlsx.writeFile(wb, `payment_history_${fromDate}_to_${toDate}.xlsx`)
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
                        <h1 className="text-2xl font-bold tracking-tight">Payment History</h1>
                        <p className="text-muted-foreground text-sm">All fee receipts and transaction records</p>
                    </div>
                </div>
                <Button variant="outline" onClick={handleExport} disabled={loading || !filtered.length}>
                    <Download className="mr-2 h-4 w-4" /> Export Excel
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-4 pb-4">
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="space-y-1">
                            <Label className="text-xs">From Date</Label>
                            <Input
                                type="date"
                                value={fromDate}
                                max={toDate}
                                onChange={e => setFromDate(e.target.value)}
                                className="h-9 w-40"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">To Date</Label>
                            <Input
                                type="date"
                                value={toDate}
                                min={fromDate}
                                max={today}
                                onChange={e => setToDate(e.target.value)}
                                className="h-9 w-40"
                            />
                        </div>
                        <Button onClick={load} disabled={loading} className="h-9">
                            <Search className="mr-2 h-4 w-4" />
                            {loading ? 'Loading...' : 'Search'}
                        </Button>
                        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                            <Input
                                placeholder="Filter by name, receipt..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="h-9 border-0 shadow-none focus-visible:ring-0 px-0 bg-transparent flex-1"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Summary */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <p className="text-sm text-muted-foreground font-medium">Total Collected</p>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                            ₹{totalCollected.toLocaleString('en-IN')}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <p className="text-sm text-muted-foreground font-medium">Transactions</p>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{filtered.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <p className="text-sm text-muted-foreground font-medium">Total Discounts</p>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-amber-500">
                            ₹{totalDiscount.toLocaleString('en-IN')}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-6 space-y-3">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={i} className="h-14 w-full rounded-md" />
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
                            <FileText className="h-10 w-10 opacity-40" />
                            <p className="font-medium">No payments found for this period.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Receipt</th>
                                        <th className="px-6 py-3 font-medium">Student</th>
                                        <th className="px-6 py-3 font-medium">Date</th>
                                        <th className="px-6 py-3 font-medium text-right">Total</th>
                                        <th className="px-6 py-3 font-medium text-right">Paid</th>
                                        <th className="px-6 py-3 font-medium text-right">Discount</th>
                                        <th className="px-6 py-3 font-medium">Mode</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filtered.map(p => (
                                        <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-6 py-4 font-mono text-xs font-medium">{p.receipt_number}</td>
                                            <td className="px-6 py-4">
                                                <p className="font-medium">{p.student_name}</p>
                                                <p className="text-xs text-muted-foreground">{p.student_admission_number}</p>
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground">
                                                {new Date(p.payment_date).toLocaleDateString('en-IN', {
                                                    day: '2-digit', month: 'short', year: 'numeric',
                                                })}
                                            </td>
                                            <td className="px-6 py-4 text-right text-muted-foreground">
                                                ₹{Number(p.total_amount).toLocaleString('en-IN')}
                                            </td>
                                            <td className="px-6 py-4 text-right font-semibold">
                                                ₹{Number(p.paid_amount).toLocaleString('en-IN')}
                                            </td>
                                            <td className="px-6 py-4 text-right text-amber-500">
                                                {Number(p.discount_amount) > 0
                                                    ? `−₹${Number(p.discount_amount).toLocaleString('en-IN')}`
                                                    : '—'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span
                                                    className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${MODE_COLORS[p.payment_mode] ?? 'bg-muted text-muted-foreground'}`}
                                                >
                                                    {MODE_LABELS[p.payment_mode] ?? p.payment_mode}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
