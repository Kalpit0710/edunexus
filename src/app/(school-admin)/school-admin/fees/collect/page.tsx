'use client'

import { useAuthStore } from '@/stores/auth.store'
import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  getStudentFeeStructure,
  collectFeePayment,
  getNextReceiptSeq,
  searchStudentForFee,
  searchStudentsForFeeLive,
  type FeeStructureRow,
  type FeeStudentResult,
} from '../actions'
import { generateReceiptNumber, isReferenceRequired } from '@/lib/fee-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/utils'
import { Search, PrinterIcon, CheckCircle, ArrowLeft, GraduationCap, Banknote, UserSearch } from 'lucide-react'
import Link from 'next/link'
import { LiveSearch } from '@/components/live-search'

type PaymentMode = 'cash' | 'cheque' | 'upi' | 'neft' | 'card' | 'online'

const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'neft', label: 'NEFT/RTGS' },
  { value: 'card', label: 'Card' },
  { value: 'online', label: 'Online' },
]

function CollectFeePageContent() {
  const { school, user } = useAuthStore()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Step 1: search
  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '')
  const [searching, setSearching] = useState(false)
  const [student, setStudent] = useState<any>(null)
  const [structures, setStructures] = useState<FeeStructureRow[]>([])

  // Step 2: select items
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({})
  const [discount, setDiscount] = useState('0')
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash')
  const [reference, setReference] = useState('')
  const [remarks, setRemarks] = useState('')
  const [paidAmount, setPaidAmount] = useState('')

  // Step 3: result
  const [receiptNumber, setReceiptNumber] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Pre-fill search from query param
  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      handleSearch(q)
    }
  }, [searchParams])

  const studentFetcher = useCallback(
    (q: string) => school?.id ? searchStudentsForFeeLive(school.id, q) : Promise.resolve([]),
    [school?.id],
  )

  const totalSelected = structures
    .filter(s => selectedItems[s.id])
    .reduce((sum, s) => sum + Number(s.amount), 0)
  const netPayable = Math.max(0, totalSelected - Number(discount || 0))
  const changeDue = paymentMode === 'cash' && Number(paidAmount) > netPayable && netPayable > 0
    ? Number(paidAmount) - netPayable
    : 0
  // Balance left on the selected items after this payment (partial collection).
  const balanceRemaining = Math.max(0, netPayable - Number(paidAmount || 0))
  const referenceRequired = isReferenceRequired(paymentMode)
  const referenceMissing = referenceRequired && !reference.trim()

  const handleSearch = async (overrideQuery?: string) => {
    const q = overrideQuery ?? searchInput
    if (!school?.id || !q.trim()) return
    setSearching(true)
    setStudent(null)
    setStructures([])
    setSelectedItems({})
    setReceiptNumber(null)
    try {
      const found = await searchStudentForFee(school.id, q.trim())
      if (!found) { toast.error('Student not found'); return }
      await loadStudentData(found)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setSearching(false)
    }
  }

  const loadStudentData = async (found: FeeStudentResult) => {
    if (!school?.id) return
    setSearching(true)
    try {
      const { structures: structs } = await getStudentFeeStructure(school.id, found.id)
      setStudent(found)
      setStructures(structs)
      // pre-select all
      const sel: Record<string, boolean> = {}
      structs.forEach(s => { sel[s.id] = true })
      setSelectedItems(sel)
      setPaidAmount(String(structs.reduce((sum, s) => sum + Number(s.amount), 0)))
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setSearching(false)
    }
  }

  const handleCollect = async () => {
    if (!school?.id || !student || !user?.id) return
    const items = structures
      .filter(s => selectedItems[s.id])
      .map(s => ({ categoryId: s.category_id, amount: Number(s.amount) }))
    if (!items.length) { toast.error('Select at least one fee item'); return }
    if (!Number(paidAmount)) { toast.error('Enter paid amount'); return }
    if (referenceMissing) {
      toast.error(`Enter a reference number for ${paymentMode.toUpperCase()} payments`)
      return
    }

    setSaving(true)
    try {
      const seq = await getNextReceiptSeq(school.id)
      const rxNumber = generateReceiptNumber(school.code ?? 'SCH', new Date().getFullYear(), seq)
      await collectFeePayment(school.id, rxNumber, {
        studentId: student.id,
        items,
        paidAmount: Number(paidAmount),
        discountAmount: Number(discount || 0),
        paymentMode,
        collectedById: user.id,
        referenceNumber: reference || undefined,
        remarks: remarks || undefined,
      })
      setReceiptNumber(rxNumber)
      toast.success(`Payment recorded — Receipt: ${rxNumber}`)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (receiptNumber) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-6">
        <Card>
          <CardContent className="pt-8 pb-6 flex flex-col items-center text-center gap-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
            <h2 className="text-xl font-bold">Payment Successful</h2>
            {/* Student + school identity for the printed slip */}
            <div className="flex items-center gap-3">
              {student?.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- dynamic student photo on receipt
                <img
                  src={student.photo_url}
                  alt={student.full_name}
                  className="w-14 h-14 rounded-full object-cover border shadow-sm"
                />
              ) : school?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- dynamic school logo on receipt
                <img
                  src={school.logo_url}
                  alt={school.name}
                  className="w-14 h-14 rounded-full object-contain border shadow-sm bg-white"
                />
              ) : null}
              {student && (
                <div className="text-left">
                  <p className="font-semibold leading-tight">{student.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {student.admission_number}
                    {student.class_name ? ` · ${student.class_name}` : ''}
                    {student.section_name ? `-${student.section_name}` : ''}
                  </p>
                </div>
              )}
            </div>
            <p className="text-muted-foreground">Receipt Number</p>
            <p className="text-3xl font-mono font-bold tracking-widest">{receiptNumber}</p>
            <p className="text-lg font-semibold">
              ₹{Number(paidAmount).toLocaleString('en-IN')} collected via <span className="capitalize">{paymentMode}</span>
            </p>
            {changeDue > 0 && (
              <div className="text-lg font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-4 py-2">
                💵 Change Due: ₹{changeDue.toLocaleString('en-IN')}
              </div>
            )}
            {balanceRemaining > 0 && (
              <div className="text-base font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-4 py-2">
                ⚠️ Balance remaining: ₹{balanceRemaining.toLocaleString('en-IN')}
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => window.print()}>
                <PrinterIcon className="mr-2 h-4 w-4" /> Print Receipt
              </Button>
              <Button onClick={() => {
                setStudent(null); setStructures([]); setSelectedItems({})
                setDiscount('0'); setPaymentMode('cash'); setReference('')
                setRemarks(''); setPaidAmount(''); setReceiptNumber(null); setSearchInput('')
              }}>
                New Payment
              </Button>
            </div>
            <Link href={`/school-admin/fees`} className="text-sm text-muted-foreground underline">
              Back to Fee Management
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={`p-6 max-w-2xl mx-auto w-full ${student ? 'space-y-6' : 'flex min-h-[calc(100vh-6rem)] flex-col justify-center space-y-6'}`}>
      <div>
        <Button variant="ghost" size="sm" className="gap-1 -ml-2 mb-2 w-fit text-muted-foreground" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <h1 className="text-2xl font-bold">Collect Fee</h1>
        <p className="text-muted-foreground text-sm">Search student → select items → record payment</p>
      </div>

      {/* ── Step 1: Student Search ── */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserSearch className="w-5 h-5 text-muted-foreground" /> Find Student</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2 relative">
            <LiveSearch<FeeStudentResult>
              placeholder="Start typing admission no. or student name…"
              fetcher={studentFetcher}
              getKey={(s) => s.id}
              onSelect={loadStudentData}
              autoFocus
              className="flex-1"
              renderItem={(s) => (
                <span className="flex flex-col">
                  <span className="font-medium">{s.full_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.admission_number}{s.class_name ? ` · ${s.class_name}${s.section_name ? '-' + s.section_name : ''}` : ''}
                  </span>
                </span>
              )}
            />
          </div>
          {student && (
            <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  {student.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={student.photo_url} alt={student.full_name} className="w-10 h-10 rounded-full object-cover shadow-sm bg-white" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <GraduationCap className="h-5 w-5 text-primary" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-primary">{student.full_name}</p>
                  <p className="text-sm text-primary/80">
                    {student.admission_number} <span className="opacity-50 mx-1">•</span> {student.class_name} {student.section_name}
                  </p>
                </div>
              </div>
              <Badge variant="default" className="bg-primary hover:bg-primary">Selected</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Step 2: Fee Items ── */}
      {student && structures.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">2. Select Fee Items</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {structures.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={s.id}
                    checked={!!selectedItems[s.id]}
                    onCheckedChange={v => setSelectedItems(prev => ({ ...prev, [s.id]: !!v }))}
                  />
                  <Label htmlFor={s.id} className="cursor-pointer">{s.category_name}</Label>
                </div>
                <span className="font-medium">₹{Number(s.amount).toLocaleString('en-IN')}</span>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total Selected</span>
              <span>₹{totalSelected.toLocaleString('en-IN')}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {student && structures.length === 0 && (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            No fee structure defined for this student&apos;s class in the current academic year.
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Payment Details ── */}
      {student && structures.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">3. Payment Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="payment-mode">Payment Mode</Label>
                <Select value={paymentMode} onValueChange={v => setPaymentMode(v as PaymentMode)}>
                  <SelectTrigger id="payment-mode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="discount">Discount (₹)</Label>
                <Input
                  id="discount"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="paid-amount">Paid Amount (₹) *</Label>
                <Input
                  id="paid-amount"
                  type="number"
                  min="0"
                  placeholder={String(netPayable)}
                  value={paidAmount}
                  onChange={e => setPaidAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="reference-no">
                  Reference No.{referenceRequired && ' *'}
                </Label>
                <Input
                  id="reference-no"
                  placeholder={referenceRequired ? 'Cheque / UPI / txn ref' : 'Optional'}
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  aria-invalid={referenceMissing}
                  className={referenceMissing ? 'border-destructive focus-visible:ring-destructive' : undefined}
                />
                {referenceMissing && (
                  <p className="text-xs text-destructive">
                    Required for {PAYMENT_MODES.find(m => m.value === paymentMode)?.label} payments.
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="remarks">Remarks</Label>
              <Input id="remarks" placeholder="Optional remarks" value={remarks} onChange={e => setRemarks(e.target.value)} />
            </div>
            <Separator />
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Net Payable</span>
              <span>₹{netPayable.toLocaleString('en-IN')}</span>
            </div>
            {changeDue > 0 && (
              <div className="flex items-center justify-between text-base text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-4 py-2">
                <span className="font-medium">💵 Change Due (Cash)</span>
                <span className="font-bold">₹{changeDue.toLocaleString('en-IN')}</span>
              </div>
            )}
            {balanceRemaining > 0 && (
              <div className="flex items-center justify-between text-base text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-4 py-2">
                <span className="font-medium">⚠️ Partial — Balance Remaining</span>
                <span className="font-bold">₹{balanceRemaining.toLocaleString('en-IN')}</span>
              </div>
            )}
            <Button
              className="w-full"
              size="lg"
              onClick={handleCollect}
              disabled={saving || !paidAmount || !Number(paidAmount) || referenceMissing}
            >
              {saving ? 'Recording...' : 'Collect & Generate Receipt'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function CollectFeePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading fee collector...</div>}>
      <CollectFeePageContent />
    </Suspense>
  )
}
