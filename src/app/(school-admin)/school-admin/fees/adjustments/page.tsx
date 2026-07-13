'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import {
  getFeeAdjustments,
  createFeeAdjustment,
  reviewFeeAdjustment,
  searchStudentsForFeeLive,
  type FeeAdjustmentRow,
  type FeeStudentResult,
} from '../actions'
import { getErrorMessage } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react'
import Link from 'next/link'

export default function FeeAdjustmentsPage() {
  const { school, user } = useAuthStore()
  const isSchoolAdmin = user?.role === 'school_admin'

  const [rows, setRows] = useState<FeeAdjustmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<FeeAdjustmentRow['status'] | 'all'>('all')

  const [studentQuery, setStudentQuery] = useState('')
  const [studentMatches, setStudentMatches] = useState<FeeStudentResult[]>([])
  const [studentId, setStudentId] = useState('')
  const [requestType, setRequestType] = useState<FeeAdjustmentRow['request_type']>('adjustment')
  const [direction, setDirection] = useState<FeeAdjustmentRow['direction']>('debit')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [narrative, setNarrative] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!school?.id) return
    setLoading(true)
    try {
      const data = await getFeeAdjustments(school.id, statusFilter === 'all' ? undefined : statusFilter)
      setRows(data)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [school?.id, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!school?.id || !studentQuery.trim()) {
      setStudentMatches([])
      return
    }

    const handle = setTimeout(() => {
      void searchStudentsForFeeLive(school.id, studentQuery.trim(), 8)
        .then(setStudentMatches)
        .catch(() => setStudentMatches([]))
    }, 220)

    return () => clearTimeout(handle)
  }, [school?.id, studentQuery])

  const submitAdjustment = async () => {
    if (!school?.id) return
    if (!studentId) {
      toast.error('Select a student.')
      return
    }
    if (!Number(amount) || Number(amount) <= 0) {
      toast.error('Enter a valid amount.')
      return
    }
    if (!narrative.trim()) {
      toast.error('Narrative is required.')
      return
    }

    setSaving(true)
    try {
      await createFeeAdjustment(school.id, {
        studentId,
        requestType,
        direction,
        amount: Number(amount),
        reason,
        narrative,
      })
      toast.success('Adjustment request submitted.')
      setStudentQuery('')
      setStudentMatches([])
      setStudentId('')
      setAmount('')
      setReason('')
      setNarrative('')
      await load()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const review = async (id: string, decision: 'approved' | 'rejected') => {
    if (!school?.id) return
    try {
      await reviewFeeAdjustment(school.id, id, decision)
      toast.success(`Adjustment ${decision}.`)
      await load()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link href="/school-admin/fees">
          <Button variant="outline" size="icon" aria-label="Back to fees">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fee Adjustments</h1>
          <p className="text-sm text-muted-foreground">Refund, credit-note, and manual adjustment requests with approval trail.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create Adjustment Request</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Student</Label>
            <Input
              placeholder="Search student by name or admission no"
              value={studentQuery}
              onChange={(e) => {
                setStudentQuery(e.target.value)
                setStudentId('')
              }}
            />
            {studentMatches.length > 0 && !studentId && (
              <div className="max-h-40 overflow-auto rounded-md border bg-background p-1">
                {studentMatches.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setStudentId(student.id)
                      setStudentQuery(`${student.full_name} (${student.admission_number})`)
                      setStudentMatches([])
                    }}
                  >
                    {student.full_name} · {student.admission_number}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Request type</Label>
              <Select value={requestType} onValueChange={(val) => setRequestType(val as FeeAdjustmentRow['request_type'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                  <SelectItem value="credit_note">Credit Note</SelectItem>
                  <SelectItem value="refund">Refund</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Direction</Label>
              <Select value={direction} onValueChange={(val) => setDirection(val as FeeAdjustmentRow['direction'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">Debit (increase due)</SelectItem>
                  <SelectItem value="credit">Credit (reduce due)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Short reason" />
          </div>

          <div className="space-y-1">
            <Label>Narrative</Label>
            <Textarea rows={3} value={narrative} onChange={(e) => setNarrative(e.target.value)} placeholder="Narrative shown in fee statement" />
          </div>

          <Button onClick={() => void submitAdjustment()} disabled={saving}>{saving ? 'Saving…' : 'Submit for Approval'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Approval Queue</CardTitle>
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as FeeAdjustmentRow['status'] | 'all')}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : rows.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No adjustments found for this filter.
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <div key={row.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {row.student_name ?? 'Student'}
                        {row.student_admission_number ? ` (${row.student_admission_number})` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleString('en-IN')} · {row.request_type} · {row.direction} · ₹{Number(row.amount).toLocaleString('en-IN')}
                      </p>
                      {row.reason && <p className="mt-1 text-xs text-muted-foreground">Reason: {row.reason}</p>}
                    </div>
                    <span className="rounded-full border px-2 py-1 text-xs capitalize">{row.status}</span>
                  </div>
                  <p className="mt-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">{row.narrative}</p>

                  {row.status === 'pending' && isSchoolAdmin && (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => void review(row.id, 'approved')}>
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void review(row.id, 'rejected')}>
                        <XCircle className="mr-1 h-4 w-4" /> Reject
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
