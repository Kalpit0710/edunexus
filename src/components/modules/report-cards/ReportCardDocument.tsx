'use client'

import * as React from 'react'
import type { PrintableReportCard } from '@/app/(school-admin)/school-admin/report-cards/actions'
import type { MarksMap } from '@/lib/report-card-utils'

function fmtDate(d: string | null, locale: string): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(locale || 'en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
}

function n(v: number | null | undefined): string {
  return v === null || v === undefined ? '' : String(v)
}

/** 8-point CBSE grade scale fallback (matches SRMS) when no grading rules exist. */
const GRADE_SCALE: { range: string; grade: string }[] = [
  { range: '91 – 100', grade: 'A1' },
  { range: '81 – 90', grade: 'A2' },
  { range: '71 – 80', grade: 'B1' },
  { range: '61 – 70', grade: 'B2' },
  { range: '51 – 60', grade: 'C1' },
  { range: '41 – 50', grade: 'C2' },
  { range: '33 – 40', grade: 'D' },
  { range: '32 & Below', grade: 'E (Need Improvement)' },
]

/** Short column headers used in the scholastic table (SRMS labels). */
const T1_COLS = [
  { key: 'periodicTest', label: 'Per\nTest' },
  { key: 'notebook', label: 'Note\nBook' },
  { key: 'subEnrichment', label: 'Sub.\nEnrich.' },
  { key: 'halfYearlyExam', label: 'Half\nYearly' },
]
const T2_COLS = [
  { key: 'periodicTest', label: 'Per\nTest' },
  { key: 'notebook', label: 'Note\nBook' },
  { key: 'subEnrichment', label: 'Sub.\nEnrich.' },
  { key: 'yearlyExam', label: 'Yearly\nExam' },
]

/** "Per\nTest" → "Per<br/>Test" */
function splitLabel(label: string): React.ReactNode {
  const parts = label.split('\n')
  return parts.map((p, i) => (
    <React.Fragment key={i}>
      {p}
      {i < parts.length - 1 && <br />}
    </React.Fragment>
  ))
}

function sumObj(obj: MarksMap, keys: string[]): number {
  return keys.reduce((acc, k) => acc + Number(obj[k] ?? 0), 0)
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="srms-field">
      <span className="srms-fl">{label}</span>
      <span className="srms-fc">:</span>
      <span className="srms-fv">{value}</span>
    </div>
  )
}

/**
 * Renders a single A4 report-card page (`.srms-page`). The caller is responsible
 * for injecting the matching stylesheet ({@link STANDARD_CSS} / {@link LOWER_CSS})
 * once on the page. Shared by the single-student and whole-class print routes.
 */
