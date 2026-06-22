'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/utils'
import { getWeeklyDigest, sendWeeklyDigestEmail, type WeeklyDigest } from './digest-actions'
import { Mail, CalendarRange, IndianRupee, CalendarCheck, AlertCircle, Loader2 } from 'lucide-react'

export function WeeklyDigestCard({ schoolId }: { schoolId: string }) {
  const [digest, setDigest] = useState<WeeklyDigest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setDigest(await getWeeklyDigest(schoolId))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [schoolId])

  useEffect(() => {
    load()
  }, [load])

  const handleSend = async () => {
    setSending(true)
    try {
      const res = await sendWeeklyDigestEmail(schoolId)
      if (res.success) {
        toast.success(`Weekly digest emailed to ${res.to}`)
      } else if (res.skipped) {
        toast.info('Email channel is not configured — digest not sent.')
      } else {
        toast.error(res.error ?? 'Could not send the digest.')
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10">
            <CalendarRange className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Weekly Digest</p>
            <p className="text-xs text-zinc-500">{digest ? digest.rangeLabel : 'Last 7 days'}</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSend}
          disabled={sending || loading || !!error}
          className="gap-2 rounded-full border-white/[0.08] bg-white/[0.04] text-zinc-300 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.14] transition-all text-xs"
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5 text-violet-400" />}
          Email me
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-24 w-full rounded-xl bg-white/5" />
      ) : error ? (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      ) : digest ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Collected',
                value: `₹${digest.totalCollected.toLocaleString('en-IN')}`,
                icon: IndianRupee,
                accent: '#10b981',
              },
              {
                label: 'Attendance',
                value: `${digest.attendancePct}%`,
                icon: CalendarCheck,
                accent: '#06b6d4',
              },
              {
                label: 'Pending Fees',
                value: `₹${digest.totalPendingFees.toLocaleString('en-IN')}`,
                icon: AlertCircle,
                accent: digest.totalPendingFees > 0 ? '#ef4444' : '#6b7280',
              },
              {
                label: 'Students',
                value: digest.activeStudents,
                icon: CalendarRange,
                accent: '#3b82f6',
              },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{s.label}</p>
                  <s.icon className="h-3.5 w-3.5" style={{ color: s.accent }} />
                </div>
                <p className="text-lg font-bold text-white">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
              Top Fee Defaulters
            </p>
            {digest.topDefaulters.length === 0 ? (
              <p className="text-sm text-zinc-500">🎉 No outstanding balances.</p>
            ) : (
              <div className="space-y-1.5">
                {digest.topDefaulters.map((d, i) => (
                  <div key={`${d.studentName}-${i}`} className="flex items-center justify-between gap-2">
                    <p className="text-xs text-zinc-300 truncate">
                      {d.studentName}
                      {d.className ? <span className="text-zinc-600"> · {d.className}</span> : null}
                    </p>
                    <span className="text-xs font-semibold text-red-400 shrink-0">
                      ₹{d.balance.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
