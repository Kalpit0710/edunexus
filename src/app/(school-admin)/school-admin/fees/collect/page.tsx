'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useState } from 'react'
import {
  getStudentFeeStructure,
  collectFeePayment,
  getNextReceiptSeq,
  searchStudentForFee,
  type FeeStructureRow,
} from '../actions'
import { generateReceiptNumber } from '@/lib/fee-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Search, PrinterIcon, CheckCircle } from 'lucide-react'
import Link from 'next/link'

type PaymentMode = 'cash' | 'cheque' | 'upi' | 'neft' | 'card' | 'online'

const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'neft', label: 'NEFT/RTGS' },
  { value: 'card', label: 'Card' },
  { value: 'online', label: 'Online' },
]

export default function CollectFeePage() {
  const { school, user } = useAuthStore()

  // Step 1: search
  const [searchInput, setSearchInput] = useState('')
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

  const totalSelected = structures
    .filter(s => selectedItems[s.id])
    .reduce((sum, s) => sum + Number(s.amount), 0)
  const netPayable = Math.max(0, totalSelected - Number(discount || 0))

  const handleSearch = async () => {
    if (!school?.id || !searchInput.trim()) return
    setSearching(true)
    setStudent(null)
    setStructures([])
    setSelectedItems({})
    setReceiptNumber(null)
    try {
      const found = await searchStudentForFee(school.id, searchInput.trim())
      if (!found) { toast.error('Student not found'); return }
      const { structures: structs } = await getStudentFeeStructure(school.id, found.id)
      setStudent(found)
      setStructures(structs)
      // pre-select all
      const sel: Record<string, boolean> = {}
      structs.forEach(s => { sel[s.id] = true })
      setSelectedItems(sel)
      setPaidAmount(String(structs.reduce((sum, s) => sum + Number(s.amount), 0)))
    } catch (e: any) {
      toast.error(e.message || 'Student not found')
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
    } catch (e: any) {
      toast.error(e.message)
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
            <p className="text-muted-foreground">Receipt Number</p>
            <p className="text-3xl font-mono font-bold tracking-widest">{receiptNumber}</p>
            <p className="text-lg font-semibold">
              ₹{Number(paidAmount).toLocaleString('en-IN')} collected via <span className="capitalize">{paymentMode}</span>
            </p>
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
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Collect Fee</h1>
        <p className="text-muted-foreground text-sm">Search student → select items → record payment</p>
      </div>

      {/* ── Step 1: Student Search ── */}
      <Card>
        <CardHeader><CardTitle className="text-base">1. Find Student</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Admission no. or student name"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
            />
            <Button onClick={handleSearch} disabled={searching || !searchInput.trim()}>
              <Search className="mr-2 h-4 w-4" />
              {searching ? 'Searching...' : 'Search'}
            </Button>
          </div>
          {student && (
            <div className="mt-4 p-3 rounded bg-muted/40 flex items-center justify-between">
              <div>
                <p className="font-semibold">{student.full_name}</p>
                <p className="text-sm text-muted-foreground">
                  {student.admission_number} · {student.class_name} {student.section_name}
                </p>
              </div>
              <Badge variant="default">Found</Badge>
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
                <Label>Payment Mode</Label>
                <Select value={paymentMode} onValueChange={v => setPaymentMode(v as PaymentMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Discount (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Paid Amount (₹) *</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder={String(netPayable)}
                  value={paidAmount}
                  onChange={e => setPaidAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Reference No.</Label>
                <Input placeholder="Cheque/UPI ref (optional)" value={reference} onChange={e => setReference(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Remarks</Label>
              <Input placeholder="Optional remarks" value={remarks} onChange={e => setRemarks(e.target.value)} />
            </div>
            <Separator />
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Net Payable</span>
              <span>₹{netPayable.toLocaleString('en-IN')}</span>
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={handleCollect}
              disabled={saving || !paidAmount || !Number(paidAmount)}
            >
              {saving ? 'Recording...' : 'Collect & Generate Receipt'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
