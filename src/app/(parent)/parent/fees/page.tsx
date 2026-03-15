'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState } from 'react'
import { getChildFeeStatus, type ChildFeeStatus } from '../actions'
import { IndianRupee, Receipt } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export default function FeesPage() {
  const { school, activeChildId } = useAuthStore()
  const [feeStatus, setFeeStatus] = useState<ChildFeeStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const childId = activeChildId
    if (!childId || !school?.id) return
    setLoading(true)
    getChildFeeStatus(childId, school.id).then(data => {
      setFeeStatus(data)
      setLoading(false)
    })
  }, [activeChildId, school?.id])

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <IndianRupee className="h-6 w-6 text-emerald-500" /> Fee Status
      </h1>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Fee', value: `₹${(feeStatus?.totalFee ?? 0).toLocaleString('en-IN')}`, color: 'text-foreground' },
              { label: 'Total Paid', value: `₹${(feeStatus?.totalPaid ?? 0).toLocaleString('en-IN')}`, color: 'text-emerald-600' },
              { label: 'Balance Due', value: `₹${(feeStatus?.balance ?? 0).toLocaleString('en-IN')}`, color: feeStatus && feeStatus.balance > 0 ? 'text-destructive' : 'text-emerald-600' },
            ].map(item => (
              <Card key={item.label}>
                <CardContent className="pt-3 pb-3 text-center">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{item.label}</p>
                  <p className={`text-base font-bold mt-1 ${item.color}`}>{item.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {feeStatus && feeStatus.balance > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
              <IndianRupee className="h-4 w-4 shrink-0" />
              Please clear your outstanding balance of <strong>₹{feeStatus.balance.toLocaleString('en-IN')}</strong> at the school office.
            </div>
          )}

          {/* Payment history */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Receipt className="h-4 w-4 text-emerald-500" /> Payment History
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {feeStatus && feeStatus.recentPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No payments found.</p>
              ) : (
                <div className="space-y-2">
                  {feeStatus?.recentPayments.map(p => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5">
                      <div>
                        <p className="text-xs font-mono">{p.receipt_number}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] capitalize">{p.payment_mode}</Badge>
                        <span className="font-semibold text-sm text-emerald-600">₹{Number(p.paid_amount).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
