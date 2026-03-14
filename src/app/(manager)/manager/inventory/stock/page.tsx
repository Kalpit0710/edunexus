'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { ArrowLeft, ArrowDownToLine, ArrowUpFromLine, FileEdit, Save, Package } from 'lucide-react'
import Link from 'next/link'
import { getInventoryItems, adjustInventoryStock, type InventoryStockAdjustmentInput } from '../actions'
import type { StockAdjustmentType } from '@/lib/inventory-utils'

const adjustmentTypes: { id: StockAdjustmentType; label: string; icon: any; description: string }[] = [
    { id: 'add', label: 'Add Stock', icon: ArrowDownToLine, description: 'Increase stock (e.g. new delivery)' },
    { id: 'remove', label: 'Remove Stock', icon: ArrowUpFromLine, description: 'Decrease stock (e.g. damaged, lost)' },
    { id: 'adjustment', label: 'Set Exact Count', icon: FileEdit, description: 'Override current stock to a specific number' }
]

export default function StockAdjustmentPage() {
    const router = useRouter()
    const { school } = useAuthStore()

    const [items, setItems] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const [formData, setFormData] = useState<{
        itemId: string,
        quantity: number | '',
        type: StockAdjustmentType,
        reason: string
    }>({
        itemId: '',
        quantity: '',
        type: 'add',
        reason: ''
    })

    useEffect(() => {
        if (school?.id) {
            loadItems()
        }
    }, [school?.id])

    async function loadItems() {
        setLoading(true)
        try {
            const data = await getInventoryItems(school!.id, { activeOnly: true, limit: 1000 })
            setItems(data || [])
        } catch (e: any) {
            toast.error("Failed to load items: " + e.message)
        } finally {
            setLoading(false)
        }
    }

    const updateForm = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const validate = () => {
        if (!formData.itemId) {
            toast.error("Please select an item.")
            return false
        }
        if (formData.quantity === '' || Number(formData.quantity) < 0) {
            toast.error("Please enter a valid positive quantity.")
            return false
        }
        if (formData.type === 'remove') {
            const item = items.find(i => i.id === formData.itemId)
            if (item && Number(formData.quantity) > item.stock_quantity) {
                toast.error("Cannot remove more stock than currently available.")
                return false
            }
        }
        if (!formData.reason.trim()) {
            toast.error("Please provide a reason for this adjustment.")
            return false
        }
        return true
    }

    const handleSubmit = async () => {
        if (!validate()) return
        if (!school?.id) return

        setSaving(true)
        try {
            const payload: InventoryStockAdjustmentInput = {
                itemId: formData.itemId,
                quantity: Number(formData.quantity),
                type: formData.type,
                reason: formData.reason.trim()
            }
            await adjustInventoryStock(school.id, payload)
            toast.success("Stock adjusted successfully!")
            router.push('/manager/inventory' as any)
        } catch (e: any) {
            toast.error("Adjustment failed: " + e.message)
        } finally {
            setSaving(false)
        }
    }

    const selectedItem = items.find(i => i.id === formData.itemId)

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading inventory...</div>
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href={"/manager/inventory" as any}>
                    <Button variant="outline" size="icon">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Adjust Stock</h2>
                    <p className="text-muted-foreground">Manually update inventory quantities.</p>
                </div>
            </div>

            <Card className="shadow-soft">
                <CardHeader>
                    <CardTitle>Adjustment Details</CardTitle>
                    <CardDescription>Select product, adjustment type, and provide a reason for the log.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">

                    <div className="space-y-4">
                        <Label>Select Product <span className="text-destructive">*</span></Label>
                        <select
                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={formData.itemId}
                            onChange={e => updateForm('itemId', e.target.value)}
                        >
                            <option value="" disabled>Search or select an item...</option>
                            {items.map(i => (
                                <option key={i.id} value={i.id}>
                                    {i.name} {i.sku ? `(${i.sku})` : ''} - Current Stock: {i.stock_quantity}
                                </option>
                            ))}
                        </select>

                        {selectedItem && (
                            <div className="bg-muted/30 p-4 rounded-lg flex items-center justify-between border">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Package className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-medium">{selectedItem.name}</p>
                                        <p className="text-xs text-muted-foreground capitalize">{selectedItem.category}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-muted-foreground">Current Stock</p>
                                    <p className="text-xl font-bold">{selectedItem.stock_quantity}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <Label>Adjustment Type <span className="text-destructive">*</span></Label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {adjustmentTypes.map(type => {
                                const Icon = type.icon
                                const isActive = formData.type === type.id
                                return (
                                    <button
                                        key={type.id}
                                        type="button"
                                        onClick={() => updateForm('type', type.id)}
                                        className={`flex flex-col items-start p-4 border rounded-xl transition-all ${isActive
                                            ? 'border-primary ring-1 ring-primary bg-primary/5 shadow-sm'
                                            : 'hover:border-primary/50 hover:bg-muted/50'
                                            }`}
                                    >
                                        <Icon className={`w-5 h-5 mb-2 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                                        <span className={`font-semibold text-sm ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                                            {type.label}
                                        </span>
                                        <span className="text-xs text-muted-foreground text-left mt-1 line-clamp-2">
                                            {type.description}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                        <div className="space-y-2">
                            <Label>
                                {formData.type === 'adjustment' ? 'New Exact Quantity' : 'Quantity to ' + formData.type}
                                <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={formData.quantity}
                                onChange={e => {
                                    const val = e.target.value
                                    updateForm('quantity', val === '' ? '' : parseInt(val))
                                }}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Reason for adjustment <span className="text-destructive">*</span></Label>
                            <Input
                                placeholder="e.g. Damaged during audit, Found missing item"
                                value={formData.reason}
                                onChange={e => updateForm('reason', e.target.value)}
                            />
                        </div>
                    </div>

                </CardContent>
                <CardFooter className="flex justify-between border-t pt-6">
                    <Link href={"/manager/inventory" as any}>
                        <Button variant="outline">Cancel</Button>
                    </Link>
                    <Button onClick={handleSubmit} disabled={saving || !formData.itemId} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-soft">
                        {saving ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Complete Adjustment</>}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
