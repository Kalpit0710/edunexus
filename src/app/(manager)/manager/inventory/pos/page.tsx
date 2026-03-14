'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { ArrowLeft, ShoppingCart, Plus, Minus, Trash2, Search, Receipt, CreditCard, Banknote } from 'lucide-react'
import Link from 'next/link'
import { getInventoryItems, createInventorySale, type InventorySaleInput } from '../actions'
import { getStudents } from '@/app/(school-admin)/school-admin/students/actions'
import { formatCurrency } from '@/lib/utils'
import { type InventoryCartItem } from '@/lib/inventory-utils'

type PaymentMode = InventorySaleInput['paymentMode']

export default function POSPage() {
    const { school } = useAuthStore()

    const [items, setItems] = useState<any[]>([])
    const [students, setStudents] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)

    // POS State
    const [cart, setCart] = useState<(InventoryCartItem & { name: string, maxStock: number })[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedStudentId, setSelectedStudentId] = useState<string>('')
    const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash')
    const [successBill, setSuccessBill] = useState<any>(null)

    useEffect(() => {
        if (school?.id) {
            loadInitialData()
        }
    }, [school?.id])

    async function loadInitialData() {
        setLoading(true)
        try {
            const [fetchedItems, fetchedStudents] = await Promise.all([
                getInventoryItems(school!.id, { activeOnly: true, limit: 1000 }),
                getStudents(school!.id)
            ])
            setItems(fetchedItems || [])
            setStudents(fetchedStudents || [])
        } catch (e: any) {
            toast.error("Failed to load POS data: " + e.message)
        } finally {
            setLoading(false)
        }
    }

    const addToCart = (item: any) => {
        setCart(prev => {
            const existing = prev.find(i => i.itemId === item.id)
            if (existing) {
                if (existing.quantity >= item.stock_quantity) {
                    toast.error(`Cannot add more. Only ${item.stock_quantity} available.`)
                    return prev
                }
                return prev.map(i => i.itemId === item.id ? { ...i, quantity: i.quantity + 1 } : i)
            }
            if (item.stock_quantity === 0) {
                toast.error("Item is out of stock.")
                return prev
            }
            return [...prev, {
                itemId: item.id,
                quantity: 1,
                unitPrice: item.unit_price,
                name: item.name,
                maxStock: item.stock_quantity
            }]
        })
    }

    const updateQuantity = (itemId: string, change: number) => {
        setCart(prev => prev.map(item => {
            if (item.itemId === itemId) {
                const newQ = item.quantity + change
                if (newQ > item.maxStock) {
                    toast.error(`Only ${item.maxStock} available in stock.`)
                    return item
                }
                if (newQ < 1) return item
                return { ...item, quantity: newQ }
            }
            return item
        }))
    }

    const removeFromCart = (itemId: string) => {
        setCart(prev => prev.filter(i => i.itemId !== itemId))
    }

    const cartTotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)

    const handleCheckout = async () => {
        if (cart.length === 0) {
            toast.error("Cart is empty.")
            return
        }
        if (!school?.id) return

        setProcessing(true)
        try {
            const payload: InventorySaleInput = {
                studentId: selectedStudentId || null,
                paymentMode: paymentMode,
                items: cart.map(c => ({
                    itemId: c.itemId,
                    quantity: c.quantity,
                    unitPrice: c.unitPrice
                }))
            }

            const result = await createInventorySale(school.id, payload)
            toast.success("Sale completed successfully!")

            setSuccessBill({
                ...result,
                cart: [...cart],
                paymentMode,
                studentName: selectedStudentId ? students.find(s => s.id === selectedStudentId)?.full_name : 'Walk-in Customer',
                date: new Date().toLocaleDateString()
            })
            setCart([])
            // Refresh inventory items to reflect new stock
            loadInitialData()
        } catch (e: any) {
            toast.error("Checkout failed: " + e.message)
        } finally {
            setProcessing(false)
        }
    }

    const resetPOS = () => {
        setSuccessBill(null)
        setSelectedStudentId('')
        setSearchQuery('')
        setPaymentMode('cash')
    }

    const filteredCatalog = items.filter(i =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (i.sku && i.sku.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Initializing Point of Sale...</div>
    }

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
                            <span className="text-right font-medium">{successBill.studentName || '-'}</span>
                            <span className="text-muted-foreground">Payment Mode:</span>
                            <span className="text-right font-medium capitalize flex items-center justify-end gap-1">
                                {successBill.paymentMode === 'cash' ? <Banknote className="w-3.5 h-3.5 text-muted-foreground" /> : <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />}
                                {successBill.paymentMode}
                            </span>
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
                                    {successBill.cart.map((item: any, i: number) => (
                                        <tr key={i}>
                                            <td className="py-1 break-words pr-2">{item.name}</td>
                                            <td className="py-1 text-right">{item.quantity}</td>
                                            <td className="py-1 text-right">{formatCurrency(item.unitPrice * item.quantity)}</td>
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
                        <Button variant="outline" className="w-full" onClick={() => window.print()}>
                            Print Receipt
                        </Button>
                        <Button className="w-full" onClick={resetPOS}>
                            New Sale
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    return (
        <div className="h-[calc(100vh-6rem)] flex flex-col space-y-4">
            <div className="flex items-center gap-4 flex-none">
                <Link href={"/manager/inventory" as any}>
                    <Button variant="outline" size="icon">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Point of Sale</h2>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
                {/* Left Side: Product Catalog */}
                <Card className="lg:col-span-8 shadow-soft flex flex-col h-full overflow-hidden border-border/50">
                    <CardHeader className="pb-3 border-b bg-muted/20 flex-none space-y-4">
                        <div className="flex gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                <Input
                                    className="pl-9 h-11 text-base bg-background shadow-sm rounded-xl"
                                    placeholder="Search catalog by product name or SKU..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 flex-1 overflow-y-auto overflow-x-hidden bg-muted/5">
                        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredCatalog.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => addToCart(item)}
                                    disabled={item.stock_quantity === 0}
                                    className={`relative text-left flex flex-col h-full bg-card rounded-xl border p-3 md:p-4 transition-all hover:shadow-md hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
                                        ${item.stock_quantity === 0 ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'}`}
                                >
                                    <div className="flex-1 space-y-1">
                                        <p className="font-semibold text-foreground line-clamp-2 leading-tight">{item.name}</p>
                                        <p className="text-xs text-muted-foreground">{item.sku || 'No SKU'}</p>
                                    </div>
                                    <div className="mt-4 flex items-end justify-between">
                                        <div className="font-bold text-lg text-primary">{formatCurrency(item.unit_price)}</div>
                                        <div className={`text-xs font-semibold px-2 py-0.5 rounded-sm ${item.stock_quantity > 0 ? 'bg-secondary text-secondary-foreground' : 'bg-red-100 text-red-700'}`}>
                                            {item.stock_quantity} Left
                                        </div>
                                    </div>

                                    {item.stock_quantity === 0 && (
                                        <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-xl backdrop-blur-[1px]">
                                            <span className="bg-destructive text-destructive-foreground text-xs font-bold px-3 py-1 rounded-full shadow-sm">OUT OF STOCK</span>
                                        </div>
                                    )}
                                </button>
                            ))}
                            {filteredCatalog.length === 0 && (
                                <div className="col-span-full py-12 text-center text-muted-foreground">
                                    No products found matching {searchQuery}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Right Side: Cart & Checkout */}
                <Card className="lg:col-span-4 shadow-soft flex flex-col h-full overflow-hidden border-border/50 bg-card relative">
                    <CardHeader className="bg-primary/5 pb-4 border-b flex-none">
                        <div className="flex items-center justify-between mb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5" /> Current Order
                            </CardTitle>
                            <span className="bg-primary text-primary-foreground text-xs font-bold px-2.5 py-1 rounded-full">{cart.length} items</span>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Customer Info (Optional)</Label>
                            <select
                                className="flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background/50 px-3 py-2 text-sm shadow-sm"
                                value={selectedStudentId}
                                onChange={e => setSelectedStudentId(e.target.value)}
                            >
                                <option value="">Walk-in Customer (Guest)</option>
                                <optgroup label="Select Student">
                                    {students.map(s => (
                                        <option key={s.id} value={s.id}>{s.full_name} ({s.admission_number})</option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>
                    </CardHeader>

                    <CardContent className="p-0 flex-1 overflow-y-auto">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 opacity-60">
                                <ShoppingCart className="w-12 h-12 mb-4 text-muted/50" />
                                <p>Scan or select items from catalog</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-border/50">
                                {cart.map(item => (
                                    <li key={item.itemId} className="p-4 hover:bg-muted/10 transition-colors flex gap-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm truncate">{item.name}</p>
                                            <p className="text-xs text-muted-foreground">{formatCurrency(item.unitPrice)} each</p>
                                        </div>
                                        <div className="flex flex-col items-end justify-between gap-2 shrink-0">
                                            <p className="font-bold text-sm">{formatCurrency(item.unitPrice * item.quantity)}</p>
                                            <div className="flex items-center gap-1 border rounded-md shadow-sm h-8 bg-background">
                                                <button
                                                    onClick={() => updateQuantity(item.itemId, -1)}
                                                    className="w-8 h-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/80 disabled:opacity-30 transition-colors"
                                                >
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <div className="w-8 text-center text-sm font-semibold selection:bg-transparent cursor-default">
                                                    {item.quantity}
                                                </div>
                                                <button
                                                    onClick={() => updateQuantity(item.itemId, 1)}
                                                    className="w-8 h-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/80 disabled:opacity-30 transition-colors border-l"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => removeFromCart(item.itemId)}
                                                    className="w-8 h-full flex items-center justify-center text-red-500 hover:bg-red-50 hover:text-red-600 active:bg-red-100 transition-colors border-l"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>

                    <div className="border-t bg-muted/10 flex-none z-10 p-4 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Payment Mode</Label>
                            <div className="grid grid-cols-4 gap-2">
                                {['cash', 'upi', 'card', 'online'].map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => setPaymentMode(mode as PaymentMode)}
                                        className={`py-2 px-1 text-xs font-semibold rounded-md border text-center capitalize transition-colors
                                            ${paymentMode === mode ? 'bg-primary text-primary-foreground border-primary shadow-sm ring-1 ring-primary/30 ring-offset-1' : 'bg-card text-muted-foreground hover:bg-muted hover:border-muted-foreground/30'}`}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-end justify-between py-2 border-t pt-4">
                            <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Total</span>
                            <span className="text-3xl font-black text-primary tracking-tight leading-none">{formatCurrency(cartTotal)}</span>
                        </div>

                        <Button
                            className="w-full h-14 text-lg font-bold shadow-lg hover:shadow-xl transition-all"
                            disabled={cart.length === 0 || processing}
                            onClick={handleCheckout}
                        >
                            {processing ? "Processing Payment..." : "Charge & Print Bill"}
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    )
}
