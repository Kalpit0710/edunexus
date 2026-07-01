'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { getErrorMessage, formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Download, CheckCircle, XCircle, UploadCloud } from 'lucide-react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import {
    bulkCreateInventoryItems, getPosClasses,
    type InventoryBulkRow, type PosClass,
} from '../actions'
import type { InventoryCategory } from '@/lib/inventory-utils'

const VALID_CATEGORIES: InventoryCategory[] = ['book', 'uniform', 'stationery', 'sports', 'lab', 'other']

interface ParsedRow {
    name: string
    category: string
    sku: string
    description: string
    unitPrice: number
    costPrice: number | null
    stockQuantity: number
    lowStockAlert: number
    className: string
    classId: string | null
    valid: boolean
    error?: string
}

export default function InventoryImportPage() {
    const { school } = useAuthStore()
    const fileRef = useRef<HTMLInputElement>(null)

    const [classes, setClasses] = useState<PosClass[]>([])
    const [parsed, setParsed] = useState<ParsedRow[]>([])
    const [isParsed, setIsParsed] = useState(false)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!school?.id) return
        getPosClasses(school.id).then(setClasses).catch(() => {})
    }, [school?.id])

    function downloadTemplate() {
        const sampleClass = classes[0]?.name ?? 'Class 10'
        const ws = XLSX.utils.aoa_to_sheet([
            ['name', 'category', 'sku', 'unit_price', 'cost_price', 'stock_quantity', 'low_stock_alert', 'class'],
            ['Mathematics Textbook', 'book', 'BK-MT-10', 450, 300, 100, 10, sampleClass],
            ['A4 Notebook', 'stationery', 'ST-NB-A4', 60, 40, 500, 50, ''],
            ['School Tie', 'uniform', 'UN-TIE', 120, 80, 200, 20, ''],
        ])
        ws['!cols'] = [{ wch: 26 }, { wch: 12 }, { wch: 12 }, { wch: 11 }, { wch: 11 }, { wch: 14 }, { wch: 16 }, { wch: 14 }]
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Inventory')
        XLSX.writeFile(wb, 'inventory_import_template.xlsx')
    }

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !school?.id) return

        try {
            const buffer = await file.arrayBuffer()
            const wb = XLSX.read(buffer, { type: 'array' })
            const ws = wb.Sheets[wb.SheetNames[0]!]!
            const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

            if (data.length === 0) {
                toast.error('The file appears to be empty.')
                return
            }
            if (!('name' in data[0]!) || !('category' in data[0]!)) {
                toast.error('File must include at least "name" and "category" columns.')
                return
            }

            // Match class names case-insensitively.
            const classByName = new Map(classes.map(c => [c.name.trim().toLowerCase(), c]))

            const rows: ParsedRow[] = data.map((raw) => {
                const name = String(raw.name ?? '').trim()
                const category = String(raw.category ?? '').trim().toLowerCase()
                const sku = String(raw.sku ?? '').trim()
                const description = String(raw.description ?? '').trim()
                const unitPrice = Number(raw.unit_price ?? raw.unitPrice ?? 0)
                const costRaw = raw.cost_price ?? raw.costPrice
                const costPrice = costRaw === undefined || costRaw === '' || costRaw === null ? null : Number(costRaw)
                const stockQuantity = Math.max(0, Math.floor(Number(raw.stock_quantity ?? raw.stockQuantity ?? 0)) || 0)
                const lowStockAlert = Math.max(0, Math.floor(Number(raw.low_stock_alert ?? raw.lowStockAlert ?? 10)) || 0)
                const className = String(raw.class ?? '').trim()

                let valid = true
                let error: string | undefined
                let classId: string | null = null

                if (!name) { valid = false; error = 'Missing name' }
                else if (!VALID_CATEGORIES.includes(category as InventoryCategory)) { valid = false; error = `Invalid category "${category}"` }
                else if (!Number.isFinite(unitPrice) || unitPrice < 0) { valid = false; error = 'Invalid unit price' }
                else if (costPrice !== null && (!Number.isFinite(costPrice) || costPrice < 0)) { valid = false; error = 'Invalid cost price' }
                else if (className) {
                    const cls = classByName.get(className.toLowerCase())
                    if (!cls) { valid = false; error = `Unknown class "${className}"` }
                    else classId = cls.id
                }

                return {
                    name, category, sku, description,
                    unitPrice, costPrice, stockQuantity, lowStockAlert,
                    className, classId, valid, error,
                }
            })

            setParsed(rows)
            setIsParsed(true)
        } catch (err) {
            toast.error('Failed to parse file: ' + getErrorMessage(err))
        }
    }

    async function handleImport() {
        const validRows = parsed.filter(r => r.valid)
        if (validRows.length === 0) { toast.error('No valid rows to import.'); return }
        if (!school?.id) return

        setSaving(true)
        try {
            const payload: InventoryBulkRow[] = validRows.map(r => ({
                name: r.name,
                category: r.category as InventoryCategory,
                sku: r.sku || null,
                description: r.description || null,
                unitPrice: r.unitPrice,
                costPrice: r.costPrice,
                stockQuantity: r.stockQuantity,
                lowStockAlert: r.lowStockAlert,
                classId: r.classId,
            }))
            const { inserted } = await bulkCreateInventoryItems(school.id, payload)
            toast.success(`Imported ${inserted} inventory item${inserted === 1 ? '' : 's'}.`)
            setParsed([])
            setIsParsed(false)
            if (fileRef.current) fileRef.current.value = ''
        } catch (e) {
            toast.error(getErrorMessage(e))
        } finally {
            setSaving(false)
        }
    }

    const validCount = parsed.filter(r => r.valid).length
    const invalidCount = parsed.length - validCount

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <Link href={'/manager/inventory' as any}>
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                    <ArrowLeft className="h-4 w-4" /> Back to Inventory
                </Button>
            </Link>

            <div>
                <h2 className="text-2xl font-bold tracking-tight">Import Inventory from Excel</h2>
                <p className="text-muted-foreground">Bulk-add products from an .xlsx spreadsheet.</p>
            </div>

            {/* Step 1 */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Step 1 — Download Template</CardTitle>
                    <CardDescription>Fill this in, one item per row.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    <Button variant="outline" onClick={downloadTemplate}>
                        <Download className="h-4 w-4 mr-2" /> Download Template (.xlsx)
                    </Button>
                    <p className="text-xs text-muted-foreground">
                        Columns: <code className="bg-muted px-1 rounded">name</code>,{' '}
                        <code className="bg-muted px-1 rounded">category</code>,{' '}
                        <code className="bg-muted px-1 rounded">sku</code>,{' '}
                        <code className="bg-muted px-1 rounded">unit_price</code>,{' '}
                        <code className="bg-muted px-1 rounded">cost_price</code>,{' '}
                        <code className="bg-muted px-1 rounded">stock_quantity</code>,{' '}
                        <code className="bg-muted px-1 rounded">low_stock_alert</code>,{' '}
                        <code className="bg-muted px-1 rounded">class</code>
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Category must be one of: {VALID_CATEGORIES.map(c => <code key={c} className="bg-muted px-1 rounded mr-1">{c}</code>)}.
                        Leave <code className="bg-muted px-1 rounded">class</code> blank for a general item, or use an exact class name (e.g. {classes[0]?.name ?? 'Class 10'}) to make it part of that class&apos;s book set.
                    </p>
                </CardContent>
            </Card>

            {/* Step 2 */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Step 2 — Upload File</CardTitle>
                    <CardDescription>Rows are validated before anything is saved.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Input
                        ref={fileRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="max-w-xs"
                        onChange={handleFileChange}
                    />
                </CardContent>
            </Card>

            {/* Preview */}
            {isParsed && (
                <Card>
                    <CardHeader className="border-b pb-3">
                        <CardTitle className="text-base flex items-center gap-4">
                            <span>Preview</span>
                            <span className="inline-flex items-center gap-1 text-sm font-normal text-green-600">
                                <CheckCircle className="h-4 w-4" /> {validCount} valid
                            </span>
                            {invalidCount > 0 && (
                                <span className="inline-flex items-center gap-1 text-sm font-normal text-red-600">
                                    <XCircle className="h-4 w-4" /> {invalidCount} skipped
                                </span>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto max-h-[420px]">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 font-medium"></th>
                                        <th className="px-4 py-2 font-medium">Name</th>
                                        <th className="px-4 py-2 font-medium">Category</th>
                                        <th className="px-4 py-2 font-medium">SKU</th>
                                        <th className="px-4 py-2 font-medium text-right">Price</th>
                                        <th className="px-4 py-2 font-medium text-center">Stock</th>
                                        <th className="px-4 py-2 font-medium">Class</th>
                                        <th className="px-4 py-2 font-medium">Issue</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {parsed.map((r, i) => (
                                        <tr key={i} className={r.valid ? '' : 'bg-red-50 dark:bg-red-950/20'}>
                                            <td className="px-4 py-2">
                                                {r.valid
                                                    ? <CheckCircle className="h-4 w-4 text-green-500" />
                                                    : <XCircle className="h-4 w-4 text-red-500" />}
                                            </td>
                                            <td className="px-4 py-2 font-medium">{r.name || <span className="text-muted-foreground italic">—</span>}</td>
                                            <td className="px-4 py-2 capitalize">{r.category}</td>
                                            <td className="px-4 py-2 text-muted-foreground">{r.sku || '—'}</td>
                                            <td className="px-4 py-2 text-right">{Number.isFinite(r.unitPrice) ? formatCurrency(r.unitPrice) : '—'}</td>
                                            <td className="px-4 py-2 text-center">{r.stockQuantity}</td>
                                            <td className="px-4 py-2">{r.className || <span className="text-muted-foreground">General</span>}</td>
                                            <td className="px-4 py-2 text-red-600 text-xs">{r.error ?? ''}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex items-center justify-between gap-4 border-t p-4">
                            <p className="text-sm text-muted-foreground">
                                {validCount} of {parsed.length} rows will be imported.
                            </p>
                            <Button onClick={handleImport} disabled={saving || validCount === 0}>
                                <UploadCloud className="h-4 w-4 mr-2" />
                                {saving ? 'Importing…' : `Import ${validCount} item${validCount === 1 ? '' : 's'}`}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