export function ReportCardDocument({ data }: { data: PrintableReportCard }) {
  const schoolAddress = [data.school.address, data.school.city, data.school.state, data.school.pincode]
    .filter(Boolean)
    .join(', ')

  const isLower = data.reportCardType === 'lower'
  const cls = `${data.student.className}${data.student.sectionName ? ' - ' + data.student.sectionName : ''}`

  const sumKey = (term: 'term1' | 'term2', key: string) =>
    data.subjects.reduce((acc, s) => acc + Number((s[term] as MarksMap)[key] ?? 0), 0)
  const sumTotal = (term: 'term1Total' | 'term2Total') =>
    data.subjects.reduce((acc, s) => acc + Number(s[term] ?? 0), 0)
  const firstMax = data.subjects[0]?.maxMarks

  // Grade legend reflects the school's configured grading rules when present,
  // falling back to the default 8-point CBSE scale so the card is never blank.
  const gradeLegend =
    data.gradingRules && data.gradingRules.length > 0
      ? [...data.gradingRules]
          .sort((a, b) => b.min_marks - a.min_marks)
          .map((r) => ({ range: `${r.min_marks} – ${r.max_marks}`, grade: r.grade_name }))
      : GRADE_SCALE
  const gradeHalf = Math.ceil(gradeLegend.length / 2)

  return (
    <div className="srms-page">
      {/* ── HEADER ── */}
      <div className="srms-header">
        {data.school.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- dynamic school logo
          <img src={data.school.logoUrl} alt="Logo" className="srms-logo" />
        ) : (
          <div className="srms-logo srms-logo-ph">LOGO</div>
        )}
        <div className="srms-header-text">
          <div className="srms-school-name">{data.school.name}</div>
          {schoolAddress && <div className="srms-school-address">{schoolAddress}</div>}
          {(data.school.phone || data.school.email) && (
            <div className="srms-school-contact">
              {[data.school.phone, data.school.email].filter(Boolean).join(' · ')}
            </div>
          )}
          <div className="srms-badge">{data.reportTitle}</div>
        </div>
      </div>

      {/* ── STUDENT PROFILE ── */}
      <div className="srms-section-label">Student Details</div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div className="srms-student-grid" style={{ flex: 1 }}>
          <Field label="Name" value={data.student.fullName} />
          <Field label="Admission No." value={data.student.admissionNumber} />
          <Field label="Father's Name" value={data.student.fatherName ?? '—'} />
          <Field label="Mother's Name" value={data.student.motherName ?? '—'} />
          <Field label="Class" value={cls} />
          <Field label="Roll No." value={data.student.rollNumber ?? '—'} />
          <Field label="Date of Birth" value={fmtDate(data.student.dateOfBirth, data.locale)} />
          <Field label="Academic Session" value={data.academicSession ?? '—'} />
        </div>
        {data.student.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- dynamic student photo on printed card
          <img
            src={data.student.photoUrl}
            alt={data.student.fullName}
            style={{
              width: '70px',
              height: '85px',
              objectFit: 'cover',
              border: '1px solid #888',
              flexShrink: 0,
            }}
          />
        )}
      </div>

      {/* ── SCHOLASTIC AREA ── */}
      <div className="srms-section-label">Scholastic Area</div>
      {isLower ? (
        <table className="srms-table srms-lower-table">
          <thead>
            <tr>
              <th rowSpan={2} style={{ width: '26%', textAlign: 'left' }}>
                Subject
              </th>
              <th colSpan={2}>Half Yearly</th>
              <th colSpan={2}>Annual</th>
              <th colSpan={2}>Grand Total</th>
              <th rowSpan={2} style={{ width: '8%' }}>
                Grade
              </th>
            </tr>
            <tr>
              <th>Max</th>
              <th>Obtd.</th>
              <th>Max</th>
              <th>Obtd.</th>
              <th>Max</th>
              <th>Obtd.</th>
            </tr>
          </thead>
          <tbody>
            {data.subjects.map((s) => {
              const max = s.maxGrandTotal / 2
              return (
                <tr key={s.subjectName} className="srms-data-row">
                  <td style={{ textAlign: 'left' }}>{s.subjectName}</td>
                  <td>{max}</td>
                  <td>{s.term1Total}</td>
                  <td>{max}</td>
                  <td>{s.term2Total}</td>
                  <td>{s.maxGrandTotal}</td>
                  <td className="srms-b">{s.grandTotal}</td>
                  <td className="srms-b">{s.grade ?? '—'}</td>
                </tr>
              )
            })}
            <tr className="srms-total-row">
              <td style={{ textAlign: 'left' }}>TOTAL</td>
              <td colSpan={4} />
              <td>{data.overall.totalMax}</td>
              <td className="srms-b">{data.overall.totalObtained}</td>
              <td className="srms-b">{data.overall.grade ?? '—'}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <table className="srms-table srms-marks-table">
          <thead>
            <tr>
              <th rowSpan={3} style={{ width: '15%', textAlign: 'left', verticalAlign: 'middle' }}>
                SUBJECT
              </th>
              <th colSpan={5} className="srms-term-header">
                TERM - 1
              </th>
              <th colSpan={5} className="srms-term-header">
                TERM - 2
              </th>
              <th rowSpan={3} style={{ width: '7%', verticalAlign: 'middle' }}>
                Overall
                <br />
                Assessment
                <br />
                <span style={{ fontWeight: 400, fontSize: 8 }}>(Out of 100)</span>
              </th>
              <th rowSpan={3} style={{ width: '5%', verticalAlign: 'middle' }}>
                Grade
              </th>
            </tr>
            <tr>
              {T1_COLS.map((c) => (
                <th key={`h1${c.key}`}>{splitLabel(data.componentLabels[c.key] ?? c.label)}</th>
              ))}
              <th>Total</th>
              {T2_COLS.map((c) => (
                <th key={`h2${c.key}`}>{splitLabel(data.componentLabels[c.key] ?? c.label)}</th>
              ))}
              <th>Total</th>
            </tr>
            <tr className="srms-max-row">
              {T1_COLS.map((c) => (
                <td key={`m1${c.key}`}>{firstMax ? n((firstMax.term1 as unknown as MarksMap)[c.key] as number) : ''}</td>
              ))}
              <td className="srms-b">
                {firstMax ? sumObj(firstMax.term1 as unknown as MarksMap, T1_COLS.map((c) => c.key)) : ''}
              </td>
              {T2_COLS.map((c) => (
                <td key={`m2${c.key}`}>{firstMax ? n((firstMax.term2 as unknown as MarksMap)[c.key] as number) : ''}</td>
              ))}
              <td className="srms-b">
                {firstMax ? sumObj(firstMax.term2 as unknown as MarksMap, T2_COLS.map((c) => c.key)) : ''}
              </td>
            </tr>
          </thead>
          <tbody>
            {data.subjects.map((s) => (
              <tr key={s.subjectName} className="srms-data-row">
                <td style={{ textAlign: 'left' }}>{s.subjectName}</td>
                {T1_COLS.map((c) => (
                  <td key={`t1${c.key}`}>{n(s.term1[c.key] as number)}</td>
                ))}
                <td className="srms-b">{s.term1Total}</td>
                {T2_COLS.map((c) => (
                  <td key={`t2${c.key}`}>{n(s.term2[c.key] as number)}</td>
                ))}
                <td className="srms-b">{s.term2Total}</td>
                <td className="srms-b">{s.grandTotal}</td>
                <td className="srms-b">{s.grade ?? '—'}</td>
              </tr>
            ))}
            <tr className="srms-total-row">
              <td style={{ textAlign: 'left' }}>TOTAL</td>
              {T1_COLS.map((c) => (
                <td key={`tt1${c.key}`}>{sumKey('term1', c.key)}</td>
              ))}
              <td>{sumTotal('term1Total')}</td>
              {T2_COLS.map((c) => (
                <td key={`tt2${c.key}`}>{sumKey('term2', c.key)}</td>
              ))}
              <td>{sumTotal('term2Total')}</td>
              <td>{data.overall.totalObtained}</td>
              <td>{data.overall.grade ?? '—'}</td>
            </tr>
          </tbody>
        </table>
      )}

      {/* ── SUMMARY BAR ── */}
      <table className="srms-table srms-summary-table">
        <tbody>
          <tr>
            <td className="srms-s-label">Total Marks</td>
            <td className="srms-s-val">
              {data.overall.totalObtained} / {data.overall.totalMax}
            </td>
            <td className="srms-s-label">Percentage</td>
            <td className="srms-s-val">{data.overall.percentage}%</td>
            <td className="srms-s-label">Grade</td>
            <td className="srms-s-val srms-b" style={{ fontSize: 14 }}>
              {data.overall.grade ?? '—'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── CO-SCHOLASTIC AREA ── */}
      <div className="srms-section-label">Co-Scholastic Area</div>
      <div className="srms-coscholastic-note">Assessed on a 5 Points Grading Scale (A to E).</div>
      <table className="srms-table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left', width: '50%' }}>Co-Scholastic Area</th>
            <th style={{ width: '25%' }}>TERM - 1</th>
            <th style={{ width: '25%' }}>TERM - 2</th>
          </tr>
        </thead>
        <tbody>
          {data.coScholastic.map((c) => (
            <tr key={c.area} className="srms-data-row">
              <td style={{ textAlign: 'left' }}>{c.area}</td>
              <td>{c.term1 ?? '—'}</td>
              <td>{c.term2 ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── ATTENDANCE, REMARK, RESULT ── */}
      <table className="srms-table srms-remark-table">
        <thead>
          <tr>
            <th style={{ width: '15%' }} />
            <th style={{ width: '20%' }}>Attendance</th>
            <th style={{ width: '40%' }}>Class Teacher&apos;s Remark</th>
            <th style={{ width: '25%' }}>Result</th>
          </tr>
        </thead>
        <tbody>
          <tr className="srms-data-row">
            <td className="srms-b">TERM 1</td>
            <td>{data.meta.term1Attendance ?? '—'}</td>
            <td rowSpan={2}>{data.meta.remarks ?? ''}</td>
            <td rowSpan={2} className="srms-b">
              {data.meta.resultStatus ?? (data.overall.percentage >= data.passPercentage ? 'Pass' : 'Fail')}
            </td>
          </tr>
          <tr className="srms-data-row">
            <td className="srms-b">TERM 2</td>
            <td>{data.meta.term2Attendance ?? '—'}</td>
          </tr>
        </tbody>
      </table>

      {/* ── SIGNATURES ── */}
      <table className="srms-table srms-sig-table">
        <tbody>
          <tr>
            <td>
              {data.signatures.classTeacherUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- dynamic signature image
                <img src={data.signatures.classTeacherUrl} alt="" className="srms-sign-img" />
              ) : null}
              Signature of Class Teacher
            </td>
            <td>
              {data.signatures.principalUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- dynamic signature image
                <img src={data.signatures.principalUrl} alt="" className="srms-sign-img" />
              ) : null}
              Signature of Principal
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── INSTRUCTIONS / GRADE SCALE ── */}
      <div className="srms-section-label">Instructions</div>
      <div className="srms-coscholastic-note">
        Grading scale for scholastic areas: Grades are awarded on the following scale.
      </div>
      <table className="srms-table srms-grade-table">
        <thead>
          <tr>
            <th>Marks Range</th>
            <th>Grade</th>
            <th>Marks Range</th>
            <th>Grade</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: gradeHalf }).map((_, i) => {
            const left = gradeLegend[i]
            const right = gradeLegend[i + gradeHalf]
            return (
              <tr key={i}>
                <td>{left?.range ?? ''}</td>
                <td className="srms-b">{left?.grade ?? ''}</td>
                <td>{right?.range ?? ''}</td>
                <td className="srms-b">{right?.grade ?? ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Print stylesheets (ported from the SRMS EJS templates) ──────────────────────

const SHARED_CSS = `
  .srms-screen { background: #e5e5e5; padding: 24px 0; }
  .srms-toolbar { max-width: 820px; margin: 0 auto 12px; display: flex; justify-content: flex-end; padding: 0 12px; gap: 8px; }
  .srms-print-btn {
    display: inline-flex; align-items: center; gap: 8px; background: #1a3a5c; color: #fff;
    border: none; border-radius: 8px; padding: 8px 16px; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  .srms-print-btn:hover { opacity: 0.92; }
  .srms-logo { width: 80px; height: 80px; object-fit: contain; flex-shrink: 0; }
  .srms-logo-ph { border: 1.5px solid #ccc; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #aaa; font-size: 13px; }
  .srms-header { display: flex; justify-content: center; align-items: center; gap: 20px; padding: 10px 16px; background: #fff; }
  .srms-header-text { text-align: center; line-height: 1.25; display: flex; flex-direction: column; align-items: center; }
  .srms-school-name { font-size: 21px; font-weight: 800; letter-spacing: 0.2px; }
  .srms-school-address { font-size: 12px; font-weight: 700; margin-top: 2px; }
  .srms-school-contact { font-size: 10px; color: #475569; margin-top: 1px; }
  .srms-badge { margin-top: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; padding: 2px 14px; }
  .srms-student-grid { display: grid; grid-template-columns: 50% 50%; column-gap: 16px; row-gap: 5px; padding: 6px 16px 10px; }
  .srms-field { display: grid; grid-template-columns: 130px 12px 1fr; align-items: center; }
  .srms-fl { font-weight: 700; font-size: 11px; white-space: nowrap; }
  .srms-fc { text-align: center; font-weight: 700; font-size: 11px; }
  .srms-fv { font-size: 11.5px; text-transform: uppercase; font-weight: 600; }
  .srms-table { width: 100%; border-collapse: collapse; font-size: 9.4px; margin-bottom: 8px; table-layout: fixed; }
  .srms-table th, .srms-table td { padding: 3px 4px; text-align: center; vertical-align: middle; line-height: 1.25; }
  .srms-b { font-weight: 700; }
  .srms-coscholastic-note { font-size: 9px; text-align: center; margin-bottom: 6px; font-weight: 700; color: #334155; }
  .srms-sig-table td { height: 64px; vertical-align: bottom; padding-bottom: 6px; font-size: 11px; font-weight: 700; width: 50%; }
  .srms-sign-img { display: block; max-height: 44px; max-width: 180px; margin: 0 auto 2px; object-fit: contain; }
  .srms-grade-table th { font-size: 9px; }
  .srms-grade-table td { font-size: 9px; }
  @media print {
    .srms-screen { background: #fff; padding: 0; }
    .srms-toolbar { display: none; }
    .srms-page { box-shadow: none; max-width: none; transform: none; margin: 0; }
    .srms-page + .srms-page { page-break-before: always; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  @page { size: A4 portrait; margin: 8mm; }
`

export const STANDARD_CSS =
  SHARED_CSS +
  `
  .srms-page { max-width: 820px; margin: 0 auto 24px; background: #fff; color: #0f172a; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; border: 1.6px solid #1e3a5f; box-shadow: 0 10px 40px rgba(0,0,0,0.12); page-break-inside: avoid; }
  .srms-header { border-bottom: 1.6px solid #1e3a5f; }
  .srms-badge { background: #1a3a5c; color: #fff; }
  .srms-section-label { background: #1a3a5c; color: #fff; font-weight: 700; font-size: 12px; letter-spacing: 0.6px; padding: 5px 10px; text-transform: uppercase; }
  .srms-table th, .srms-table td { border: 0.85px solid #475569; }
  .srms-marks-table th { background: #e8b84b; color: #111; font-weight: 700; font-size: 8.5px; }
  .srms-marks-table .srms-term-header { background: #f5d98b; font-size: 10px; letter-spacing: 0.4px; }
  .srms-max-row td { background: #fffae8; font-style: italic; font-size: 8.5px; color: #555; }
  .srms-total-row td { background: #f5d98b; font-weight: 800; font-size: 10px; }
  .srms-table th { background: #e8b84b; }
  .srms-summary-table td { font-size: 11px; }
  .srms-s-label { background: #1a3a5c; color: #fff; font-weight: 700; width: 14%; }
  .srms-s-val { background: #fffae8; font-weight: 700; width: 19%; }
  .srms-remark-table th { background: #e8b84b; }
  .srms-sig-table td { border: 0.85px solid #475569; }
  .srms-grade-table th { background: #e8b84b; }
  .srms-grade-table td { border: 0.85px solid #475569; }
  .srms-page > .srms-section-label,
  .srms-page > .srms-table,
  .srms-page > .srms-coscholastic-note { margin-left: 8px; margin-right: 8px; width: calc(100% - 16px); }
`

export const LOWER_CSS =
  SHARED_CSS +
  `
  .srms-page { max-width: 820px; margin: 0 auto 24px; background: #fff; color: #0f172a; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; border: 1.6px solid #a32a2a; box-shadow: 0 10px 40px rgba(0,0,0,0.12); page-break-inside: avoid; }
  .srms-header { border-bottom: 1.6px solid #a32a2a; }
  .srms-school-address { color: #a32a2a; }
  .srms-badge { background: #a32a2a; color: #fff; }
  .srms-section-label { background: #a32a2a; color: #fff; font-weight: 700; font-size: 12px; letter-spacing: 0.6px; padding: 5px 10px; text-transform: uppercase; }
  .srms-table th, .srms-table td { border: 0.85px solid #334155; }
  .srms-lower-table th { background: #fce5cd; color: #a32a2a; font-weight: 700; font-size: 9px; }
  .srms-data-row td { background: #fff; }
  .srms-total-row td { background: #d9ead3; font-weight: 800; }
  .srms-table th { background: #fce5cd; color: #a32a2a; }
  .srms-summary-table td { font-size: 11px; }
  .srms-s-label { background: #a32a2a; color: #fff; font-weight: 700; width: 14%; }
  .srms-s-val { background: #ead1dc; font-weight: 700; width: 19%; }
  .srms-sig-table td { border: 0.85px solid #334155; }
  .srms-grade-table td { border: 0.85px solid #334155; }
  .srms-page > .srms-section-label,
  .srms-page > .srms-table,
  .srms-page > .srms-coscholastic-note { margin-left: 8px; margin-right: 8px; width: calc(100% - 16px); }
`
