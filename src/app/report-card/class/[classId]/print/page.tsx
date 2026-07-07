'use client'

import { Suspense, useState, useEffect } from 'react'
import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import {
  getClassPrintableReportCards,
  type PrintableReportCard,
} from '@/app/(school-admin)/school-admin/report-cards/actions'
import {
  ReportCardDocument,
  STANDARD_CSS,
  LOWER_CSS,
} from '@/components/modules/report-cards/ReportCardDocument'
import { ArrowLeft, Loader2, Printer } from 'lucide-react'

export default function ClassReportCardsPrintPage({
  params,
}: {
  params: Promise<{ classId: string }>
}) {
  const { classId } = React.use(params)
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-100 text-zinc-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <ClassReportCards classId={classId} />
    </Suspense>
  )
}

function ClassReportCards({ classId }: { classId: string }) {
  const searchParams = useSearchParams()
  const sectionId = searchParams.get('section') || undefined

  const [cards, setCards] = useState<PrintableReportCard[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getClassPrintableReportCards(classId, sectionId)
      .then(setCards)
      .finally(() => setLoading(false))
  }, [classId, sectionId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!cards || cards.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 text-zinc-600">
        No report cards to print for this class.
      </div>
    )
  }

  const isLower = cards[0]?.reportCardType === 'lower'

  return (
    <div className="srms-screen">
      <style dangerouslySetInnerHTML={{ __html: isLower ? LOWER_CSS : STANDARD_CSS }} />

      <div className="print:hidden mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <button
          onClick={() => {
            if (window.history.length > 1) {
              window.history.back()
              return
            }
            window.location.assign('/school-admin/report-cards')
          }}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Printer className="h-4 w-4" /> Print Again
        </button>
      </div>

      <div className="srms-toolbar">
        <button onClick={() => window.print()} className="srms-print-btn">
          <Printer className="h-4 w-4" /> Print all ({cards.length}) / Save as PDF
        </button>
      </div>

      {cards.map((card, i) => (
        <ReportCardDocument key={`${card.student.admissionNumber}-${i}`} data={card} />
      ))}
    </div>
  )
}
