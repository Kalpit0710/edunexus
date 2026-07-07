'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/utils'
import {
  getReportSetup,
  getClassSubjectConfigs,
  saveSubjectConfig,
  getClassResultsOverview,
  getClassPublication,
  publishClassReport,
  unlockClassReport,
  type ReportSetup,
  type ClassMeta,
  type SubjectConfigRow,
  type ClassResultRow,
  type PublicationRow,
} from './actions'
import {
  STANDARD_TERM1_FIELDS,
  STANDARD_TERM2_FIELDS,
  type StandardMaxMarks,
  type LowerComponent,
} from '@/lib/report-card-utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
import {
  FileText,
  Pencil,
  Printer,
  Trophy,
  Lock,
  Unlock,
  Eye,
  Plus,
  Trash2,
  Save,
  Settings2,
} from 'lucide-react'

const STATUS_BADGE: Record<string, string> = {
  draft: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400',
  published: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  locked: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
}

export default function ReportCardsPage() {
  const { school } = useAuthStore()
  const schoolId = school?.id ?? ''

  const [setup, setSetup] = useState<ReportSetup | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [classId, setClassId] = useState('')
  const [sectionId, setSectionId] = useState('')

  const load = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getReportSetup(schoolId)
      setSetup(data)
      const firstClass = data.classes[0]
      if (firstClass) setClassId((prev) => prev || firstClass.id)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [schoolId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <InlineLoader label="Loading report cards…" className="mt-20" />
  if (error) return <DataLoadError message={error} onRetry={load} />
  if (!setup) return null

  const selectedClass = setup.classes.find((c) => c.id === classId) ?? null

  return (
    <div className="px-6 py-6 space-y-5 max-w-6xl">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-600/10 text-blue-400">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Report Cards</h1>
          <p className="text-sm text-zinc-500">
            CBSE term-based results — configure components, enter marks, publish.
          </p>
        </div>
      </header>

      {setup.classes.length === 0 ? (
        <Card className="border-white/10 bg-white/[0.02] p-10 text-center text-sm text-zinc-500">
          No classes found. Create classes and subjects first.
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Class</Label>
              <Select
                value={classId}
                onValueChange={(v) => {
                  setClassId(v)
                  setSectionId('')
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {setup.classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{' '}
                      {c.reportCardType === 'lower' ? '(lower)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedClass && selectedClass.sections.length > 0 && (
              <div className="space-y-1.5">
                <Label>Section</Label>
                <Select value={sectionId || '__all__'} onValueChange={(v) => setSectionId(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="All sections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All sections</SelectItem>
                    {selectedClass.sections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {selectedClass && (
            <Tabs defaultValue="students" className="w-full">
              <TabsList>
                <TabsTrigger value="students">
                  <Trophy className="mr-1.5 h-3.5 w-3.5" /> Students &amp; ranks
                </TabsTrigger>
                <TabsTrigger value="subjects">
                  <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Subject setup
                </TabsTrigger>
                <TabsTrigger value="publish">
                  <Lock className="mr-1.5 h-3.5 w-3.5" /> Publish
                </TabsTrigger>
              </TabsList>

              <TabsContent value="students" className="mt-4">
                <StudentsTab schoolId={schoolId} classId={classId} sectionId={sectionId} />
              </TabsContent>
              <TabsContent value="subjects" className="mt-4">
                <SubjectsTab schoolId={schoolId} classMeta={selectedClass} />
              </TabsContent>
              <TabsContent value="publish" className="mt-4">
                <PublishTab
                  schoolId={schoolId}
                  classMeta={selectedClass}
                  academicYearId={setup.academicYearId}
                />
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  )
}

// ─── Students & ranking ─────────────────────────────────────

function StudentsTab({
  schoolId,
  classId,
  sectionId,
}: {
  schoolId: string
  classId: string
  sectionId: string
}) {
  const [rows, setRows] = useState<ClassResultRow[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!schoolId || !classId) return
    setLoading(true)
    try {
      setRows(await getClassResultsOverview(schoolId, classId, sectionId || undefined))
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [schoolId, classId, sectionId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <InlineLoader label="Loading students…" className="mt-10" />
  if (rows.length === 0) {
    return (
      <Card className="border-white/10 bg-white/[0.02] p-10 text-center text-sm text-zinc-500">
        No active students in this class.
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="flex gap-2">
          <Link
            href={
              `/api/report-cards/class/${classId}/archive${sectionId ? `?section=${sectionId}` : ''}` as never
            }
            target="_blank"
          >
            <Button variant="outline" size="sm">
              <Printer className="mr-1.5 h-3.5 w-3.5" /> Download ZIP PDFs
            </Button>
          </Link>
          <Link
            href={
              `/report-card/class/${classId}/print${sectionId ? `?section=${sectionId}` : ''}` as never
            }
            target="_blank"
          >
            <Button variant="outline" size="sm">
              <Printer className="mr-1.5 h-3.5 w-3.5" /> Print all report cards
            </Button>
          </Link>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-white/[0.03] text-left text-xs font-medium text-zinc-400">
              <th className="px-3 py-2.5">Rank</th>
              <th className="px-3 py-2.5">Roll</th>
              <th className="px-3 py-2.5">Student</th>
              <th className="px-3 py-2.5 text-right">Total</th>
              <th className="px-3 py-2.5 text-right">%</th>
              <th className="px-3 py-2.5">Grade</th>
              <th className="px-3 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.studentId} className="border-t border-white/[0.06] hover:bg-white/[0.02]">
                <td className="px-3 py-2.5 font-semibold text-zinc-300">#{r.rank}</td>
                <td className="px-3 py-2.5 text-zinc-400">{r.rollNumber ?? '—'}</td>
                <td className="px-3 py-2.5">
                  <p className="font-medium text-white">{r.fullName}</p>
                  <p className="text-xs text-zinc-500">{r.admissionNumber}</p>
                </td>
                <td className="px-3 py-2.5 text-right text-zinc-300">
                  {r.totalObtained} / {r.totalMax}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-white">{r.percentage}%</td>
                <td className="px-3 py-2.5">
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-zinc-300">
                    {r.grade ?? '—'}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <Link href={`/school-admin/report-cards/${r.studentId}/marks` as never}>
                      <Button variant="outline" size="sm">
                        <Pencil className="mr-1 h-3.5 w-3.5" /> Marks
                      </Button>
                    </Link>
                    <Link href={`/report-card/${r.studentId}/print` as never} target="_blank">
                      <Button variant="ghost" size="sm">
                        <Printer className="mr-1 h-3.5 w-3.5" /> Print
                      </Button>
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Subject setup ──────────────────────────────────────────

function SubjectsTab({ schoolId, classMeta }: { schoolId: string; classMeta: ClassMeta }) {
  const [configs, setConfigs] = useState<SubjectConfigRow[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!schoolId || !classMeta.id) return
    setLoading(true)
    try {
      setConfigs(await getClassSubjectConfigs(schoolId, classMeta.id))
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [schoolId, classMeta.id])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <InlineLoader label="Loading subjects…" className="mt-10" />
  if (configs.length === 0) {
    return (
      <Card className="border-white/10 bg-white/[0.02] p-10 text-center text-sm text-zinc-500">
        No subjects for this class. Add subjects under Settings → Academic first.
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        {classMeta.reportCardType === 'lower'
          ? 'Lower class: define custom assessment components (e.g. Oral, Written) and their max marks per subject.'
          : 'Standard class: set the max marks for each CBSE component per term.'}
      </p>
      {configs.map((cfg) => (
        <SubjectConfigCard
          key={cfg.subjectId}
          schoolId={schoolId}
          classId={classMeta.id}
          reportCardType={classMeta.reportCardType}
          config={cfg}
        />
      ))}
    </div>
  )
}

function SubjectConfigCard({
  schoolId,
  classId,
  reportCardType,
  config,
}: {
  schoolId: string
  classId: string
  reportCardType: 'standard' | 'lower'
  config: SubjectConfigRow
}) {
  const [maxMarks, setMaxMarks] = useState<StandardMaxMarks>(config.maxMarks)
  const [components, setComponents] = useState<LowerComponent[]>(config.components)
  const [saving, setSaving] = useState(false)
  const canConfigure = usePermissions().can('exams.configure')

  function setStd(term: 'term1' | 'term2', key: string, value: string) {
    setMaxMarks((prev) => ({
      ...prev,
      [term]: { ...prev[term], [key]: Number(value) || 0 },
    }))
  }

  async function save() {
    setSaving(true)
    try {
      await saveSubjectConfig(schoolId, classId, config.subjectId, maxMarks, components)
      toast.success('Subject setup saved')
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-white/10 bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold text-white">
          {config.subjectName}
          {config.subjectCode && <span className="ml-2 text-xs text-zinc-500">{config.subjectCode}</span>}
        </p>
        <Button size="sm" loading={saving} loadingText="Saving…" onClick={save} disabled={!canConfigure}>
          <Save className="mr-1 h-3.5 w-3.5" /> Save
        </Button>
      </div>

      {reportCardType === 'lower' ? (
        <div className="space-y-2">
          {components.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={c.name}
                placeholder="Component name"
                onChange={(e) =>
                  setComponents((prev) =>
                    prev.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)),
                  )
                }
                className="flex-1"
              />
              <Input
                type="number"
                value={c.maxMarks}
                placeholder="Max"
                onChange={(e) =>
                  setComponents((prev) =>
                    prev.map((x, idx) => (idx === i ? { ...x, maxMarks: Number(e.target.value) || 0 } : x)),
                  )
                }
                className="w-24"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setComponents((prev) => prev.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setComponents((prev) => [...prev, { name: '', maxMarks: 0 }])}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add component
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Term 1</p>
            <div className="grid grid-cols-2 gap-2">
              {STANDARD_TERM1_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs">{f.label}</Label>
                  <Input
                    type="number"
                    value={(maxMarks.term1 as unknown as Record<string, number>)[f.key] ?? 0}
                    onChange={(e) => setStd('term1', f.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Term 2</p>
            <div className="grid grid-cols-2 gap-2">
              {STANDARD_TERM2_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs">{f.label}</Label>
                  <Input
                    type="number"
                    value={(maxMarks.term2 as unknown as Record<string, number>)[f.key] ?? 0}
                    onChange={(e) => setStd('term2', f.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── Publish ────────────────────────────────────────────────

function PublishTab({
  schoolId,
  classMeta,
  academicYearId,
}: {
  schoolId: string
  classMeta: ClassMeta
  academicYearId: string | null
}) {
  const [publication, setPublication] = useState<PublicationRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [resultVisible, setResultVisible] = useState(true)
  const canPublish = usePermissions().can('exams.publish')

  const load = useCallback(async () => {
    if (!schoolId || !classMeta.id) return
    setLoading(true)
    try {
      const pub = await getClassPublication(schoolId, classMeta.id)
      setPublication(pub)
      if (pub) setResultVisible(pub.resultVisible)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [schoolId, classMeta.id])

  useEffect(() => {
    load()
  }, [load])

  async function publish(lock: boolean) {
    setBusy(true)
    try {
      await publishClassReport(classMeta.id, academicYearId, resultVisible, lock)
      toast.success(lock ? 'Reports published & locked' : 'Reports published')
      await load()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function unlock() {
    setBusy(true)
    try {
      await unlockClassReport(classMeta.id, academicYearId)
      toast.success('Reports unlocked — hidden from parents')
      await load()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <InlineLoader label="Loading status…" className="mt-10" />

  const status = publication?.status ?? 'draft'

  return (
    <Card className="max-w-xl space-y-5 border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{classMeta.name} — publication</p>
          <p className="text-xs text-zinc-500">
            Publishing makes report cards visible to parents (when fees are clear).
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${STATUS_BADGE[status]}`}>
          {status}
        </span>
      </div>

      <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
        <span className="flex items-center gap-2 text-sm text-zinc-300">
          <Eye className="h-4 w-4 text-zinc-500" /> Visible to parents
        </span>
        <Switch checked={resultVisible} onCheckedChange={setResultVisible} />
      </label>

      {status === 'locked' ? (
        <Button variant="outline" loading={busy} loadingText="Working…" onClick={unlock} disabled={!canPublish}>
          <Unlock className="mr-1.5 h-4 w-4" /> Unlock (hide &amp; allow edits)
        </Button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" loading={busy} loadingText="Working…" onClick={() => publish(false)} disabled={!canPublish}>
            <Eye className="mr-1.5 h-4 w-4" /> Publish (keep editable)
          </Button>
          <Button loading={busy} loadingText="Working…" onClick={() => publish(true)} disabled={!canPublish}>
            <Lock className="mr-1.5 h-4 w-4" /> Publish &amp; lock
          </Button>
        </div>
      )}
    </Card>
  )
}
