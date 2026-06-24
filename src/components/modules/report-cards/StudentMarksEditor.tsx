'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth.store'
import { getErrorMessage } from '@/lib/utils'
import { toast } from 'sonner'
import {
  getStudentReportData,
  saveScholasticMark,
  saveCoScholasticMark,
  saveStudentMeta,
  type StudentReportData,
} from '@/app/(school-admin)/school-admin/report-cards/actions'
import {
  STANDARD_TERM1_FIELDS,
  STANDARD_TERM2_FIELDS,
  CO_SCHOLASTIC_GRADES,
  RESULT_STATUSES,
  calcStandardSubjectResult,
  calcLowerSubjectResult,
  calcOverallResult,
  resolveGrade,
  parseMarkInput,
  validateComponentMark,
  type MarksMap,
  type SubjectResult,
} from '@/lib/report-card-utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { InlineLoader } from '@/components/loaders/page-loaders'
import { DataLoadError } from '@/components/shared/DataLoadError'
import { usePermissions } from '@/hooks/use-permissions'
import { ArrowLeft, Save, Printer, Lock } from 'lucide-react'

type SubjectMarks = Record<string, { term1: Record<string, string>; term2: Record<string, string> }>

export interface StudentMarksEditorProps {
  studentId: string
  /** Where the back arrow returns to (route-group specific). */
  backHref: string
}

