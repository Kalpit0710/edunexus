'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { getInventoryItems } from './actions'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Plus, Search, ShoppingCart, Settings2, Package, Tag, Edit, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'
import { isLowStock, type InventoryCategory } from '@/lib/inventory-utils'
import { formatCurrency } from '@/lib/utils'

const categories: { label: string, value: InventoryCategory }[] = [
    { label: 'Books', value: 'book' },
    { label: 'Uniforms', value: 'uniform' },
    { label: 'Stationery', value: 'stationery' },
    { label: 'Sports', value: 'sports' },
    { label: 'Lab', value: 'lab' },
    { label: 'Other', value: 'other' }
]

export default function InventoryPage() {
    const { school } = useAuthStore()
    const [items, setItems] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Filters
    const [search, setSearch] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string>('all')
    const [activeFilter, setActiveFilter] = useState<string>('active')

    useEffect(() => {
        if (school?.id) {
            fetchItems()
        }
    }, [school?.id, activeFilter])

    async function fetchItems() {
        if (!school?.id) return
        setLoading(true)
        try {
            const data = await getInventoryItems(school.id, {
                activeOnly: activeFilter === 'active',
                limit: 500
            })
            setItems(data || [])
        } catch (e: any) {
            toast.error('Failed to load inventory: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    const filteredItems = items.filter(i => {
        if (selectedCategory !== 'all' && i.category !== selectedCategory) return false

        if (search) {
            const term = search.toLowerCase()
            return (
                i.name.toLowerCase().includes(term) ||
                (i.sku && i.sku.toLowerCase().includes(term))
            )
        }
        return true
    })

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Inventory Management</h2>
                    <p className="text-muted-foreground">Manage products, stock levels, and POS sales.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Link href={"/manager/inventory/stock" as any}>
                        <Button variant="outline" className="shadow-soft hover:scale-105 transition-transform">
                            <Settings2 className="w-4 h-4 mr-2" /> Adjust Stock
                        </Button>
                    </Link>
                    <Link href={"/manager/inventory/pos" as any}>
                        <Button variant="outline" className="shadow-soft border-primary text-primary hover:bg-primary/10 hover:scale-105 transition-transform">
                            <ShoppingCart className="w-4 h-4 mr-2" /> POS Sale
                        </Button>
                    </Link>
                    <Link href={"/manager/inventory/new" as any}>
                        <Button className="shadow-soft hover:scale-105 transition-transform">
                            <Plus className="w-4 h-4 mr-2" /> Add Item
                        </Button>
                    </Link>
                </div>
            </div>

            <Card className="shadow-soft border-border/50">
                <CardHeader className="pb-3 border-b space-y-3 sm:space-y-0 sm:flex sm:flex-row gap-4">
                    <div className="flex items-center gap-2 max-w-sm flex-1">
                        <Search className="w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name or SKU..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="h-9 border-0 shadow-none focus-visible:ring-0 px-0 rounded-none bg-transparent"
                        />
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                            <SelectTrigger className="w-[140px] h-9">
                                <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {categories.map(c => (
                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={activeFilter} onValueChange={setActiveFilter}>
                            <SelectTrigger className="w-[140px] h-9">
                                <SelectValue placeholder="Filter Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active Only</SelectItem>
                                <SelectItem value="all">Include Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-8 text-center text-muted-foreground">Loading inventory...</div>
                    ) : filteredItems.length === 0 ? (
                        <div className="p-8 text-center sm:py-16">
                            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                                <Package className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-medium mb-1">No items found</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                {items.length === 0 ? 'Add your first inventory item to get started.' : 'Try adjusting your search filters.'}
                            </p>
                            {items.length === 0 && (
                                <Link href={"/manager/inventory/new" as any}>
                                    <Button variant="outline"><Plus className="w-4 h-4 mr-2" /> Add Item</Button>
                                </Link>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Item Details</th>
                                        <th className="px-6 py-3 font-medium">Category</th>
                                        <th className="px-6 py-3 font-medium text-right">Unit Price</th>
                                        <th className="px-6 py-3 font-medium text-center">Stock</th>
                                        <th className="px-6 py-3 font-medium text-center">Status</th>
                                        <th className="px-6 py-3 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y relative">
                                    {filteredItems.map((item) => {
                                        const lowStock = isLowStock(item.stock_quantity, item.low_stock_alert)

                                        return (
                                            <tr key={item.id} className={`hover:bg-muted/30 transition-colors ${!item.is_active ? 'opacity-60' : ''}`}>
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-foreground">{item.name}</div>
                                                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                        <Tag className="w-3 h-3" /> SKU: {item.sku || 'N/A'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 capitalize text-muted-foreground">
                                                    {item.category}
                                                </td>
                                                <td className="px-6 py-4 text-right font-medium">
                                                    {formatCurrency(item.unit_price)}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className={`inline-flex items-center gap-1.5 font-bold ${lowStock ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                                                        {lowStock && <AlertCircle className="w-4 h-4" />}
                                                        {item.stock_quantity}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide
                                                        ${item.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}
                                                    `}>
                                                        {item.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                                                    <Link href={`/manager/inventory/${item.id}/edit` as any}>
                                                        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-primary">
                                                            <Edit className="h-4 w-4 mr-2" /> Edit
                                                        </Button>
                                                    </Link>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
