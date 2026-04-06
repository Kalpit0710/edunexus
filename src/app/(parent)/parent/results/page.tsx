'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState } from 'react'
import { getChildExamsAndResults, type ExamResultRow } from '../actions'
import { BookOpen, Lock, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

function getGradeAccent(pct: number): string {
  if (pct >= 80) return '#10b981'
  if (pct >= 60) return '#3b82f6'
  if (pct >= 40) return '#f59e0b'
  return '#ef4444'
}

function ExamCard({ exam, feeLocked }: { exam: ExamResultRow; feeLocked: boolean }) {
  const [open, setOpen] = useState(false)
  const locked = feeLocked || !exam.resultVisible
  const accent = getGradeAccent(exam.percentage)

  return (
    <div className={`rounded-2xl border transition-all duration-200 overflow-hidden ${locked ? 'border-white/[0.05] bg-white/[0.02] opacity-75' : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/[0.12]'}`}>
      {/* Header row */}
      <div
        className={`flex items-center gap-4 p-4 ${!locked ? 'cursor-pointer select-none' : ''}`}
        onClick={() => !locked && setOpen(o => !o)}
      >
        {/* Colour accent bar */}
        {!locked && (
          <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: accent }} />
        )}

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm truncate">{exam.examName}</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {exam.startDate
              ? new Date(exam.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
              : 'Date TBD'}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {locked ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-400">
              <Lock className="h-3 w-3" />
              {feeLocked ? 'Fee Pending' : 'Not Published'}
            </span>
          ) : (
            <>
              <span className="text-xl font-bold" style={{ color: accent }}>{exam.percentage}%</span>
              {/* Progress ring (simple arc via border trick) */}
              <div className="relative h-8 w-8">
                <svg className="h-8 w-8 -rotate-90" viewBox="0 0 32 32">
                  <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
                  <circle
                    cx="16" cy="16" r="12" fill="none"
                    stroke={accent} strokeWidth="3"
                    strokeDasharray={`${(exam.percentage / 100) * 75.4} 75.4`}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              {open ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
            </>
          )}
        </div>
      </div>

      {/* Subject breakdown */}
      {open && !locked && (
        <div className="border-t border-white/[0.06] px-4 pb-4">
          <div className="mt-3 rounded-xl overflow-hidden border border-white/[0.06]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Subject</th>
                  <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Marks</th>
                  <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Grade</th>
                </tr>
              </thead>
              <tbody>
                {exam.subjects.map((s, i) => (
                  <tr key={i} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors">
                    <td className="px-3 py-2 text-zinc-300 text-xs">{s.subjectName}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs text-zinc-400">
                      {s.isAbsent ? (
                        <span className="text-zinc-600 italic">Absent</span>
                      ) : s.marksObtained !== null ? (
                        <span>{s.marksObtained}/{s.maxMarks}</span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {s.grade ? (
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                          {s.grade}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/[0.08] bg-white/[0.02]">
                  <td className="px-3 py-2 text-xs font-semibold text-zinc-400">Total</td>
                  <td className="px-3 py-2 text-center font-mono text-xs font-semibold text-white">{exam.totalObtained}/{exam.totalMax}</td>
                  <td className="px-3 py-2 text-center text-xs font-bold" style={{ color: accent }}>{exam.percentage}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ResultsPage() {
  const { school, activeChildId } = useAuthStore()
  const [results, setResults] = useState<ExamResultRow[]>([])
  const [hasPendingFees, setHasPendingFees] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const childId = activeChildId
    if (!childId || !school?.id) return
    setLoading(true)
    getChildExamsAndResults(childId, school.id).then(({ results, hasPendingFees }) => {
      setResults(results)
      setHasPendingFees(hasPendingFees)
      setLoading(false)
    })
  }, [activeChildId, school?.id])

  return (
    <div className="p-5 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-500/25 bg-violet-600/10">
          <BookOpen className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Exam Results</h1>
          <p className="text-xs text-zinc-500">Click an exam to expand subject-wise marks</p>
        </div>
      </div>

      {/* Fee pending warning */}
      {hasPendingFees && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/8 p-4">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-amber-400" />
          <div>
            <p className="font-semibold text-white text-sm">Fee Balance Pending</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Results are locked. Please clear outstanding dues to view exam marks.
            </p>
          </div>
        </div>
      )}

      {/* Results list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl bg-white/5" />)}
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center gap-3 mt-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <BookOpen className="h-8 w-8 text-zinc-600" />
          </div>
          <p className="text-sm text-zinc-500">No exam results found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map(exam => (
            <ExamCard key={exam.examId} exam={exam} feeLocked={hasPendingFees} />
          ))}
        </div>
      )}
    </div>
  )
}