export function StudentMarksEditor({ studentId, backHref }: StudentMarksEditorProps) {
  const { school } = useAuthStore()
  const schoolId = school?.id ?? ''
  const { can } = usePermissions()
  const canEdit = can('exams.enter_marks')

  const [data, setData] = useState<StudentReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // editable state
  const [subjectMarks, setSubjectMarks] = useState<SubjectMarks>({})
  const [coMarks, setCoMarks] = useState<Record<string, { term1: string; term2: string }>>({})
  const [meta, setMeta] = useState({
    term1Attendance: '',
    term2Attendance: '',
    remarks: '',
    resultStatus: '',
  })

  const load = useCallback(async () => {
    if (!schoolId || !studentId) return
    setLoading(true)
    setError(null)
    try {
      const d = await getStudentReportData(schoolId, studentId)
      if (!d) {
        setError('Student not found.')
        return
      }
      setData(d)

      const sm: SubjectMarks = {}
      for (const cfg of d.configs) {
        const existing = d.scholastic.find((s) => s.subjectId === cfg.subjectId)
        const t1: Record<string, string> = {}
        const t2: Record<string, string> = {}
        const keys =
          d.student.reportCardType === 'lower'
            ? cfg.components.map((c) => c.name)
            : [...STANDARD_TERM1_FIELDS.map((f) => f.key)]
        const t2keys =
          d.student.reportCardType === 'lower'
            ? cfg.components.map((c) => c.name)
            : [...STANDARD_TERM2_FIELDS.map((f) => f.key)]
        keys.forEach((k) => {
          const v = existing?.term1?.[k]
          t1[k] = v === null || v === undefined ? '' : String(v)
        })
        t2keys.forEach((k) => {
          const v = existing?.term2?.[k]
          t2[k] = v === null || v === undefined ? '' : String(v)
        })
        sm[cfg.subjectId] = { term1: t1, term2: t2 }
      }
      setSubjectMarks(sm)

      const cm: Record<string, { term1: string; term2: string }> = {}
      for (const c of d.coScholastic) {
        cm[c.area] = { term1: c.term1 ?? '', term2: c.term2 ?? '' }
      }
      setCoMarks(cm)

      setMeta({
        term1Attendance: d.meta.term1Attendance ?? '',
        term2Attendance: d.meta.term2Attendance ?? '',
        remarks: d.meta.remarks ?? '',
        resultStatus: d.meta.resultStatus ?? '',
      })
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [schoolId, studentId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <InlineLoader label="Loading marks…" className="mt-20" />
  if (error) return <DataLoadError message={error} onRetry={load} />
  if (!data) return null

  const isLower = data.student.reportCardType === 'lower'
  const locked = data.publication?.status === 'locked'

  function toMap(rec: Record<string, string>): MarksMap {
    const out: MarksMap = {}
    for (const [k, v] of Object.entries(rec)) {
      const n = parseMarkInput(v)
      if (n !== undefined) out[k] = n
    }
    return out
  }

  function subjectResult(subjectId: string): SubjectResult | null {
    const cfg = data!.configs.find((c) => c.subjectId === subjectId)
    const sm = subjectMarks[subjectId]
    if (!cfg || !sm) return null
    return isLower
      ? calcLowerSubjectResult(toMap(sm.term1), toMap(sm.term2), cfg.components)
      : calcStandardSubjectResult(toMap(sm.term1), toMap(sm.term2), cfg.maxMarks, data!.grandTotalRule)
  }

  const overall = calcOverallResult(
    data.configs.map((c) => subjectResult(c.subjectId)).filter((r): r is SubjectResult => !!r),
  )
  const overallGrade = resolveGrade(overall.percentage, data.gradingRules)

  async function saveAll() {
    if (locked) {
      toast.error('Reports are locked. Unlock from the Publish tab to edit.')
      return
    }
    setSaving(true)
    try {
      const classId = data!.student.classId
      if (!classId) throw new Error('Student has no class assigned.')

      // Validate everything up-front so an invalid value can never leave a
      // partially-saved report (saves run sequentially per subject).
      for (const cfg of data!.configs) {
        const sm = subjectMarks[cfg.subjectId]
        if (!sm) continue
        const check = (rec: Record<string, string>, key: string, max: number) => {
          const err = validateComponentMark(parseMarkInput(rec[key] ?? ''), max)
          if (err) throw new Error(`${cfg.subjectName} — ${key}: ${err}`)
        }
        if (isLower) {
          for (const c of cfg.components) {
            check(sm.term1, c.name, c.maxMarks)
            check(sm.term2, c.name, c.maxMarks)
          }
        } else {
          for (const f of STANDARD_TERM1_FIELDS) {
            check(sm.term1, f.key, (cfg.maxMarks.term1 as unknown as Record<string, number>)[f.key] ?? 0)
          }
          for (const f of STANDARD_TERM2_FIELDS) {
            check(sm.term2, f.key, (cfg.maxMarks.term2 as unknown as Record<string, number>)[f.key] ?? 0)
          }
        }
      }

      for (const cfg of data!.configs) {
        const sm = subjectMarks[cfg.subjectId]
        if (!sm) continue
        await saveScholasticMark(
          schoolId,
          classId,
          studentId,
          cfg.subjectId,
          toMap(sm.term1),
          toMap(sm.term2),
        )
      }
      for (const [area, val] of Object.entries(coMarks)) {
        await saveCoScholasticMark(schoolId, studentId, area, val.term1 || null, val.term2 || null)
      }
      await saveStudentMeta(schoolId, studentId, {
        term1Attendance: meta.term1Attendance || null,
        term2Attendance: meta.term2Attendance || null,
        remarks: meta.remarks || null,
        resultStatus: meta.resultStatus || null,
      })
      toast.success('Report saved')
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  function setMark(subjectId: string, term: 'term1' | 'term2', key: string, value: string) {
    setSubjectMarks((prev) => {
      const current = prev[subjectId] ?? { term1: {}, term2: {} }
      return {
        ...prev,
        [subjectId]: {
          ...current,
          [term]: { ...current[term], [key]: value },
        },
      }
    })
  }

  return (
    <div className="px-6 py-6 space-y-5 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={backHref as never}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">{data.student.fullName}</h1>
            <p className="text-sm text-zinc-500">
              {data.student.className}
              {data.student.sectionName ? ` · ${data.student.sectionName}` : ''} · Roll{' '}
              {data.student.rollNumber ?? '—'} · {data.student.admissionNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/report-card/${studentId}/print` as never} target="_blank">
            <Button variant="ghost">
              <Printer className="mr-1.5 h-4 w-4" /> Print
            </Button>
          </Link>
          <Button onClick={saveAll} loading={saving} loadingText="Saving…" disabled={locked || !canEdit}>
            <Save className="mr-1.5 h-4 w-4" /> Save report
          </Button>
        </div>
      </div>

      {locked && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-300">
          <Lock className="h-4 w-4" /> This report is published &amp; locked. Unlock from the Publish tab to edit.
        </div>
      )}

      {/* Scholastic */}
      <Card className="border-white/10 bg-white/[0.02] p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Scholastic marks</h2>
        {data.configs.length === 0 ? (
          <p className="text-sm text-zinc-500">No subjects configured for this class.</p>
        ) : (
          <div className="space-y-4">
            {data.configs.map((cfg) => {
              const res = subjectResult(cfg.subjectId)
              const grade = res ? resolveGrade(res.percentage, data.gradingRules) : null
              const t1Fields = isLower
                ? cfg.components.map((c) => ({ key: c.name, label: c.name, max: c.maxMarks }))
                : STANDARD_TERM1_FIELDS.map((f) => ({
                    key: f.key,
                    label: data.componentLabels[f.key] ?? f.label,
                    max: (cfg.maxMarks.term1 as unknown as Record<string, number>)[f.key],
                  }))
              const t2Fields = isLower
                ? cfg.components.map((c) => ({ key: c.name, label: c.name, max: c.maxMarks }))
                : STANDARD_TERM2_FIELDS.map((f) => ({
                    key: f.key,
                    label: data.componentLabels[f.key] ?? f.label,
                    max: (cfg.maxMarks.term2 as unknown as Record<string, number>)[f.key],
                  }))
              return (
                <div key={cfg.subjectId} className="rounded-xl border border-white/[0.07] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium text-white">{cfg.subjectName}</p>
                    {res && (
                      <p className="text-xs text-zinc-400">
                        Grand: <span className="text-white">{res.grandTotal}</span> / {res.maxGrandTotal} ·{' '}
                        <span className="text-white">{res.percentage}%</span>
                        {grade && <span className="ml-1 text-blue-400">({grade})</span>}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TermGrid
                      title="Term 1"
                      fields={t1Fields}
                      values={subjectMarks[cfg.subjectId]?.term1 ?? {}}
                      onChange={(k, v) => setMark(cfg.subjectId, 'term1', k, v)}
                      disabled={locked}
                    />
                    <TermGrid
                      title="Term 2"
                      fields={t2Fields}
                      values={subjectMarks[cfg.subjectId]?.term2 ?? {}}
                      onChange={(k, v) => setMark(cfg.subjectId, 'term2', k, v)}
                      disabled={locked}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div className="mt-3 flex justify-end text-sm text-zinc-300">
          Overall: <span className="ml-1 font-semibold text-white">{overall.percentage}%</span>
          {overallGrade && <span className="ml-1 text-blue-400">({overallGrade})</span>}
        </div>
      </Card>

      {/* Co-scholastic */}
      <Card className="border-white/10 bg-white/[0.02] p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Co-scholastic areas (grade A–E)</h2>
        <div className="space-y-2">
          {data.coScholastic.map((c) => (
            <div key={c.area} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
              <span className="text-sm text-zinc-300">{c.area}</span>
              {(['term1', 'term2'] as const).map((term) => (
                <Select
                  key={term}
                  value={coMarks[c.area]?.[term] || '__none__'}
                  onValueChange={(v) =>
                    setCoMarks((prev) => ({
                      ...prev,
                      [c.area]: {
                        ...(prev[c.area] ?? { term1: '', term2: '' }),
                        [term]: v === '__none__' ? '' : v,
                      },
                    }))
                  }
                  disabled={locked}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder={term === 'term1' ? 'T1' : 'T2'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {(data.coScholasticGrades ?? CO_SCHOLASTIC_GRADES).map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ))}
            </div>
          ))}
        </div>
      </Card>

      {/* Remarks & meta */}
      <Card className="border-white/10 bg-white/[0.02] p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Attendance, result &amp; remarks</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Term 1 attendance</Label>
            <Input
              value={meta.term1Attendance}
              placeholder="e.g. 95/100"
              onChange={(e) => setMeta((m) => ({ ...m, term1Attendance: e.target.value }))}
              disabled={locked}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Term 2 attendance</Label>
            <Input
              value={meta.term2Attendance}
              placeholder="e.g. 92/100"
              onChange={(e) => setMeta((m) => ({ ...m, term2Attendance: e.target.value }))}
              disabled={locked}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Result status</Label>
            <Select
              value={meta.resultStatus || '__none__'}
              onValueChange={(v) => setMeta((m) => ({ ...m, resultStatus: v === '__none__' ? '' : v }))}
              disabled={locked}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {(data.resultStatuses ?? RESULT_STATUSES).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Class teacher remarks</Label>
            <Textarea
              value={meta.remarks}
              rows={2}
              onChange={(e) => setMeta((m) => ({ ...m, remarks: e.target.value }))}
              disabled={locked}
            />
          </div>
        </div>
      </Card>
    </div>
  )
}

function TermGrid({
  title,
  fields,
  values,
  onChange,
  disabled,
}: {
  title: string
  fields: { key: string; label: string; max?: number }[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  disabled?: boolean
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</p>
      {fields.length === 0 ? (
        <p className="text-xs text-zinc-600">No components configured.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs">
                {f.label}
                {f.max ? <span className="ml-1 text-zinc-600">/{f.max}</span> : null}
              </Label>
              <Input
                type="number"
                value={values[f.key] ?? ''}
                min={0}
                max={f.max}
                onChange={(e) => onChange(f.key, e.target.value)}
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
