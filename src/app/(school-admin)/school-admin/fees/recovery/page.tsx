'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import {
  getFeePaymentRecoveryCases,
  createFeePaymentRecoveryCase,
  updateFeePaymentRecoveryCase,
  searchStudentsForFeeLive,
  type FeePaymentRecoveryCaseRow,
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
import { ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react'
import Link from 'next/link'

const STATUS_OPTIONS: FeePaymentRecoveryCaseRow['status'][] = ['open', 'in_progress', 'resolved', 'abandoned']

export default function FeeRecoveryPage() {
  const { school } = useAuthStore()
  const [cases, setCases] = useState<FeePaymentRecoveryCaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<FeePaymentRecoveryCaseRow['status'] | 'all'>('all')

  const [studentQuery, setStudentQuery] = useState('')
  const [studentMatches, setStudentMatches] = useState<FeeStudentResult[]>([])
  const [studentId, setStudentId] = useState<string>('')
  const [amount, setAmount] = useState('')
  const [source, setSource] = useState<FeePaymentRecoveryCaseRow['source']>('manual')
  const [reference, setReference] = useState('')
  const [failureReason, setFailureReason] = useState('')
  const [narrative, setNarrative] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!school?.id) return
    setLoading(true)
    try {
      const data = await getFeePaymentRecoveryCases(
        school.id,
        statusFilter === 'all' ? undefined : statusFilter,
      )
      setCases(data)
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

  const submitCase = async () => {
    if (!school?.id) return
    if (!Number(amount) || Number(amount) <= 0) {
      toast.error('Enter a valid amount.')
      return
    }

    setSaving(true)
    try {
      await createFeePaymentRecoveryCase(school.id, {
        studentId: studentId || undefined,
        source,
        amount: Number(amount),
        referenceNumber: reference || undefined,
        failureReason: failureReason || undefined,
        narrative: narrative || undefined,
      })
      toast.success('Recovery case created.')
      setStudentQuery('')
      setStudentMatches([])
      setStudentId('')
      setAmount('')
      setReference('')
      setFailureReason('')
      setNarrative('')
      await load()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (caseId: string, status: FeePaymentRecoveryCaseRow['status']) => {
    if (!school?.id) return
    try {
      await updateFeePaymentRecoveryCase(school.id, caseId, { status })
      toast.success('Recovery case updated.')
      await load()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/school-admin/fees">
            <Button variant="outline" size="icon" aria-label="Back to fees">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Payment Recovery</h1>
            <p className="text-sm text-muted-foreground">Track failed or abandoned payment attempts and closure.</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Log Recovery Case</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Student (optional)</Label>
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
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label>Source</Label>
              <Select value={source} onValueChange={(val) => setSource(val as FeePaymentRecoveryCaseRow['source'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="online_gateway">Online Gateway</SelectItem>
                  <SelectItem value="offline_queue">Offline Queue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Reference</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Txn / UTR / ref" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Failure reason</Label>
            <Input value={failureReason} onChange={(e) => setFailureReason(e.target.value)} placeholder="Timeout, decline, unreachable parent..." />
          </div>
          <div className="space-y-1">
            <Label>Narrative</Label>
            <Textarea
              rows={3}
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              placeholder="Context and expected recovery action"
            />
          </div>
          <Button onClick={() => void submitCase()} disabled={saving}>{saving ? 'Saving…' : 'Create Recovery Case'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recovery Queue</CardTitle>
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as FeePaymentRecoveryCaseRow['status'] | 'all')}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : cases.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No recovery cases found for this filter.
            </div>
          ) : (
            <div className="space-y-3">
              {cases.map((row) => (
                <div key={row.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {row.student_name ?? 'Unassigned student'}
                        {row.student_admission_number ? ` (${row.student_admission_number})` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleString('en-IN')} · {row.source} · ₹{Number(row.amount).toLocaleString('en-IN')}
                      </p>
                      {row.reference_number && (
                        <p className="text-xs text-muted-foreground">Ref: {row.reference_number}</p>
                      )}
                    </div>
                    <Select value={row.status} onValueChange={(val) => void updateStatus(row.id, val as FeePaymentRecoveryCaseRow['status'])}>
                      <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {(row.failure_reason || row.narrative) && (
                    <div className="mt-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                      {row.failure_reason && <p><ShieldAlert className="mr-1 inline h-3 w-3" />{row.failure_reason}</p>}
                      {row.narrative && <p className="mt-1">{row.narrative}</p>}
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
