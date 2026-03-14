'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, TrendingUp, Package, AlertCircle, IndianRupee, Download } from 'lucide-react'
import Link from 'next/link'
import { getInventorySummary, getInventorySales, getLowStockItems } from '../actions'
import { formatCurrency } from '@/lib/utils'
import * as xlsx from 'xlsx'

export default function InventoryReportsPage() {
    const { school } = useAuthStore()

    const [summary, setSummary] = useState<any>(null)
    const [sales, setSales] = useState<any[]>([])
    const [lowStock, setLowStock] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const [dateRange, setDateRange] = useState<{ from: string, to: string }>({
        from: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0] || '',
        to: new Date().toISOString().split('T')[0] || ''
    })

    useEffect(() => {
        if (school?.id) {
            loadInitialData()
        }
    }, [school?.id])

    useEffect(() => {
        if (school?.id && !loading) {
            // Reload sales only when dates change after initial load
            loadSales()
        }
    }, [dateRange.from, dateRange.to])

    async function loadInitialData() {
        if (!school?.id) return
        setLoading(true)
        try {
            const [sumData, salesData, minStockData] = await Promise.all([
                getInventorySummary(school.id),
                getInventorySales(school.id, { fromDate: dateRange.from, toDate: dateRange.to }),
                getLowStockItems(school.id, 20)
            ])
            setSummary(sumData)
            setSales(salesData || [])
            setLowStock(minStockData || [])
        } catch (e: any) {
            toast.error("Failed to load reports: " + e.message)
        } finally {
            setLoading(false)
        }
    }

    async function loadSales() {
        if (!school?.id) return
        try {
            const salesData = await getInventorySales(school.id, { fromDate: dateRange.from, toDate: dateRange.to })
            setSales(salesData || [])
        } catch (e: any) {
            toast.error("Failed to fetch sales: " + e.message)
        }
    }

    const exportSales = () => {
        if (!sales.length) return
        const exportData = sales.map(s => ({
            'Date': new Date(s.sale_date).toLocaleDateString(),
            'Time': new Date(s.sale_date).toLocaleTimeString(),
            'Bill No': s.bill_number,
            'Customer (Adm No)': s.students ? `${s.students.full_name} (${s.students.admission_number})` : 'Walk-in',
            'Items Count': s.inventory_sale_items.length,
            'Mode': s.payment_mode,
            'Total Amount': s.total_amount
        }))
        const ws = xlsx.utils.json_to_sheet(exportData)
        const wb = xlsx.utils.book_new()
        xlsx.utils.book_append_sheet(wb, ws, 'Sales Log')
        xlsx.writeFile(wb, `inventory_sales_${dateRange.from}_to_${dateRange.to}.xlsx`)
    }

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading dashboard...</div>
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <Link href={"/manager/inventory" as any}>
                        <Button variant="outline" size="icon">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </Link>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Inventory Reports</h2>
                        <p className="text-muted-foreground">Overview, low stock alerts, and sales history.</p>
                    </div>
                </div>
            </div>

            {/* Top Stat Cards */}
            {summary && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="shadow-soft border-l-4 border-l-blue-500">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Total Assets Value</p>
                                    <h3 className="text-2xl font-bold mt-2">{formatCurrency(summary.stockValue)}</h3>
                                </div>
                                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg text-blue-600 dark:text-blue-300">
                                    <IndianRupee className="w-5 h-5" />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-4">Across {summary.itemCount} unique items</p>
                        </CardContent>
                    </Card>

                    <Card className="shadow-soft border-l-4 border-l-red-500">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Low Stock Alerts</p>
                                    <h3 className="text-2xl font-bold mt-2">{summary.lowStockCount}</h3>
                                </div>
                                <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg text-red-600 dark:text-red-300">
                                    <AlertCircle className="w-5 h-5" />
                                </div>
                            </div>
                            <p className="text-xs text-red-600/80 dark:text-red-400/80 font-medium mt-4">Items requiring immediate restock</p>
                        </CardContent>
                    </Card>

                    <Card className="shadow-soft border-l-4 border-l-green-500">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Total Sales Volume</p>
                                    <h3 className="text-2xl font-bold mt-2">{formatCurrency(summary.salesTotal)}</h3>
                                </div>
                                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg text-green-600 dark:text-green-300">
                                    <TrendingUp className="w-5 h-5" />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-4">From {summary.salesCount} total transactions</p>
                        </CardContent>
                    </Card>

                    <Card className="shadow-soft border-l-4 border-l-orange-500">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Total Products</p>
                                    <h3 className="text-2xl font-bold mt-2">{summary.itemCount}</h3>
                                </div>
                                <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg text-orange-600 dark:text-orange-300">
                                    <Package className="w-5 h-5" />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-4">Active products in catalog</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Low Stock Alerts (Left Column) */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="shadow-soft h-[600px] flex flex-col border-red-500/20">
                        <CardHeader className="bg-red-50/50 dark:bg-red-950/20 pb-4 border-b">
                            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                                <AlertCircle className="w-5 h-5" /> Restock Required
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto p-0">
                            {lowStock.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground">
                                    All stock levels are optimal.
                                </div>
                            ) : (
                                <ul className="divide-y divide-border/50">
                                    {lowStock.map((item) => (
                                        <li key={item.id} className="p-4 hover:bg-muted/10 transition-colors flex justify-between items-center">
                                            <div>
                                                <p className="font-medium text-sm line-clamp-1">{item.name}</p>
                                                <p className="text-xs text-muted-foreground capitalize mt-1">{item.category} • SKU: {item.sku || 'N/A'}</p>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-bold text-red-600 dark:text-red-400">{item.stock_quantity}</div>
                                                <div className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase font-semibold">Alert: &lt;{item.low_stock_alert}</div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Sales History (Right Column) */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="shadow-soft h-[600px] flex flex-col">
                        <CardHeader className="pb-4 border-b flex-none">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <CardTitle>Sales Ledger</CardTitle>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center text-sm gap-2">
                                        <input
                                            type="date"
                                            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                            value={dateRange.from}
                                            onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                                        />
                                        <span className="text-muted-foreground">to</span>
                                        <input
                                            type="date"
                                            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                            value={dateRange.to}
                                            onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                                        />
                                    </div>
                                    <Button variant="outline" size="icon" onClick={exportSales} title="Export to Excel">
                                        <Download className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto p-0">
                            {sales.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground">
                                    No sales found for the selected date range.
                                </div>
                            ) : (
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b sticky top-0 z-10 backdrop-blur-md">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">Date & Time</th>
                                            <th className="px-4 py-3 font-medium">Bill No</th>
                                            <th className="px-4 py-3 font-medium">Customer</th>
                                            <th className="px-4 py-3 font-medium text-center">Items</th>
                                            <th className="px-4 py-3 font-medium text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y relative">
                                        {sales.map((sale) => (
                                            <tr key={sale.id} className="hover:bg-muted/10 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-medium">{new Date(sale.sale_date).toLocaleDateString()}</div>
                                                    <div className="text-xs text-muted-foreground">{new Date(sale.sale_date).toLocaleTimeString()}</div>
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs">{sale.bill_number}</td>
                                                <td className="px-4 py-3">
                                                    {sale.students ? (
                                                        <>
                                                            <div className="font-medium text-foreground">{sale.students.full_name}</div>
                                                            <div className="text-xs text-muted-foreground">Adm: {sale.students.admission_number}</div>
                                                        </>
                                                    ) : (
                                                        <span className="text-muted-foreground italic">Walk-in Customer</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="inline-flex items-center justify-center bg-muted px-2 py-1 rounded text-xs font-semibold">
                                                        {sale.inventory_sale_items?.length || 0}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="font-bold text-foreground">{formatCurrency(sale.total_amount)}</div>
                                                    <div className="text-[10px] text-muted-foreground uppercase mt-0.5">{sale.payment_mode}</div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    )
}
