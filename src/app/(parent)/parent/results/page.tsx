'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState } from 'react'
import {
  getChildExamsAndResults,
  type ExamResultRow,
} from '../actions'
import { BookOpen, Lock, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'

function getGradeColor(pct: number) {
  if (pct >= 80) return 'text-emerald-600'
  if (pct >= 60) return 'text-blue-600'
  if (pct >= 40) return 'text-amber-600'
  return 'text-red-600'
}

function ExamCard({ exam, feeLocked }: { exam: ExamResultRow; feeLocked: boolean }) {
  const [open, setOpen] = useState(false)

  const locked = feeLocked || !exam.resultVisible

  return (
    <Card className={`overflow-hidden transition-all ${locked ? 'opacity-80' : ''}`}>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => !locked && setOpen(o => !o)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{exam.examName}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {exam.startDate ? new Date(exam.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Date TBD'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {locked ? (
              <Badge variant="secondary" className="gap-1.5">
                <Lock className="h-3 w-3" />
                {feeLocked ? 'Fee Pending' : 'Not Published'}
              </Badge>
            ) : (
              <>
                <span className={`text-xl font-bold ${getGradeColor(exam.percentage)}`}>
                  {exam.percentage}%
                </span>
                {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </>
            )}
          </div>
        </div>
        {!locked && (
          <Progress value={exam.percentage} className="h-1.5 mt-2" />
        )}
      </CardHeader>
      {open && !locked && (
        <CardContent className="pt-0">
          <div className="rounded-lg overflow-hidden border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Subject</th>
                  <th className="px-3 py-2 text-center font-medium">Marks</th>
                  <th className="px-3 py-2 text-center font-medium">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {exam.subjects.map((s, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="px-3 py-2">{s.subjectName}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">
                      {s.isAbsent ? (
                        <span className="text-muted-foreground italic">Absent</span>
                      ) : s.marksObtained !== null ? (
                        <span>{s.marksObtained}/{s.maxMarks}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {s.grade ? <Badge variant="outline" className="text-xs">{s.grade}</Badge> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 text-sm font-semibold border-t">
                <tr>
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-center font-mono text-xs">
                    {exam.totalObtained}/{exam.totalMax}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={getGradeColor(exam.percentage)}>{exam.percentage}%</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
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
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <BookOpen className="h-6 w-6 text-violet-500" /> Results
      </h1>

      {hasPendingFees && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-800">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-amber-600" />
          <div className="text-sm">
            <p className="font-semibold">Fee Balance Pending</p>
            <p className="text-xs mt-0.5">Please clear outstanding dues to unlock exam results. Contact the school office for assistance.</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center gap-3 text-muted-foreground mt-16">
          <BookOpen className="h-12 w-12 opacity-30" />
          <p className="text-sm">No exam results found.</p>
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
