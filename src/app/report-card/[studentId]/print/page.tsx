'use client'

import { useState, useEffect } from 'react'
import * as React from 'react'
import {
  getPrintableReportCard,
  type PrintableReportCard,
} from '@/app/(school-admin)/school-admin/report-cards/actions'
import {
  ReportCardDocument,
  STANDARD_CSS,
  LOWER_CSS,
} from '@/components/modules/report-cards/ReportCardDocument'
import { Printer, Loader2 } from 'lucide-react'

export default function ReportCardPrintPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = React.use(params)
  const [data, setData] = useState<PrintableReportCard | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPrintableReportCard(studentId)
      .then(setData)
      .finally(() => setLoading(false))
  }, [studentId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 text-zinc-600">
        Report card not found, not published, or you are not authorized to view it.
      </div>
    )
  }

  const isLower = data.reportCardType === 'lower'

  return (
    <div className="srms-screen">
      <style dangerouslySetInnerHTML={{ __html: isLower ? LOWER_CSS : STANDARD_CSS }} />

      <div className="srms-toolbar">
        <button onClick={() => window.print()} className="srms-print-btn">
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </button>
      </div>

      <ReportCardDocument data={data} />
    </div>
  )
}
