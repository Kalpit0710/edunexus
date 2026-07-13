'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useAuthStore } from '@/stores/auth.store'
import {
  createInventorySupplier,
  createInventoryPurchaseOrder,
  getInventoryItems,
  getInventoryPurchaseOrders,
  getInventorySuppliers,
  getInventoryStockReductionLogs,
  receiveInventoryPurchaseOrder,
  recordInventoryDamageAdjustment,
  recordInventoryVendorReturn,
  type InventoryPurchaseOrderLineInput,
  type InventoryPurchaseOrderListRow,
  type InventorySupplierRow,
  type InventoryStockReductionLogRow,
  reviewInventoryPurchaseOrder,
} from '../actions'
import { getErrorMessage, formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Plus, PackagePlus, Undo2, AlertTriangle, Building2, Download, CheckCircle2, XCircle } from 'lucide-react'
import * as XLSX from 'xlsx'

interface InventoryItemLite {
  id: string
  name: string
  sku: string | null
  stock_quantity: number
}

interface PoLineDraft {
  itemId: string
  orderedQuantity: string
  unitCost: string
}

const defaultPoLine: PoLineDraft = {
  itemId: '',
  orderedQuantity: '1',
  unitCost: '0',
}

export default function InventoryProcurementPage() {
  const { school, user } = useAuthStore()
  const isSchoolAdmin = user?.role === 'school_admin'

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<InventoryItemLite[]>([])
  const [suppliers, setSuppliers] = useState<InventorySupplierRow[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<InventoryPurchaseOrderListRow[]>([])
  const [reductionLogs, setReductionLogs] = useState<InventoryStockReductionLogRow[]>([])

  const [supplierId, setSupplierId] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0] ?? '')
  const [expectedDate, setExpectedDate] = useState('')
  const [poNotes, setPoNotes] = useState('')
  const [poLines, setPoLines] = useState<PoLineDraft[]>([{ ...defaultPoLine }])
  const [creatingPo, setCreatingPo] = useState(false)

  const [supplierName, setSupplierName] = useState('')
  const [supplierContactPerson, setSupplierContactPerson] = useState('')
  const [supplierPhone, setSupplierPhone] = useState('')
  const [supplierEmail, setSupplierEmail] = useState('')
  const [supplierNotes, setSupplierNotes] = useState('')
  const [creatingSupplier, setCreatingSupplier] = useState(false)

  const [returnItemId, setReturnItemId] = useState('')
  const [returnQuantity, setReturnQuantity] = useState('1')
  const [returnReason, setReturnReason] = useState('')
  const [processingReturn, setProcessingReturn] = useState(false)

  const [damageItemId, setDamageItemId] = useState('')
  const [damageQuantity, setDamageQuantity] = useState('1')
  const [damageReason, setDamageReason] = useState('')
  const [processingDamage, setProcessingDamage] = useState(false)

  const load = useCallback(async () => {
    if (!school?.id) return
    setLoading(true)
    try {
      const [inventoryItems, supplierRows, poRows, logs] = await Promise.all([
        getInventoryItems(school.id, { activeOnly: true, limit: 500 }),
        getInventorySuppliers(school.id, { activeOnly: true, limit: 200 }),
        getInventoryPurchaseOrders(school.id, { limit: 50 }),
        getInventoryStockReductionLogs(school.id, { limit: 40 }),
      ])

      const typedItems = (inventoryItems ?? []) as InventoryItemLite[]
      setItems(typedItems)
      setSuppliers(supplierRows)
      setPurchaseOrders(poRows)
      setReductionLogs(logs)

      if (!supplierId && supplierRows.length > 0) {
        setSupplierId(supplierRows[0]?.id ?? '')
      }

      if (!returnItemId && typedItems.length > 0) {
        const firstId = typedItems[0]?.id ?? ''
        setReturnItemId(firstId)
        setDamageItemId(firstId)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [school?.id, returnItemId, supplierId])

  useEffect(() => {
    void load()
  }, [load])

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])

  const exportPurchaseOrders = () => {
    if (!purchaseOrders.length) return
    const rows = purchaseOrders.flatMap((po) =>
      po.items.map((line) => ({
        'PO Number': po.poNumber,
        Supplier: po.supplierName,
        Status: po.status,
        'Order Date': po.orderDate,
        'Expected Date': po.expectedDate ?? '',
        Item: line.itemName,
        'Ordered Qty': line.orderedQuantity,
        'Received Qty': line.receivedQuantity,
        'Pending Qty': line.pendingQuantity,
        'Unit Cost': line.unitCost,
        'Requested By': po.requestedByName ?? '',
        'Reviewed By': po.reviewedByName ?? '',
        'Reviewed At': po.reviewedAt ?? '',
      })),
    )
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Purchase Orders')
    XLSX.writeFile(wb, `inventory_procurement_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const exportStockReductions = () => {
    if (!reductionLogs.length) return
    const rows = reductionLogs.map((log) => ({
      Type: log.type === 'vendor_return' ? 'Vendor Return' : 'Damage',
      Item: log.itemName,
      Quantity: log.quantity,
      Reason: log.reason,
      Date: log.date,
      'Recorded By': log.recordedByName ?? '',
      'Purchase Order Id': log.purchaseOrderId ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Reductions')
    XLSX.writeFile(wb, `inventory_stock_reductions_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const addPoLine = () => {
    setPoLines((prev) => [...prev, { ...defaultPoLine }])
  }

  const updatePoLine = (index: number, patch: Partial<PoLineDraft>) => {
    setPoLines((prev) => prev.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)))
  }

  const removePoLine = (index: number) => {
    setPoLines((prev) => (prev.length === 1 ? prev : prev.filter((_, lineIndex) => lineIndex !== index)))
  }

  const submitPurchaseOrder = async () => {
    if (!school?.id) return

    const linePayload: InventoryPurchaseOrderLineInput[] = poLines
      .map((line) => ({
        itemId: line.itemId,
        orderedQuantity: Number(line.orderedQuantity),
        unitCost: Number(line.unitCost),
      }))
      .filter((line) => line.itemId)

    if (linePayload.length === 0) {
      toast.error('Add at least one valid PO line.')
      return
    }

    setCreatingPo(true)
    try {
      const result = await createInventoryPurchaseOrder(school.id, {
        supplierId,
        orderDate,
        expectedDate: expectedDate || undefined,
        notes: poNotes,
        items: linePayload,
      })
      toast.success(`Purchase order ${result.poNumber} submitted for approval.`)
      setExpectedDate('')
      setPoNotes('')
      setPoLines([{ ...defaultPoLine }])
      await load()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setCreatingPo(false)
    }
  }

  const submitSupplier = async () => {
    if (!school?.id) return
    setCreatingSupplier(true)
    try {
      const supplier = await createInventorySupplier(school.id, {
        name: supplierName,
        contactPerson: supplierContactPerson,
        phone: supplierPhone,
        email: supplierEmail,
        notes: supplierNotes,
      })
      toast.success(`Supplier ${supplier.name} created.`)
      setSupplierId(supplier.id)
      setSupplierName('')
      setSupplierContactPerson('')
      setSupplierPhone('')
      setSupplierEmail('')
      setSupplierNotes('')
      await load()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setCreatingSupplier(false)
    }
  }

  const reviewPurchaseOrder = async (purchaseOrderId: string, decision: 'approved' | 'rejected') => {
    if (!school?.id) return
    try {
      await reviewInventoryPurchaseOrder(school.id, purchaseOrderId, decision)
      toast.success(`Purchase order ${decision}.`)
      await load()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const receiveRemainingForPo = async (po: InventoryPurchaseOrderListRow) => {
    if (!school?.id) return
    const pendingLines = po.items
      .filter((line) => line.pendingQuantity > 0)
      .map((line) => ({ purchaseOrderItemId: line.id, quantityReceived: line.pendingQuantity }))

    if (pendingLines.length === 0) {
      toast.message('No pending quantities left in this PO.')
      return
    }

    try {
      const result = await receiveInventoryPurchaseOrder(school.id, {
        purchaseOrderId: po.id,
        items: pendingLines,
      })
      toast.success(`GRN ${result.grnNumber} recorded.`)
      await load()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const submitVendorReturn = async () => {
    if (!school?.id) return
    setProcessingReturn(true)
    try {
      await recordInventoryVendorReturn(school.id, {
        itemId: returnItemId,
        quantity: Number(returnQuantity),
        reason: returnReason,
      })
      toast.success('Vendor return recorded.')
      setReturnQuantity('1')
      setReturnReason('')
      await load()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setProcessingReturn(false)
    }
  }

  const submitDamageAdjustment = async () => {
    if (!school?.id) return
    setProcessingDamage(true)
    try {
      await recordInventoryDamageAdjustment(school.id, {
        itemId: damageItemId,
        quantity: Number(damageQuantity),
        reason: damageReason,
      })
      toast.success('Damage adjustment recorded.')
      setDamageQuantity('1')
      setDamageReason('')
      await load()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setProcessingDamage(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={'/manager/inventory' as Route}>
          <Button variant="outline" size="icon" aria-label="Back to inventory">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Procurement Lifecycle</h2>
          <p className="text-muted-foreground">Manage PO creation, GRN receiving, vendor returns, and damage write-offs.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" /> Supplier Master</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Supplier Name</Label>
              <Input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} placeholder="Supplier name" />
            </div>
            <div className="space-y-1">
              <Label>Contact Person</Label>
              <Input value={supplierContactPerson} onChange={(event) => setSupplierContactPerson(event.target.value)} placeholder="Contact person" />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={supplierPhone} onChange={(event) => setSupplierPhone(event.target.value)} placeholder="Phone" />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={supplierEmail} onChange={(event) => setSupplierEmail(event.target.value)} placeholder="Email" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea rows={2} value={supplierNotes} onChange={(event) => setSupplierNotes(event.target.value)} placeholder="Vendor capabilities, lead time, etc." />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void submitSupplier()} disabled={creatingSupplier || loading}>
              {creatingSupplier ? 'Creating…' : 'Create Supplier'}
            </Button>
            {suppliers.map((supplier) => (
              <span key={supplier.id} className="rounded-full border px-2 py-1 text-xs">{supplier.name}</span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create Purchase Order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Order Date</Label>
              <Input type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Expected Date</Label>
              <Input type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea rows={1} value={poNotes} onChange={(event) => setPoNotes(event.target.value)} placeholder="PO notes (optional)" />
            </div>
          </div>

          <div className="space-y-2">
            {poLines.map((line, index) => (
              <div key={`po-line-${index}`} className="grid gap-2 rounded-md border p-3 md:grid-cols-12">
                <div className="md:col-span-6">
                  <Label className="text-xs">Item</Label>
                  <Select value={line.itemId} onValueChange={(value) => updatePoLine(index, { itemId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} ({item.sku ?? 'no-sku'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    min={1}
                    value={line.orderedQuantity}
                    onChange={(event) => updatePoLine(index, { orderedQuantity: event.target.value })}
                  />
                </div>
                <div className="md:col-span-3">
                  <Label className="text-xs">Unit Cost</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.unitCost}
                    onChange={(event) => updatePoLine(index, { unitCost: event.target.value })}
                  />
                </div>
                <div className="md:col-span-1 flex items-end justify-end">
                  <Button variant="outline" size="icon" onClick={() => removePoLine(index)} disabled={poLines.length === 1}>
                    <Plus className="h-4 w-4 rotate-45" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={addPoLine}>
              <Plus className="mr-1 h-4 w-4" /> Add Line
            </Button>
            <Button onClick={() => void submitPurchaseOrder()} disabled={creatingPo || loading}>
              <PackagePlus className="mr-1 h-4 w-4" />
              {creatingPo ? 'Creating…' : 'Create PO'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vendor Return</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Item</Label>
              <Select value={returnItemId} onValueChange={setReturnItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} · Stock {item.stock_quantity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Quantity</Label>
              <Input type="number" min={1} value={returnQuantity} onChange={(event) => setReturnQuantity(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Reason</Label>
              <Textarea rows={2} value={returnReason} onChange={(event) => setReturnReason(event.target.value)} placeholder="Defective batch, wrong supply, etc." />
            </div>
            <Button onClick={() => void submitVendorReturn()} disabled={processingReturn || loading}>
              <Undo2 className="mr-1 h-4 w-4" /> {processingReturn ? 'Recording…' : 'Record Vendor Return'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Damage Adjustment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Item</Label>
              <Select value={damageItemId} onValueChange={setDamageItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} · Stock {item.stock_quantity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Quantity</Label>
              <Input type="number" min={1} value={damageQuantity} onChange={(event) => setDamageQuantity(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Reason</Label>
              <Textarea rows={2} value={damageReason} onChange={(event) => setDamageReason(event.target.value)} placeholder="Damaged in storage, torn stock, etc." />
            </div>
            <Button variant="outline" onClick={() => void submitDamageAdjustment()} disabled={processingDamage || loading}>
              <AlertTriangle className="mr-1 h-4 w-4" /> {processingDamage ? 'Recording…' : 'Record Damage'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Purchase Orders & Receiving</CardTitle>
          <Button variant="outline" size="sm" onClick={exportPurchaseOrders} disabled={purchaseOrders.length === 0}>
            <Download className="mr-1 h-4 w-4" /> Export PO Ledger
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading purchase orders...</p>
          ) : purchaseOrders.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No purchase orders created yet.
            </div>
          ) : (
            <div className="space-y-3">
              {purchaseOrders.map((po) => {
                const pendingQty = po.items.reduce((sum, line) => sum + line.pendingQuantity, 0)
                return (
                  <div key={po.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{po.poNumber} · {po.supplierName}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(po.orderDate).toLocaleDateString('en-IN')} · {po.items.length} line(s)
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Requested by {po.requestedByName ?? 'Unknown'}
                          {po.reviewedByName ? ` · Reviewed by ${po.reviewedByName}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border px-2 py-1 text-xs capitalize">{po.status.replace('_', ' ')}</span>
                        {po.status === 'pending_approval' && isSchoolAdmin && (
                          <>
                            <Button size="sm" onClick={() => void reviewPurchaseOrder(po.id, 'approved')}>
                              <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => void reviewPurchaseOrder(po.id, 'rejected')}>
                              <XCircle className="mr-1 h-4 w-4" /> Reject
                            </Button>
                          </>
                        )}
                        {pendingQty > 0 && (po.status === 'approved' || po.status === 'partially_received') && (
                          <Button size="sm" onClick={() => void receiveRemainingForPo(po)}>
                            Receive Pending ({pendingQty})
                          </Button>
                        )}
                      </div>
                    </div>
                    {po.approvalNotes && (
                      <div className="mt-2 rounded border bg-muted/30 p-2 text-xs text-muted-foreground">
                        Approval notes: {po.approvalNotes}
                      </div>
                    )}
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {po.items.map((line) => (
                        <div key={line.id} className="rounded border bg-muted/30 p-2 text-xs">
                          <p className="font-medium">{line.itemName}</p>
                          <p className="text-muted-foreground">
                            Ordered {line.orderedQuantity} · Received {line.receivedQuantity} · Pending {line.pendingQuantity}
                          </p>
                          <p className="text-muted-foreground">Unit cost {formatCurrency(line.unitCost)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Stock Reductions</CardTitle>
          <Button variant="outline" size="sm" onClick={exportStockReductions} disabled={reductionLogs.length === 0}>
            <Download className="mr-1 h-4 w-4" /> Export Reductions
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading stock reductions...</p>
          ) : reductionLogs.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No vendor returns or damage adjustments recorded yet.
            </div>
          ) : (
            <div className="space-y-2">
              {reductionLogs.map((log) => {
                const item = itemById.get(log.itemId)
                return (
                  <div key={log.id} className="rounded border p-2 text-sm">
                    <p className="font-medium">
                      {log.type === 'vendor_return' ? 'Vendor Return' : 'Damage'} · {log.itemName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Qty {log.quantity} · {new Date(log.date).toLocaleDateString('en-IN')} · Current Stock {item?.stock_quantity ?? '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">{log.reason}</p>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
