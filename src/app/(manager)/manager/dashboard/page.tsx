'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState } from 'react'
import { getDailyCollectionReport, type FeePaymentRow } from '../../../(school-admin)/school-admin/fees/actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { IndianRupee, Receipt, Search } from 'lucide-react'

const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: 'Cash', cheque: 'Cheque', upi: 'UPI',
  neft: 'NEFT/RTGS', card: 'Card', online: 'Online',
}

export default function ManagerDashboardPage() {
  const { school } = useAuthStore()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]!)
  const [loading, setLoading] = useState(false)
  const [totalCollected, setTotalCollected] = useState(0)
  const [paymentCount, setPaymentCount] = useState(0)
  const [payments, setPayments] = useState<FeePaymentRow[]>([])

  const load = async (d: string) => {
    if (!school?.id) return
    setLoading(true)
    try {
      const res = await getDailyCollectionReport(school.id, d)
      setTotalCollected(res.totalCollected)
      setPaymentCount(res.paymentCount)
      setPayments(res.payments)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(date) }, [school?.id])

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manager Dashboard</h1>
        <p className="text-muted-foreground">Daily fee collection overview</p>
      </div>

      {/* Date picker */}
      <div className="flex gap-2 items-center max-w-sm">
        <Input
          type="date"
          value={date}
          max={new Date().toISOString().split('T')[0]!}
          onChange={e => setDate(e.target.value)}
        />
        <Button onClick={() => load(date)} disabled={loading}>
          <Search className="mr-2 h-4 w-4" />Go
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{totalCollected.toLocaleString('en-IN')}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paymentCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction list */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Transactions</h2>
        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : payments.length === 0 ? (
          <p className="text-muted-foreground">No transactions on {date}.</p>
        ) : (
          <div className="overflow-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Receipt</th>
                  <th className="text-left px-4 py-2 font-medium">Student</th>
                  <th className="text-right px-4 py-2 font-medium">Amount</th>
                  <th className="text-left px-4 py-2 font-medium">Mode</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2 font-mono text-xs">{p.receipt_number}</td>
                    <td className="px-4 py-2">
                      <p className="font-medium">{p.student_name}</p>
                      <p className="text-xs text-muted-foreground">{p.student_admission_number}</p>
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">
                      ₹{Number(p.paid_amount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant="secondary" className="text-xs">
                        {PAYMENT_MODE_LABELS[p.payment_mode] ?? p.payment_mode}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
