'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useAuthStore } from '@/stores/auth.store'
import {
  createInventorySaleControlRequest,
  getInventorySaleControlRequests,
  getInventorySales,
  reviewInventorySaleControlRequest,
  type InventorySaleControlRequestRow,
} from '../actions'
import { getErrorMessage, formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, ShieldCheck, ShieldAlert } from 'lucide-react'

interface InventorySaleLite {
  id: string
  bill_number: string
  sale_date: string
  total_amount: number
  payment_mode: string
  is_reversed?: boolean
  students: {
    full_name: string
    admission_number: string
  } | null
}

export default function InventorySaleControlsPage() {
  const { school, user } = useAuthStore()
  const isSchoolAdmin = user?.role === 'school_admin'

  const [sales, setSales] = useState<InventorySaleLite[]>([])
  const [requests, setRequests] = useState<InventorySaleControlRequestRow[]>([])
  const [loading, setLoading] = useState(true)

  const [requestSaleId, setRequestSaleId] = useState('')
  const [requestType, setRequestType] = useState<'void' | 'return'>('void')
  const [reason, setReason] = useState('')
  const [creating, setCreating] = useState(false)

  const [requestStatusFilter, setRequestStatusFilter] = useState<'all' | InventorySaleControlRequestRow['status']>('all')

  const load = useCallback(async () => {
    if (!school?.id) return
    setLoading(true)
    try {
      const [salesData, requestData] = await Promise.all([
        getInventorySales(school.id, { limit: 100 }),
        getInventorySaleControlRequests(
          school.id,
          requestStatusFilter === 'all' ? undefined : { status: requestStatusFilter },
        ),
      ])

      const saleRows = (salesData ?? []) as InventorySaleLite[]
      setSales(saleRows)
      setRequests(requestData)

      if (!requestSaleId && saleRows.length > 0) {
        setRequestSaleId(saleRows[0]?.id ?? '')
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [school?.id, requestSaleId, requestStatusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const submitRequest = async () => {
    if (!school?.id) return
    if (!requestSaleId) {
      toast.error('Select a sale.')
      return
    }
    if (!reason.trim()) {
      toast.error('Reason is required.')
      return
    }

    setCreating(true)
    try {
      await createInventorySaleControlRequest(school.id, {
        saleId: requestSaleId,
        requestType,
        reason: reason.trim(),
      })
      toast.success('Sale control request submitted for approval.')
      setReason('')
      await load()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setCreating(false)
    }
  }

  const review = async (requestId: string, decision: 'approved' | 'rejected') => {
    if (!school?.id) return
    try {
      await reviewInventorySaleControlRequest(school.id, requestId, decision)
      toast.success(`Request ${decision}.`)
      await load()
    } catch (error) {
      toast.error(getErrorMessage(error))
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
          <h2 className="text-2xl font-bold tracking-tight">POS Sale Controls</h2>
          <p className="text-muted-foreground">Cashier void/return requests with school-admin approval and stock-safe execution.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create Void / Return Request</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Sale</Label>
              <Select value={requestSaleId} onValueChange={setRequestSaleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sale" />
                </SelectTrigger>
                <SelectContent>
                  {sales.map((sale) => (
                    <SelectItem key={sale.id} value={sale.id}>
                      {sale.bill_number} · {formatCurrency(sale.total_amount)} · {new Date(sale.sale_date).toLocaleDateString('en-IN')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Request Type</Label>
              <Select value={requestType} onValueChange={(value) => setRequestType(value as 'void' | 'return')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="void">Void</SelectItem>
                  <SelectItem value="return">Return</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Reason</Label>
            <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this sale being voided/returned?" />
          </div>

          <Button onClick={() => void submitRequest()} disabled={creating || loading || sales.length === 0}>
            {creating ? 'Submitting…' : 'Submit Request'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Approval Queue</CardTitle>
          <Select value={requestStatusFilter} onValueChange={(value) => setRequestStatusFilter(value as 'all' | InventorySaleControlRequestRow['status'])}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="executed">Executed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading sale-control queue...</p>
          ) : requests.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No control requests found.
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((row) => (
                <div key={row.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {row.sale?.billNumber ?? row.saleId} · {row.requestType.toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Requested by {row.requestedByName} on {new Date(row.createdAt).toLocaleString('en-IN')}
                      </p>
                      {row.sale && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatCurrency(row.sale.totalAmount)} · {row.sale.studentName ?? 'Walk-in'} · {row.sale.paymentMode.toUpperCase()}
                        </p>
                      )}
                    </div>
                    <span className="rounded-full border px-2 py-1 text-xs capitalize">{row.status}</span>
                  </div>

                  <div className="mt-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                    {row.reason}
                    {row.reviewNotes ? ` | Review: ${row.reviewNotes}` : ''}
                  </div>

                  {row.status === 'pending' && isSchoolAdmin && (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => void review(row.id, 'approved')}>
                        <ShieldCheck className="mr-1 h-4 w-4" /> Approve & Execute
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void review(row.id, 'rejected')}>
                        <ShieldAlert className="mr-1 h-4 w-4" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
