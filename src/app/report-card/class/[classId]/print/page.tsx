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
import { Printer, Loader2 } from 'lucide-react'

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
