import JSZip from 'jszip'
import type { NextRequest } from 'next/server'
import { getClassPrintableReportCards, type PrintableReportCard } from '@/app/(school-admin)/school-admin/report-cards/actions'
import { createSimplePdf } from '@/lib/simple-pdf'

function sanitizeFilePart(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'report-card'
}

function buildLines(card: PrintableReportCard): string[] {
  return [
    `${card.school.name} - ${card.reportTitle}`,
    `Student: ${card.student.fullName}`,
    `Admission No: ${card.student.admissionNumber}`,
    `Roll No: ${card.student.rollNumber ?? 'N/A'}`,
    `Class: ${card.student.className}${card.student.sectionName ? ` - ${card.student.sectionName}` : ''}`,
    `Academic Session: ${card.academicSession ?? 'N/A'}`,
    '',
    'Subjects:',
    ...card.subjects.map((subject) => (
      `- ${subject.subjectName}: ${subject.grandTotal}/${subject.maxGrandTotal} | ${subject.percentage}% | Grade ${subject.grade ?? '-'}`
    )),
    '',
    'Co-Scholastic:',
    ...card.coScholastic.map((area) => `- ${area.area}: ${area.term1 ?? '-'} / ${area.term2 ?? '-'}`),
    '',
    `Overall: ${card.overall.totalObtained}/${card.overall.totalMax}`,
    `Percentage: ${card.overall.percentage}%`,
    `Grade: ${card.overall.grade ?? '-'}`,
    `Result: ${card.meta.resultStatus ?? 'N/A'}`,
    `Remarks: ${card.meta.remarks ?? 'N/A'}`,
  ]
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const { classId } = await params
  const sectionId = request.nextUrl.searchParams.get('section') || undefined

  const cards = await getClassPrintableReportCards(classId, sectionId)
  if (!cards.length) {
    return new Response('No report cards found for the selected class.', { status: 404 })
  }

  const zip = new JSZip()
  for (const card of cards) {
    const fileName = `${sanitizeFilePart(card.student.admissionNumber)}-${sanitizeFilePart(card.student.fullName)}.pdf`
    zip.file(fileName, createSimplePdf(buildLines(card)))
  }

  const archive = await zip.generateAsync({ type: 'uint8array' })
  const archiveName = `${sanitizeFilePart(cards[0]?.student.className || 'class')}-report-cards.zip`

  return new Response(Buffer.from(archive), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${archiveName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}