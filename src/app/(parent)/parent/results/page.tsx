'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/utils'
import { DataLoadError } from '@/components/shared/DataLoadError'
import { Skeleton } from '@/components/ui/skeleton'
import { Printer, Lock, GraduationCap } from 'lucide-react'
import Link from 'next/link'
import {
  getParentChildData,
  getChildFeeStatus,
  type ParentChildData,
} from '../actions'
import {
  getPrintableReportCard,
  type PrintableReportCard,
} from '../../../(school-admin)/school-admin/report-cards/actions'

export default function ParentResultsPage() {
  const { user, school, activeChildId } = useAuthStore()

  const [child, setChild] = useState<ParentChildData | null>(null)
  const [card, setCard] = useState<PrintableReportCard | null>(null)
  const [feeLocked, setFeeLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadResults = useCallback(async () => {
    if (!user?.email || !school?.id) return
    setLoading(true)
    setError(null)
    try {
      const childData = await getParentChildData(user.email, school.id, activeChildId)
      if (!childData) {
        setChild(null)
        setCard(null)
        return
      }
      setChild(childData)

      const [reportCard, fee] = await Promise.all([
        getPrintableReportCard(childData.id),
        getChildFeeStatus(childData.id, school.id),
      ])
      setFeeLocked((school.lock_results_on_fee ?? false) && fee.balance > 0)
      setCard(reportCard)
    } catch (err) {
      setError(getErrorMessage(err))
      toast.error('Unable to load the report card. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [user?.email, school?.id, activeChildId])

  useEffect(() => {
    loadResults()
  }, [loadResults])

  const isLower = card?.reportCardType === 'lower'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Report Card</h1>
          <p className="text-xs text-zinc-500">Scholastic & co-scholastic performance</p>
        </div>
        {card && !feeLocked && (
          <Link
            href={`/report-card/${child?.id}/print` as never}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            <Printer className="h-4 w-4" /> Print
          </Link>
        )}
      </div>

      {feeLocked && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <Lock className="h-4 w-4 shrink-0" />
          Results are locked. Please clear outstanding dues to view the report card.
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <DataLoadError title="Couldn’t load report card" message={error} onRetry={() => loadResults()} retrying={loading} />
      ) : feeLocked ? null : !card ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.03] py-12 text-center">
          <GraduationCap className="mb-2 h-8 w-8 text-zinc-600" />
          <p className="text-sm text-zinc-400">No published report card yet.</p>
          <p className="text-xs text-zinc-600">It will appear here once the school publishes results.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <SummaryStat label="Total" value={`${card.overall.totalObtained}/${card.overall.totalMax}`} />
            <SummaryStat label="Percentage" value={`${card.overall.percentage}%`} />
            <SummaryStat label="Grade" value={card.overall.grade ?? '—'} />
          </div>

          {/* Scholastic */}
          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03]">
            <p className="border-b border-white/[0.07] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Scholastic Area
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-zinc-500">
                    <th className="px-4 py-2 text-left font-medium">Subject</th>
                    <th className="px-3 py-2 text-center font-medium">Term 1</th>
                    <th className="px-3 py-2 text-center font-medium">Term 2</th>
                    <th className="px-3 py-2 text-center font-medium">{isLower ? 'Grand Total' : 'Grand'}</th>
                    <th className="px-3 py-2 text-center font-medium">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {card.subjects.map((s) => (
                    <tr key={s.subjectName} className="border-t border-white/[0.05]">
                      <td className="px-4 py-2 text-left text-white">{s.subjectName}</td>
                      <td className="px-3 py-2 text-center font-mono text-xs text-zinc-300">{s.term1Total}</td>
                      <td className="px-3 py-2 text-center font-mono text-xs text-zinc-300">{s.term2Total}</td>
                      <td className="px-3 py-2 text-center font-mono text-xs font-semibold text-white">
                        {s.grandTotal} / {s.maxGrandTotal}
                      </td>
                      <td className="px-3 py-2 text-center text-xs font-bold text-purple-300">{s.grade ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Co-scholastic */}
          {card.coScholastic.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03]">
              <p className="border-b border-white/[0.07] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Co-Scholastic Areas
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-zinc-500">
                    <th className="px-4 py-2 text-left font-medium">Area</th>
                    <th className="px-3 py-2 text-center font-medium">Term 1</th>
                    <th className="px-3 py-2 text-center font-medium">Term 2</th>
                  </tr>
                </thead>
                <tbody>
                  {card.coScholastic.map((c) => (
                    <tr key={c.area} className="border-t border-white/[0.05]">
                      <td className="px-4 py-2 text-left text-white">{c.area}</td>
                      <td className="px-3 py-2 text-center text-zinc-300">{c.term1 ?? '—'}</td>
                      <td className="px-3 py-2 text-center text-zinc-300">{c.term2 ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Attendance & remarks */}
          <div className="grid grid-cols-2 gap-3">
            <SummaryStat label="Attendance (Term 1)" value={card.meta.term1Attendance ?? '—'} />
            <SummaryStat label="Attendance (Term 2)" value={card.meta.term2Attendance ?? '—'} />
          </div>
          {card.meta.remarks && (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 text-sm text-zinc-300">
              <span className="font-medium text-white">Remarks: </span>
              {card.meta.remarks}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  )
}
