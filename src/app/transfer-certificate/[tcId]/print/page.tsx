'use client'

import { useState, useEffect } from 'react'
import * as React from 'react'
import { getTransferCertificate, type TransferCertificateView } from '@/app/(school-admin)/school-admin/students/tc-actions'
import { Printer, Loader2 } from 'lucide-react'

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function TransferCertificatePrintPage({ params }: { params: Promise<{ tcId: string }> }) {
  const { tcId } = React.use(params)
  const [tc, setTc] = useState<TransferCertificateView | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTransferCertificate(tcId)
      .then(setTc)
      .finally(() => setLoading(false))
  }, [tcId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!tc) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 text-zinc-600">
        Certificate not found or you are not authorized to view it.
      </div>
    )
  }

  const schoolAddress = [tc.school.address, tc.school.city, tc.school.state, tc.school.pincode]
    .filter(Boolean)
    .join(', ')

  const rows: [string, string][] = [
    ['Certificate No.', tc.tcNumber],
    ['Admission No.', tc.admissionNumber || '—'],
    ['Date of Birth', fmtDate(tc.dateOfBirth)],
    ['Class', tc.className || '—'],
    ['Date of Admission', fmtDate(tc.admissionDate)],
    ['Date of Leaving', fmtDate(tc.leavingDate)],
    ['Conduct', tc.conduct || 'Satisfactory'],
    ['Reason for Leaving', tc.reason || '—'],
  ]

  return (
    <div className="min-h-screen bg-zinc-100 py-8 print:bg-white print:py-0">
      {/* Toolbar — hidden when printing */}
      <div className="mx-auto mb-4 flex max-w-[800px] justify-end px-4 print:hidden">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </button>
      </div>

      {/* Certificate sheet */}
      <div className="mx-auto max-w-[800px] bg-white p-12 text-zinc-900 shadow-lg print:max-w-none print:p-10 print:shadow-none">
        {/* Letterhead */}
        <div className="border-b-2 border-zinc-800 pb-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- dynamic school logo */}
          {tc.school.logoUrl && <img src={tc.school.logoUrl} alt="" className="mx-auto mb-2 h-16 w-16 object-contain" />}
          <h1 className="text-2xl font-bold uppercase tracking-wide">{tc.school.name}</h1>
          {schoolAddress && <p className="mt-1 text-sm text-zinc-600">{schoolAddress}</p>}
          <p className="text-sm text-zinc-600">
            {[tc.school.phone, tc.school.email].filter(Boolean).join(' · ')}
          </p>
        </div>

        <h2 className="my-6 text-center text-lg font-bold uppercase underline underline-offset-4">
          Transfer Certificate
        </h2>

        {/* Body */}
        <p className="mb-6 text-[15px] leading-7">
          This is to certify that <strong>{tc.studentName}</strong>
          {tc.admissionNumber ? ` (Admission No. ${tc.admissionNumber})` : ''} was a bona fide student of this
          institution
          {tc.className ? ` studying in ${tc.className}` : ''}. The particulars relating to the student, as per
          the school records, are given below.
        </p>

        <table className="mb-8 w-full border-collapse text-[15px]">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-b border-zinc-200">
                <td className="w-1/2 py-2 pr-4 font-medium text-zinc-700">{label}</td>
                <td className="py-2 text-zinc-900">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {tc.remarks && (
          <p className="mb-8 text-[15px]">
            <span className="font-medium">Remarks:</span> {tc.remarks}
          </p>
        )}

        {/* Signatures */}
        <div className="mt-16 flex items-end justify-between text-sm">
          <div>
            <p>Date of Issue: {fmtDate(tc.issueDate)}</p>
            {tc.issuedByName && <p className="mt-1 text-zinc-600">Issued by: {tc.issuedByName}</p>}
          </div>
          <div className="text-center">
            <div className="mb-1 h-px w-44 bg-zinc-800" />
            <p className="font-medium">Principal / Authorised Signatory</p>
          </div>
        </div>
      </div>
    </div>
  )
}
