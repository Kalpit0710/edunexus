'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { getErrorMessage, formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import {
    ArrowLeft, ShoppingCart, Plus, Minus, Trash2, Receipt,
    GraduationCap, Package, User, UserX, BookOpen, ChevronLeft,
} from 'lucide-react'
import Link from 'next/link'
import {
    getInventoryItems, createInventorySale, getPosClasses,
    searchStudentsForPos, getClassPosCatalog, getStudentForPosById,
    type InventorySaleInput, type PosClass, type PosStudent,
} from '../actions'
import { usePermissions } from '@/hooks/use-permissions'
import { LiveSearch } from '@/components/live-search'
import { StudentQrPickerButton } from '@/components/student-qr-picker-button'

type PaymentMode = InventorySaleInput['paymentMode']

interface CatalogItem {
    id: string
    name: string
    sku: string | null
    unit_price: number
    stock_quantity: number
    class_id: string | null
}

interface CartLine {
    itemId: string
    name: string
    unitPrice: number
    quantity: number
    maxStock: number
}

type Stage = 'start' | 'shop' | 'pay'
type SearchMode = 'set' | 'item'

const PAYMENT_MODES: PaymentMode[] = ['cash', 'upi', 'card', 'online']

export default function POSPage() {
    const searchParams = useSearchParams()
    const { school } = useAuthStore()
    const canSell = usePermissions().can('inventory.manage')
    const qrHandledStudentIdRef = useRef<string | null>(null)
    const restoredSnapshotRef = useRef(false)

    const [stage, setStage] = useState<Stage>('start')
    const [searchMode, setSearchMode] = useState<SearchMode>('set')
    const [busy, setBusy] = useState(false)
    const [processing, setProcessing] = useState(false)

    // Reference data
    const [classes, setClasses] = useState<PosClass[]>([])

    // Start-stage inputs
    const [selectedClassId, setSelectedClassId] = useState('')

    // Shop stage
    const [catalog, setCatalog] = useState<CatalogItem[]>([])
    const [catalogLabel, setCatalogLabel] = useState('')
    const [cart, setCart] = useState<CartLine[]>([])

    // Customer / payment
    const [student, setStudent] = useState<PosStudent | null>(null)
    const [guest, setGuest] = useState(false)
    const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash')

    const [successBill, setSuccessBill] = useState<{
        billNumber: string
        totalAmount: number
        cart: CartLine[]
        customerName: string
        paymentMode: PaymentMode
        date: string
    } | null>(null)

    useEffect(() => {
        if (!school?.id) return
        getPosClasses(school.id).then(setClasses).catch(() => {})
    }, [school?.id])

    useEffect(() => {
        if (restoredSnapshotRef.current) return
        if (typeof window === 'undefined') return
        const shouldRestore = searchParams.get('qrResume') === '1'
        if (!shouldRestore) return

        const raw = window.sessionStorage.getItem('pos.qr.snapshot')
        if (!raw) {
            restoredSnapshotRef.current = true
            return
        }

        try {
            const snapshot = JSON.parse(raw) as {
                stage?: Stage
                searchMode?: SearchMode
                selectedClassId?: string
                catalog?: CatalogItem[]
                catalogLabel?: string
                cart?: CartLine[]
                student?: PosStudent | null
                guest?: boolean
                paymentMode?: PaymentMode
            }
            if (snapshot.stage) setStage(snapshot.stage)
            if (snapshot.searchMode) setSearchMode(snapshot.searchMode)
            if (typeof snapshot.selectedClassId === 'string') setSelectedClassId(snapshot.selectedClassId)
            if (Array.isArray(snapshot.catalog)) setCatalog(snapshot.catalog)
            if (typeof snapshot.catalogLabel === 'string') setCatalogLabel(snapshot.catalogLabel)
            if (Array.isArray(snapshot.cart)) setCart(snapshot.cart)
            if (typeof snapshot.guest === 'boolean') setGuest(snapshot.guest)
            if (snapshot.paymentMode) setPaymentMode(snapshot.paymentMode)
            if (snapshot.student !== undefined) setStudent(snapshot.student)
        } catch {
            // Ignore malformed restore payload.
        } finally {
            restoredSnapshotRef.current = true
            window.sessionStorage.removeItem('pos.qr.snapshot')
        }
    }, [searchParams])

    const savePosSnapshotBeforeQr = useCallback(() => {
        if (typeof window === 'undefined') return
        const snapshot = {
            stage,
            searchMode,
            selectedClassId,
            catalog,
            catalogLabel,
            cart,
            student,
            guest,
            paymentMode,
        }
        window.sessionStorage.setItem('pos.qr.snapshot', JSON.stringify(snapshot))
    }, [stage, searchMode, selectedClassId, catalog, catalogLabel, cart, student, guest, paymentMode])

    // ── Cart helpers ──────────────────────────────────────────────────────────
    const addToCart = useCallback((item: CatalogItem, qty = 1) => {
        if (item.stock_quantity <= 0) {
            toast.error(`${item.name} is out of stock.`)
            return
        }
        setCart(prev => {
            const existing = prev.find(l => l.itemId === item.id)
            if (existing) {
                const next = Math.min(existing.quantity + qty, item.stock_quantity)
                if (next === existing.quantity) {
                    toast.error(`Only ${item.stock_quantity} of ${item.name} in stock.`)
                    return prev
                }
                return prev.map(l => l.itemId === item.id ? { ...l, quantity: next } : l)
            }
            return [...prev, {
                itemId: item.id,
                name: item.name,
                unitPrice: Number(item.unit_price),
                quantity: Math.min(qty, item.stock_quantity),
                maxStock: item.stock_quantity,
            }]
        })
    }, [])

    const updateQty = (itemId: string, delta: number) => {
        setCart(prev => prev.map(l => {
            if (l.itemId !== itemId) return l
            const next = l.quantity + delta
            if (next < 1) return l // use trash to remove
            if (next > l.maxStock) {
                toast.error(`Only ${l.maxStock} in stock.`)
                return l
            }
            return { ...l, quantity: next }
        }))
    }

    const removeLine = (itemId: string) => setCart(prev => prev.filter(l => l.itemId !== itemId))

    const cartTotal = cart.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)

    // ── Debounced live-search fetchers (memoized so the dropdown effect is stable) ──
    const studentFetcher = useCallback(
        (q: string): Promise<PosStudent[]> =>
            school?.id ? searchStudentsForPos(school.id, q) : Promise.resolve([]),
        [school?.id],
    )
    const itemFetcher = useCallback(
        (q: string): Promise<CatalogItem[]> =>
            school?.id
                ? (getInventoryItems(school.id, { search: q, activeOnly: true, limit: 20 }) as Promise<CatalogItem[]>)
                : Promise.resolve([]),
        [school?.id],
    )

    // ── Start-stage actions ───────────────────────────────────────────────────
    const loadSet = useCallback(async (classId: string, forStudent: PosStudent | null, label: string) => {
        if (!school?.id) return
        setBusy(true)
        try {
            // Class-tagged book-set items PLUS general items (class_id NULL).
            const items = await getClassPosCatalog(school.id, classId) as CatalogItem[]
            const setItems = items.filter(i => i.class_id === classId)
            if (setItems.length === 0) {
                toast.warning(`No book set configured for ${label} yet. General items are shown below — add what you need.`)
            }
            setCatalog(items)
            setCatalogLabel(`${label} — book set + general items`)
            // Pre-fill the cart with the class's in-stock book-set items only.
            const prefill: CartLine[] = setItems
                .filter(i => i.stock_quantity > 0)
                .map(i => ({
                    itemId: i.id,
                    name: i.name,
                    unitPrice: Number(i.unit_price),
                    quantity: 1,
                    maxStock: i.stock_quantity,
                }))
            setCart(prefill)
            setStudent(forStudent)
            setGuest(false)
            setStage('shop')
        } catch (e) {
            toast.error(getErrorMessage(e))
        } finally {
            setBusy(false)
        }
    }, [school?.id])

    const handleSelectStudentSet = useCallback(async (found: PosStudent) => {
        if (!found.classId) {
            toast.error(`${found.fullName} has no class assigned.`)
            return
        }
        await loadSet(found.classId, found, `${found.fullName} (${found.className}${found.sectionName ? '-' + found.sectionName : ''})`)
    }, [loadSet])

    const handleLoadClass = async () => {
        if (!selectedClassId) { toast.error('Select a class.'); return }
        const cls = classes.find(c => c.id === selectedClassId)
        await loadSet(selectedClassId, null, cls?.name ?? 'Class')
    }

    // Single-item mode: picking an item starts a sale with it in the cart.
    const handleStartWithItem = (item: CatalogItem) => {
        if (item.stock_quantity <= 0) { toast.error(`${item.name} is out of stock.`); return }
        setCatalog([item])
        setCatalogLabel('Single items')
        setCart([{
            itemId: item.id,
            name: item.name,
            unitPrice: Number(item.unit_price),
            quantity: 1,
            maxStock: item.stock_quantity,
        }])
        setStudent(null)
        setGuest(false)
        setStage('shop')
    }

    // ── Shop-stage: add more items on the fly ─────────────────────────────────
    const handleAddItem = (item: CatalogItem) => {
        setCatalog(prev => (prev.some(i => i.id === item.id) ? prev : [...prev, item]))
        addToCart(item)
    }

    // ── Pay-stage: attach a student ───────────────────────────────────────────
    const handleSelectPayStudent = useCallback((found: PosStudent) => {
        setStudent(found)
        setGuest(false)
    }, [])

    useEffect(() => {
        const studentId = searchParams.get('studentId')
        const qrTarget = searchParams.get('qrTarget')
        if (!school?.id || !studentId || qrHandledStudentIdRef.current === studentId) return

        qrHandledStudentIdRef.current = studentId
        void (async () => {
            try {
                const found = await getStudentForPosById(school.id, studentId)
                if (!found) {
                    toast.error('Scanned student not found in this school.')
                    return
                }

                if (qrTarget === 'pay') {
                    setStage('pay')
                    handleSelectPayStudent(found)
                } else {
                    await handleSelectStudentSet(found)
                }
                toast.success(`Selected ${found.fullName} from QR scan.`)
                const cleanUrl = '/manager/inventory/pos'
                window.history.replaceState(null, '', cleanUrl)
            } catch (e) {
                toast.error(getErrorMessage(e))
            }
        })()
    }, [searchParams, school?.id, handleSelectPayStudent, handleSelectStudentSet])

    // ── Checkout ──────────────────────────────────────────────────────────────
    const handleCheckout = async () => {
        if (!school?.id || cart.length === 0) return
        if (!student && !guest) {
            toast.error('Select a student or choose guest billing.')
            return
        }
        setProcessing(true)
        try {
            const payload: InventorySaleInput = {
                studentId: student?.id ?? null,
                paymentMode,
                items: cart.map(l => ({ itemId: l.itemId, quantity: l.quantity, unitPrice: l.unitPrice })),
            }
            const result = await createInventorySale(school.id, payload)
            setSuccessBill({
                billNumber: result.billNumber,
                totalAmount: result.totalAmount,
                cart: [...cart],
                customerName: student ? student.fullName : 'Walk-in / Guest',
                paymentMode,
                date: new Date().toLocaleDateString(),
            })
            toast.success('Sale completed.')
        } catch (e) {
            toast.error('Checkout failed: ' + getErrorMessage(e))
        } finally {
            setProcessing(false)
        }
    }

    const resetAll = () => {
        setSuccessBill(null)
        setStage('start')
        setSearchMode('set')
        setSelectedClassId('')
        setCatalog([]); setCatalogLabel(''); setCart([])
        setStudent(null); setGuest(false)
        setPaymentMode('cash')
    }

    // ── Receipt ───────────────────────────────────────────────────────────────
    if (successBill) {
        return (
            <div className="max-w-md mx-auto mt-8">
                <Card className="border-t-4 border-t-green-500 shadow-xl overflow-hidden print-area">
                    <CardHeader className="text-center pb-2 bg-muted/20">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Receipt className="w-8 h-8" />
                        </div>
                        <CardTitle className="text-2xl font-bold">Payment Successful</CardTitle>
                        <p className="text-muted-foreground">Bill No: {successBill.billNumber}</p>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="grid grid-cols-2 gap-y-2 text-sm">
                            <span className="text-muted-foreground">Date:</span>
                            <span className="text-right font-medium">{successBill.date}</span>
                            <span className="text-muted-foreground">Customer:</span>
                            <span className="text-right font-medium">{successBill.customerName}</span>
                            <span className="text-muted-foreground">Payment Mode:</span>
                            <span className="text-right font-medium capitalize">{successBill.paymentMode}</span>
                        </div>
                        <div className="border-t border-dashed pt-4">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-muted-foreground">
                                        <th className="text-left font-medium pb-2">Item</th>
                                        <th className="text-right font-medium pb-2">Qty</th>
                                        <th className="text-right font-medium pb-2">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {successBill.cart.map((l, i) => (
                                        <tr key={i}>
                                            <td className="py-1 break-words pr-2">{l.name}</td>
                                            <td className="py-1 text-right">{l.quantity}</td>
                                            <td className="py-1 text-right">{formatCurrency(l.unitPrice * l.quantity)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="border-t border-dashed pt-4 flex justify-between items-center">
                            <span className="text-lg font-bold">Total Amount</span>
                            <span className="text-2xl font-bold text-primary">{formatCurrency(successBill.totalAmount)}</span>
                        </div>
                    </CardContent>
                    <CardFooter className="bg-muted/30 p-4 border-t gap-3 print:hidden flex-col sm:flex-row">
                        <Button variant="outline" className="w-full" onClick={() => window.print()}>Print Receipt</Button>
                        <Button className="w-full" onClick={resetAll}>New Sale</Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    // ── Header ────────────────────────────────────────────────────────────────
    const header = (
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" aria-label="Go back" onClick={resetAll}>
                <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Bookstore — Point of Sale</h2>
                <p className="text-sm text-muted-foreground">Sell a class book set or individual items</p>
            </div>
        </div>
    )

    // ── Stage: START (search only) ────────────────────────────────────────────
    if (stage === 'start') {
        return (
            <div className="relative w-full flex min-h-[calc(100vh-6rem)] items-center justify-center p-6">
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    {/* Flowey abstract background */}
                    <div className="absolute top-[10%] right-[10%] h-[400px] w-[400px] rounded-full bg-blue-500/10 blur-[100px] mix-blend-screen" />
                    <div className="absolute bottom-[10%] left-[5%] h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[120px] mix-blend-screen" />
                    <div className="absolute -bottom-[5%] right-[20%] h-[300px] w-[300px] rounded-full bg-purple-500/10 blur-[100px] mix-blend-screen" />
                    {/* Subtle grid */}
                    <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`, backgroundSize: '48px 48px' }} />
                </div>

                <div className="relative z-10 w-full max-w-xl space-y-8">
                    <div className="text-center relative">
                        <Link href={"/manager/inventory" as never}>
                            <Button variant="ghost" size="sm" className="absolute -top-6 -left-4 gap-1 text-muted-foreground"><ArrowLeft className="w-4 h-4" /> Back</Button>
                        </Link>
                        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-emerald-600/20 to-blue-600/20 shadow-inner ring-1 ring-white/10 relative overflow-hidden backdrop-blur-xl">
                            <div className="absolute inset-0 bg-emerald-500/10 blur-xl" />
                            <ShoppingCart className="h-10 w-10 text-emerald-400 relative z-10" />
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-3">Point of Sale</h1>
                        <p className="text-zinc-400/80 text-lg max-w-md mx-auto">
                            Start a new sale by loading a student&apos;s book set or scanning individual items.
                        </p>
                    </div>

                    <Card className="shadow-2xl border-white/[0.08] bg-white/[0.02] backdrop-blur-xl">
                    <CardHeader className="pb-2">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setSearchMode('set')}
                                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-semibold transition-colors ${searchMode === 'set' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground hover:bg-muted'}`}
                            >
                                <GraduationCap className="w-4 h-4" /> Class / Student book set
                            </button>
                            <button
                                onClick={() => setSearchMode('item')}
                                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-semibold transition-colors ${searchMode === 'item' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground hover:bg-muted'}`}
                            >
                                <Package className="w-4 h-4" /> Single item
                            </button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-5 pt-4">
                        {searchMode === 'set' ? (
                            <>
                                <div className="space-y-2">
                                    <Label>Find by student (admission no. or name)</Label>
                                    <div className="flex gap-2">
                                        <LiveSearch<PosStudent>
                                            placeholder="Start typing e.g. ADM-1024 or Aarav Sharma"
                                            fetcher={studentFetcher}
                                            getKey={(s) => s.id}
                                            onSelect={handleSelectStudentSet}
                                            autoFocus
                                            className="flex-1"
                                            renderItem={(s) => (
                                                <span className="flex flex-col">
                                                    <span className="font-medium">{s.fullName}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {s.admissionNumber}{s.className ? ` · ${s.className}${s.sectionName ? '-' + s.sectionName : ''}` : ''}
                                                    </span>
                                                </span>
                                            )}
                                        />
                                        <StudentQrPickerButton
                                            scanPath="/manager/qr-scan"
                                            returnToPath="/manager/inventory/pos"
                                            returnParams={{ qrTarget: 'set', qrResume: '1' }}
                                            onBeforeNavigate={savePosSnapshotBeforeQr}
                                            label="Scan QR"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <div className="h-px flex-1 bg-border" /> OR PICK A CLASS <div className="h-px flex-1 bg-border" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Class</Label>
                                    <div className="flex gap-2">
                                        <select
                                            className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={selectedClassId}
                                            onChange={e => setSelectedClassId(e.target.value)}
                                        >
                                            <option value="">Select a class…</option>
                                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        <Button variant="secondary" onClick={handleLoadClass} disabled={busy || !selectedClassId}>
                                            <BookOpen className="w-4 h-4 mr-2" /> Load set
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Loads that class&apos;s book set (auto-added) plus general items; adjust before payment.</p>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-2">
                                <Label>Search item by name or SKU</Label>
                                <LiveSearch<CatalogItem>
                                    placeholder="Start typing e.g. Pencil, Notebook, BK-MT-10"
                                    fetcher={itemFetcher}
                                    getKey={(i) => i.id}
                                    onSelect={handleStartWithItem}
                                    autoFocus
                                    renderItem={(i) => (
                                        <span className="flex w-full items-center justify-between gap-3">
                                            <span className="flex flex-col">
                                                <span className="font-medium">{i.name}</span>
                                                <span className="text-xs text-muted-foreground">{i.sku || 'No SKU'}</span>
                                            </span>
                                            <span className="text-xs font-semibold shrink-0">
                                                {formatCurrency(Number(i.unit_price))} · {i.stock_quantity} left
                                            </span>
                                        </span>
                                    )}
                                />
                                <p className="text-xs text-muted-foreground">For quick single-item sales like a pencil or a notebook.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
                </div>
            </div>
        )
    }

    // ── Stage: SHOP / PAY (catalog + cart) ────────────────────────────────────
    return (
        <div className="h-[calc(100vh-6rem)] flex flex-col space-y-4">
            <div className="flex items-center justify-between gap-4 flex-none">
                {header}
                <Button variant="ghost" size="sm" onClick={resetAll}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Start over
                </Button>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
                {/* Left: catalog */}
                <Card className="lg:col-span-7 flex flex-col h-full overflow-hidden border-border/50">
                    <CardHeader className="pb-3 border-b bg-muted/20 flex-none space-y-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">{catalogLabel || 'Catalog'}</CardTitle>
                            <span className="text-xs text-muted-foreground">{catalog.length} items</span>
                        </div>
                        <LiveSearch<CatalogItem>
                            placeholder="Add more items — search name or SKU…"
                            fetcher={itemFetcher}
                            getKey={(i) => i.id}
                            onSelect={handleAddItem}
                            renderItem={(i) => (
                                <span className="flex w-full items-center justify-between gap-3">
                                    <span className="flex flex-col">
                                        <span className="font-medium">{i.name}</span>
                                        <span className="text-xs text-muted-foreground">{i.sku || 'No SKU'}</span>
                                    </span>
                                    <span className="text-xs font-semibold shrink-0">
                                        {formatCurrency(Number(i.unit_price))} · {i.stock_quantity} left
                                    </span>
                                </span>
                            )}
                        />
                    </CardHeader>
                    <CardContent className="p-4 flex-1 overflow-y-auto bg-muted/5">
                        {catalog.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
                                <Package className="w-10 h-10 mb-3 opacity-40" />
                                <p className="text-sm">No items here yet. Use the search above to add items.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {catalog.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => addToCart(item)}
                                        disabled={item.stock_quantity <= 0}
                                        className={`relative text-left flex flex-col h-full bg-card rounded-xl border p-3 transition-all hover:shadow-md hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 ${item.stock_quantity <= 0 ? 'opacity-50 grayscale cursor-not-allowed' : 'active:scale-[0.98]'}`}
                                    >
                                        <div className="flex-1 space-y-1">
                                            <p className="font-semibold text-sm text-foreground line-clamp-2 leading-tight">{item.name}</p>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                                <span>{item.sku || 'No SKU'}</span>
                                                {!item.class_id && (
                                                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">General</span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="mt-3 flex items-end justify-between">
                                            <div className="font-bold text-primary">{formatCurrency(Number(item.unit_price))}</div>
                                            <div className={`text-xs font-semibold px-2 py-0.5 rounded ${item.stock_quantity > 0 ? 'bg-secondary text-secondary-foreground' : 'bg-red-100 text-red-700'}`}>
                                                {item.stock_quantity} left
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Right: cart + payment */}
                <Card className="lg:col-span-5 flex flex-col h-full overflow-hidden border-border/50 relative">
                    <CardHeader className="bg-primary/5 pb-4 border-b flex-none">
                        <CardTitle className="text-lg flex items-center justify-between">
                            <span className="flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> Order</span>
                            <span className="bg-primary text-primary-foreground text-xs font-bold px-2.5 py-1 rounded-full">{cart.length} lines</span>
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="p-0 flex-1 overflow-y-auto">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 opacity-60">
                                <ShoppingCart className="w-12 h-12 mb-4 opacity-50" />
                                <p className="text-sm">Tap items on the left to add them</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-border/50">
                                {cart.map(l => (
                                    <li key={l.itemId} className="p-4 flex gap-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm truncate">{l.name}</p>
                                            <p className="text-xs text-muted-foreground">{formatCurrency(l.unitPrice)} each</p>
                                        </div>
                                        <div className="flex flex-col items-end justify-between gap-2 shrink-0">
                                            <p className="font-bold text-sm">{formatCurrency(l.unitPrice * l.quantity)}</p>
                                            <div className="flex items-center gap-1 border rounded-md h-8 bg-background">
                                                <button onClick={() => updateQty(l.itemId, -1)} className="w-8 h-full flex items-center justify-center text-muted-foreground hover:bg-muted"><Minus className="w-3 h-3" /></button>
                                                <div className="w-8 text-center text-sm font-semibold">{l.quantity}</div>
                                                <button onClick={() => updateQty(l.itemId, 1)} className="w-8 h-full flex items-center justify-center text-muted-foreground hover:bg-muted border-l"><Plus className="w-3 h-3" /></button>
                                                <button onClick={() => removeLine(l.itemId)} className="w-8 h-full flex items-center justify-center text-red-500 hover:bg-red-50 border-l"><Trash2 className="w-3 h-3" /></button>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>

                    <div className="border-t bg-muted/10 flex-none p-4 space-y-4">
                        {stage === 'shop' ? (
                            <>
                                <div className="flex items-end justify-between">
                                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Total</span>
                                    <span className="text-3xl font-black text-primary">{formatCurrency(cartTotal)}</span>
                                </div>
                                <Button className="w-full h-12 text-base font-bold" disabled={cart.length === 0} onClick={() => setStage('pay')}>
                                    Proceed to Payment
                                </Button>
                            </>
                        ) : (
                            <>
                                {/* Customer */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</Label>
                                    {student ? (
                                        <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold truncate">{student.fullName}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{student.admissionNumber} · {student.className}{student.sectionName ? '-' + student.sectionName : ''}</p>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => setStudent(null)}>Change</Button>
                                        </div>
                                    ) : guest ? (
                                        <div className="flex items-center justify-between rounded-lg border border-dashed bg-background px-3 py-2">
                                            <span className="flex items-center gap-2 text-sm font-medium"><UserX className="w-4 h-4 text-muted-foreground" /> Guest billing</span>
                                            <Button variant="ghost" size="sm" onClick={() => setGuest(false)}>Undo</Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="flex gap-2">
                                                <LiveSearch<PosStudent>
                                                    placeholder="Search student — admission no. or name"
                                                    fetcher={studentFetcher}
                                                    getKey={(s) => s.id}
                                                    onSelect={handleSelectPayStudent}
                                                    className="flex-1"
                                                    renderItem={(s) => (
                                                        <span className="flex flex-col">
                                                            <span className="font-medium">{s.fullName}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {s.admissionNumber}{s.className ? ` · ${s.className}${s.sectionName ? '-' + s.sectionName : ''}` : ''}
                                                            </span>
                                                        </span>
                                                    )}
                                                />
                                                <StudentQrPickerButton
                                                    scanPath="/manager/qr-scan"
                                                    returnToPath="/manager/inventory/pos"
                                                    returnParams={{ qrTarget: 'pay', qrResume: '1' }}
                                                    onBeforeNavigate={savePosSnapshotBeforeQr}
                                                    label="Scan QR"
                                                />
                                            </div>
                                            <button onClick={() => setGuest(true)} className="text-xs text-muted-foreground underline hover:text-foreground">
                                                No student? Bill as guest
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Payment mode */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment Mode</Label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {PAYMENT_MODES.map(mode => (
                                            <button
                                                key={mode}
                                                onClick={() => setPaymentMode(mode)}
                                                className={`py-2 text-xs font-semibold rounded-md border capitalize transition-colors ${paymentMode === mode ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground hover:bg-muted'}`}
                                            >
                                                {mode}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-end justify-between border-t pt-3">
                                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Total</span>
                                    <span className="text-3xl font-black text-primary">{formatCurrency(cartTotal)}</span>
                                </div>

                                <div className="flex gap-2">
                                    <Button variant="outline" className="h-12" onClick={() => setStage('shop')}>
                                        <ChevronLeft className="w-4 h-4" /> Edit
                                    </Button>
                                    <Button
                                        className="flex-1 h-12 text-base font-bold"
                                        disabled={cart.length === 0 || processing || !canSell || (!student && !guest)}
                                        onClick={handleCheckout}
                                    >
                                        {processing ? 'Processing…' : 'Charge & Print Bill'}
                                    </Button>
                                </div>
                                {!canSell && <p className="text-xs text-destructive text-center">You don&apos;t have permission to record sales.</p>}
                            </>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    )
}
