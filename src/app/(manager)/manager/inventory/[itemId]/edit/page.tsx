'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { ArrowLeft, Save, ShieldBan, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { updateInventoryItem, setInventoryItemActive, type InventoryItemInput } from '../../actions'
import { createClient } from '@/lib/supabase/client'
import type { InventoryCategory } from '@/lib/inventory-utils'

const categories: { label: string, value: InventoryCategory }[] = [
    { label: 'Books', value: 'book' },
    { label: 'Uniforms', value: 'uniform' },
    { label: 'Stationery', value: 'stationery' },
    { label: 'Sports', value: 'sports' },
    { label: 'Lab', value: 'lab' },
    { label: 'Other', value: 'other' }
]

export default function EditInventoryItemPage() {
    const params = useParams()
    const itemId = params.itemId as string
    const router = useRouter()
    const { school } = useAuthStore()

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [isActive, setIsActive] = useState(true)

    const [formData, setFormData] = useState<Partial<InventoryItemInput>>({
        name: '',
        category: 'book',
        sku: '',
        description: '',
        unitPrice: 0,
        costPrice: 0,
        stockQuantity: 0,
        lowStockAlert: 10
    })

    useEffect(() => {
        if (school?.id && itemId) {
            loadItem()
        }
    }, [school?.id, itemId])

    async function loadItem() {
        setLoading(true)
        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('inventory_items')
                .select('*')
                .eq('school_id', school!.id)
                .eq('id', itemId)
                .single()

            if (error) throw error

            const item = data as any;

            setFormData({
                name: item.name,
                category: item.category as InventoryCategory,
                sku: item.sku || '',
                description: item.description || '',
                unitPrice: Number(item.unit_price),
                costPrice: item.cost_price ? Number(item.cost_price) : 0,
                stockQuantity: Number(item.stock_quantity),
                lowStockAlert: Number(item.low_stock_alert),
            })
            setIsActive(item.is_active)
        } catch (e: any) {
            toast.error("Failed to load item: " + e.message)
            router.push('/manager/inventory' as any)
        } finally {
            setLoading(false)
        }
    }

    const updateForm = (field: keyof InventoryItemInput, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const validate = () => {
        if (!formData.name?.trim()) {
            toast.error("Item Name is required.")
            return false
        }
        if (!formData.category) {
            toast.error("Category is required.")
            return false
        }
        if (formData.unitPrice === undefined || formData.unitPrice < 0) {
            toast.error("Unit Price cannot be negative.")
            return false
        }
        if (formData.costPrice !== undefined && formData.costPrice !== null && formData.costPrice < 0) {
            toast.error("Cost Price cannot be negative.")
            return false
        }
        if (formData.stockQuantity !== undefined && formData.stockQuantity < 0) {
            toast.error("Stock cannot be negative.")
            return false
        }
        return true
    }

    const handleSubmit = async () => {
        if (!validate()) return
        if (!school?.id) return

        setSaving(true)
        try {
            await updateInventoryItem(school.id, itemId, formData as InventoryItemInput)
            toast.success("Inventory item updated successfully!")
            router.push('/manager/inventory' as any)
        } catch (e: any) {
            toast.error("Update failed: " + e.message)
        } finally {
            setSaving(false)
        }
    }

    const handleToggleActive = async () => {
        if (!school?.id) return
        const newStatus = !isActive
        if (!confirm(`Are you sure you want to ${newStatus ? 'activate' : 'deactivate'} this item? ${!newStatus ? 'It will no longer appear in POS.' : ''}`)) return

        setSaving(true)
        try {
            await setInventoryItemActive(school.id, itemId, newStatus)
            setIsActive(newStatus)
            toast.success(`Item has been ${newStatus ? 'activated' : 'deactivated'}.`)
        } catch (e: any) {
            toast.error("Status update failed: " + e.message)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading item details...</div>
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
                    <h2 className="text-2xl font-bold tracking-tight">Edit Item</h2>
                    <p className="text-muted-foreground">Modify product details or update exact stock amounts.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                    <Card className="shadow-soft h-full">
                        <CardHeader>
                            <CardTitle>Item Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label>Item Name <span className="text-destructive">*</span></Label>
                                <Input
                                    value={formData.name}
                                    onChange={e => updateForm('name', e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Category <span className="text-destructive">*</span></Label>
                                    <select
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={formData.category}
                                        onChange={e => updateForm('category', e.target.value)}
                                    >
                                        <option value="" disabled>Select Category</option>
                                        {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label>SKU / Barcode</Label>
                                    <Input
                                        value={formData.sku}
                                        onChange={e => updateForm('sku', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Description</Label>
                                <textarea
                                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
                                    value={formData.description}
                                    onChange={e => updateForm('description', e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Selling Price (Unit) <span className="text-destructive">*</span></Label>
                                    <Input
                                        type="number"
                                        min="0" step="0.01"
                                        value={formData.unitPrice === 0 ? '' : formData.unitPrice}
                                        onChange={e => updateForm('unitPrice', parseFloat(e.target.value) || 0)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Cost Price</Label>
                                    <Input
                                        type="number"
                                        min="0" step="0.01"
                                        value={formData.costPrice === 0 || formData.costPrice == null ? '' : formData.costPrice}
                                        onChange={e => updateForm('costPrice', parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-between border-t pt-6">
                            <Link href={"/manager/inventory" as any}>
                                <Button variant="outline">Cancel</Button>
                            </Link>
                            <Button onClick={handleSubmit} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-soft">
                                {saving ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>

                <div className="space-y-6 md:col-span-1">
                    <Card className="shadow-soft border-primary/20 bg-primary/5">
                        <CardHeader>
                            <CardTitle className="text-lg">Inventory Control</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label>Current Stock Quantity</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={formData.stockQuantity}
                                    onChange={e => updateForm('stockQuantity', parseInt(e.target.value) || 0)}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Prefer using the <Link href={'/manager/inventory/stock' as any} className="text-primary hover:underline">Stock Adjustment workflow</Link> for routine operational changes.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>Low Stock Alert</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={formData.lowStockAlert}
                                    onChange={e => updateForm('lowStockAlert', parseInt(e.target.value) || 1)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-soft">
                        <CardHeader>
                            <CardTitle className="text-lg">Product Status</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3 bg-card rounded-md border p-3">
                                {isActive ? (
                                    <ShieldCheck className="w-6 h-6 text-green-500" />
                                ) : (
                                    <ShieldBan className="w-6 h-6 text-red-500" />
                                )}
                                <div className="flex-1">
                                    <p className="text-sm font-medium">{isActive ? 'Active' : 'Inactive'}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {isActive ? 'Available in POS' : 'Hidden from POS'}
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant={isActive ? "outline" : "default"}
                                onClick={handleToggleActive}
                                disabled={saving}
                                className={`w-full ${isActive ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                            >
                                {isActive ? 'Deactivate Product' : 'Activate Product'}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
