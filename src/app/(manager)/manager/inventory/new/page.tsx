'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'
import { createInventoryItem, type InventoryItemInput } from '../actions'
import type { InventoryCategory } from '@/lib/inventory-utils'

const categories: { label: string, value: InventoryCategory }[] = [
    { label: 'Books', value: 'book' },
    { label: 'Uniforms', value: 'uniform' },
    { label: 'Stationery', value: 'stationery' },
    { label: 'Sports', value: 'sports' },
    { label: 'Lab', value: 'lab' },
    { label: 'Other', value: 'other' }
]

export default function NewInventoryItemPage() {
    const router = useRouter()
    const { school } = useAuthStore()
    const [loading, setLoading] = useState(false)

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
            toast.error("Initial stock cannot be negative.")
            return false
        }
        return true
    }

    const handleSubmit = async () => {
        if (!validate()) return
        if (!school?.id) return

        setLoading(true)
        try {
            await createInventoryItem(school.id, formData as InventoryItemInput)
            toast.success("Inventory item added successfully!")
            router.push('/manager/inventory' as any)
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href={"/manager/inventory" as any}>
                    <Button variant="outline" size="icon">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Add New Item</h2>
                    <p className="text-muted-foreground">Add a new product to the school inventory.</p>
                </div>
            </div>

            <Card className="shadow-soft">
                <CardHeader>
                    <CardTitle>Item Details</CardTitle>
                    <CardDescription>Enter product specification, pricing, and initial stock.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2 md:col-span-2">
                            <Label>Item Name <span className="text-destructive">*</span></Label>
                            <Input
                                placeholder="e.g. Class 10 Mathematics Textbook"
                                value={formData.name}
                                onChange={e => updateForm('name', e.target.value)}
                            />
                        </div>

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
                            <Label>SKU / Barcode (Optional)</Label>
                            <Input
                                placeholder="e.g. BK-MT-10"
                                value={formData.sku}
                                onChange={e => updateForm('sku', e.target.value)}
                            />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <Label>Description (Optional)</Label>
                            <textarea
                                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
                                value={formData.description}
                                onChange={e => updateForm('description', e.target.value)}
                                placeholder="Size particulars, publisher details..."
                            />
                        </div>
                    </div>

                    <div className="border-t pt-6 mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Selling Price (Unit) <span className="text-destructive">*</span></Label>
                            <Input
                                type="number"
                                min="0" step="0.01"
                                value={formData.unitPrice}
                                onChange={e => updateForm('unitPrice', parseFloat(e.target.value) || 0)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Cost Price (Optional)</Label>
                            <Input
                                type="number"
                                min="0" step="0.01"
                                value={formData.costPrice ?? ''}
                                onChange={e => updateForm('costPrice', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>

                    <div className="border-t pt-6 mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Initial Stock Quantity</Label>
                            <Input
                                type="number"
                                min="0"
                                value={formData.stockQuantity}
                                onChange={e => updateForm('stockQuantity', parseInt(e.target.value) || 0)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Low Stock Alert Threshold</Label>
                            <Input
                                type="number"
                                min="1"
                                value={formData.lowStockAlert}
                                onChange={e => updateForm('lowStockAlert', parseInt(e.target.value) || 10)}
                            />
                            <p className="text-xs text-muted-foreground mt-1">Item will be flagged when stock falls below this number.</p>
                        </div>
                    </div>

                </CardContent>
                <CardFooter className="flex justify-between border-t pt-6">
                    <Link href={"/manager/inventory" as any}>
                        <Button variant="outline">Cancel</Button>
                    </Link>
                    <Button onClick={handleSubmit} disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-soft">
                        {loading ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Item</>}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
