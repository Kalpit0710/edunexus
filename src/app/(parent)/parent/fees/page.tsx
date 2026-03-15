'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState } from 'react'
import { getChildFeeStatus, type ChildFeeStatus } from '../actions'
import { IndianRupee, Receipt } from 'lucide-react'
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
    <div className="p-5 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10">
          <IndianRupee className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Fee Status</h1>
          <p className="text-xs text-zinc-500">Track payments & balance</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-2xl bg-white/5" />)}
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Fee', value: `₹${(feeStatus?.totalFee ?? 0).toLocaleString('en-IN')}`, accent: '#3b82f6' },
              { label: 'Total Paid', value: `₹${(feeStatus?.totalPaid ?? 0).toLocaleString('en-IN')}`, accent: '#10b981' },
              { label: 'Balance Due', value: `₹${(feeStatus?.balance ?? 0).toLocaleString('en-IN')}`, accent: feeStatus && feeStatus.balance > 0 ? '#ef4444' : '#10b981' },
            ].map(item => (
              <div key={item.label} className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3 text-center">
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-10 blur-xl"
                  style={{ backgroundColor: item.accent }}
                />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 relative">{item.label}</p>
                <p className="text-sm font-bold mt-1 relative" style={{ color: item.accent }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Balance warning */}
          {feeStatus && feeStatus.balance > 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/8 px-4 py-3">
              <IndianRupee className="h-4 w-4 text-amber-400 shrink-0" />
              <p className="text-sm text-amber-300">
                Please clear your outstanding balance of{' '}
                <strong>₹{feeStatus.balance.toLocaleString('en-IN')}</strong> at the school office.
              </p>
            </div>
          )}

          {/* Payment history */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-2">
              <Receipt className="h-3.5 w-3.5 text-emerald-400" /> Payment History
            </p>
            {feeStatus && feeStatus.recentPayments.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-8 text-center">
                <p className="text-sm text-zinc-500">No payments found.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {feeStatus?.recentPayments.map(p => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 hover:bg-white/[0.05] transition-colors">
                    <div>
                      <p className="text-xs font-mono text-zinc-300">{p.receipt_number}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        {new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] capitalize text-zinc-400">
                        {p.payment_mode}
                      </span>
                      <span className="font-semibold text-sm text-emerald-400">
                        ₹{Number(p.paid_amount).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
