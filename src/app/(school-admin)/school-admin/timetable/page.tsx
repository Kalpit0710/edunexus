'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { getErrorMessage } from '@/lib/utils'
import {
  getTimetableSetup,
  getSectionGrid,
  getAllConflicts,
  getTeacherGrid,
  getSlotOccupancy,
  createPeriod,
  updatePeriod,
  deletePeriod,
  upsertEntry,
  setWorkingDays,
  copyDay,
  clearDay,
  duplicateSectionTimetable,
  type TimetableSetup,
  type TeacherAssignment,
  type PeriodRow,
  type SectionGrid,
  type EntryCell,
  type TeacherViewEntry,
} from './actions'
import type { TeacherConflict } from '@/lib/timetable-utils'
import {
  WEEKDAYS,
  formatPeriodRange,
  weekdayLabel,
} from '@/lib/timetable-utils'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { InlineLoader } from '@/components/loaders/page-loaders'
import { DataLoadError } from '@/components/shared/DataLoadError'
import { CalendarRange, Plus, Pencil, Trash2, AlertTriangle, Coffee, Copy, Eraser, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'

const NONE = '__none__'

/** Build the ordered weekday columns from a school's working-days set. */
function workingColumns(workingDays: number[]) {
  return WEEKDAYS.filter((w) => workingDays.includes(w.value))
}

export default function AdminTimetablePage() {
  const { school } = useAuthStore()
  const schoolId = school?.id ?? ''

  const [setup, setSetup] = useState<TimetableSetup | null>(null)
  const [conflicts, setConflicts] = useState<TeacherConflict[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSetup = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    setError(null)
    try {
      const [s, c] = await Promise.all([getTimetableSetup(schoolId), getAllConflicts(schoolId)])
      setSetup(s)
      setConflicts(c)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [schoolId])

  useEffect(() => {
    loadSetup()
  }, [loadSetup])

  const refreshConflicts = useCallback(async () => {
    if (!schoolId) return
    setConflicts(await getAllConflicts(schoolId))
  }, [schoolId])

  if (loading) return <InlineLoader label="Loading timetable…" className="mt-20" />
  if (error) return <DataLoadError message={error} onRetry={loadSetup} />
  if (!setup) return null

  return (
    <div className="px-6 py-6 space-y-5 max-w-6xl">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-600/10 text-blue-400">
          <CalendarRange className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Timetable</h1>
          <p className="text-sm text-zinc-500">Manage class schedules, periods and teacher allocation.</p>
        </div>
      </header>

      {conflicts.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/[0.06] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-amber-300">
                {conflicts.length} teacher scheduling conflict{conflicts.length > 1 ? 's' : ''}
              </p>
              <ul className="space-y-0.5 text-amber-200/80">
                {conflicts.map((c, i) => (
                  <li key={i}>
                    <span className="font-medium">{c.teacherName}</span> — {weekdayLabel(c.dayOfWeek, true)},{' '}
                    {c.periodName}: {c.sections.join(' & ')}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <Tabs defaultValue="class">
        <TabsList>
          <TabsTrigger value="class">Class timetable</TabsTrigger>
          <TabsTrigger value="periods">Periods</TabsTrigger>
          <TabsTrigger value="teacher">Teacher view</TabsTrigger>
        </TabsList>

        <TabsContent value="class" className="mt-4">
          <ClassTimetableTab
            schoolId={schoolId}
            setup={setup}
            conflicts={conflicts}
            onChanged={refreshConflicts}
          />
        </TabsContent>
        <TabsContent value="periods" className="mt-4">
          <PeriodsTab
            schoolId={schoolId}
            periods={setup.periods}
            workingDays={setup.workingDays}
            onChanged={loadSetup}
          />
        </TabsContent>
        <TabsContent value="teacher" className="mt-4">
          <TeacherViewTab schoolId={schoolId} setup={setup} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Periods tab ─────────────────────────────────────────────

function WorkingDaysCard({
  schoolId,
  workingDays,
  onSaved,
}: {
  schoolId: string
  workingDays: number[]
  onSaved: () => void
}) {
  const [selected, setSelected] = useState<number[]>(workingDays)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSelected(workingDays)
  }, [workingDays])

  const dirty =
    selected.length !== workingDays.length ||
    selected.some((d) => !workingDays.includes(d))

  function toggle(day: number) {
    setSelected((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    )
  }

  async function handleSave() {
    if (selected.length === 0) {
      toast.error('Select at least one working day.')
      return
    }
    setSaving(true)
    try {
      await setWorkingDays(schoolId, selected)
      toast.success('Working days updated')
      onSaved()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-600/10 text-blue-400">
          <CalendarDays className="h-4 w-4" />
        </div>
        <div className="flex-1 space-y-2">
          <div>
            <p className="text-sm font-medium text-white">Working days</p>
            <p className="text-xs text-zinc-500">
              The days shown as columns in every timetable (admin, teacher and parent).
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d) => {
              const on = selected.includes(d.value)
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggle(d.value)}
                  className={
                    'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ' +
                    (on
                      ? 'border-blue-500/50 bg-blue-500/15 text-blue-300'
                      : 'border-white/10 bg-white/[0.02] text-zinc-500 hover:text-zinc-300')
                  }
                >
                  {d.short}
                </button>
              )
            })}
          </div>
        </div>
        <Button size="sm" onClick={handleSave} loading={saving} loadingText="Saving…" disabled={!dirty}>
          Save
        </Button>
      </div>
    </Card>
  )
}

function PeriodsTab({
  schoolId,
  periods,
  workingDays,
  onChanged,
}: {
  schoolId: string
  periods: PeriodRow[]
  workingDays: number[]
  onChanged: () => void
}) {
  const [editing, setEditing] = useState<PeriodRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PeriodRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deletePeriod(schoolId, deleteTarget.id)
      toast.success('Period deleted')
      setDeleteTarget(null)
      onChanged()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-3">
      <WorkingDaysCard schoolId={schoolId} workingDays={workingDays} onSaved={onChanged} />

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-300">Periods (time slots)</p>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Add period
        </Button>
      </div>

      {periods.length === 0 ? (
        <Card className="py-12 text-center text-sm text-zinc-500">
          No periods yet. Add your first time slot to start building timetables.
        </Card>
      ) : (
        <div className="space-y-2">
          {periods.map((p) => (
            <Card key={p.id} className="flex items-center gap-3 p-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-xs text-zinc-400">
                {p.displayOrder}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium text-white">
                  {p.name}
                  {p.isBreak && (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-400">
                      <Coffee className="h-3 w-3" /> Break
                    </span>
                  )}
                </p>
                <p className="text-xs text-zinc-500">{formatPeriodRange(p.startTime, p.endTime) || 'No time set'}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditing(p)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(p)}>
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <PeriodDialog
          schoolId={schoolId}
          period={editing}
          nextOrder={periods.length + 1}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            onChanged()
          }}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete period?"
        description={`"${deleteTarget?.name}" will be removed from every class timetable. This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function PeriodDialog({
  schoolId,
  period,
  nextOrder,
  onClose,
  onSaved,
}: {
  schoolId: string
  period: PeriodRow | null
  nextOrder: number
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(period?.name ?? '')
  const [startTime, setStartTime] = useState(period?.startTime ?? '')
  const [endTime, setEndTime] = useState(period?.endTime ?? '')
  const [order, setOrder] = useState(period?.displayOrder ?? nextOrder)
  const [isBreak, setIsBreak] = useState(period?.isBreak ?? false)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const input = {
        schoolId,
        name,
        startTime: startTime || null,
        endTime: endTime || null,
        displayOrder: Number(order) || 0,
        isBreak,
      }
      if (period) await updatePeriod(period.id, input)
      else await createPeriod(input)
      toast.success(period ? 'Period updated' : 'Period added')
      onSaved()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{period ? 'Edit period' : 'Add period'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Period 1 / Lunch / Assembly" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start time</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End time</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Order</Label>
            <Input
              type="number"
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
              min={0}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2">
            <div>
              <p className="text-sm text-white">Break / non-teaching</p>
              <p className="text-xs text-zinc-500">Lunch, recess or assembly — no subject or teacher.</p>
            </div>
            <Switch checked={isBreak} onCheckedChange={setIsBreak} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Class timetable tab ─────────────────────────────────────

function ClassTimetableTab({
  schoolId,
  setup,
  conflicts,
  onChanged,
}: {
  schoolId: string
  setup: TimetableSetup
  conflicts: TeacherConflict[]
  onChanged: () => void
}) {
  const firstClass = setup.classes[0]
  const [classId, setClassId] = useState(firstClass?.id ?? '')
  const selectedClass = setup.classes.find((c) => c.id === classId) ?? firstClass
  const [sectionId, setSectionId] = useState(firstClass?.sections[0]?.id ?? '')
  const [grid, setGrid] = useState<SectionGrid | null>(null)
  const [loading, setLoading] = useState(false)
  const [editCell, setEditCell] = useState<{ dayOfWeek: number; period: PeriodRow } | null>(null)

  const WORKING = workingColumns(setup.workingDays)
  const teachingPeriods = setup.periods

  // (day|period|teacher) keys that are part of a school-wide double-booking, so
  // the matching cells in this section can be highlighted.
  const conflictKeys = new Set(
    conflicts.map((c) => `${c.dayOfWeek}|${c.periodId}|${c.teacherId}`),
  )

  const sectionLabel = `${selectedClass?.name ?? ''} ${
    selectedClass?.sections.find((s) => s.id === sectionId)?.name ?? ''
  }`.trim()

  const loadGrid = useCallback(async () => {
    if (!sectionId) {
      setGrid(null)
      return
    }
    setLoading(true)
    try {
      setGrid(await getSectionGrid(schoolId, sectionId))
    } finally {
      setLoading(false)
    }
  }, [schoolId, sectionId])

  useEffect(() => {
    loadGrid()
  }, [loadGrid])

  function cellAt(dayOfWeek: number, periodId: string): EntryCell | undefined {
    return grid?.entries.find((e) => e.dayOfWeek === dayOfWeek && e.periodId === periodId)
  }

  if (setup.classes.length === 0) {
    return (
      <Card className="py-12 text-center text-sm text-zinc-500">
        Add classes and sections in Settings before building a timetable.
      </Card>
    )
  }

  if (setup.periods.length === 0) {
    return (
      <Card className="py-12 text-center text-sm text-zinc-500">
        Define your periods first (the “Periods” tab) — they become the rows of every timetable.
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="space-y-1.5">
          <Label>Class</Label>
          <Select
            value={classId}
            onValueChange={(v) => {
              setClassId(v)
              const c = setup.classes.find((x) => x.id === v)
              setSectionId(c?.sections[0]?.id ?? '')
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              {setup.classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Section</Label>
          <Select value={sectionId} onValueChange={setSectionId}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Select section" />
            </SelectTrigger>
            <SelectContent>
              {(selectedClass?.sections ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {sectionId && setup.periods.length > 0 && (
        <DayActions
          schoolId={schoolId}
          sectionId={sectionId}
          sectionLabel={sectionLabel}
          workingDays={setup.workingDays}
          siblingSections={(selectedClass?.sections ?? []).filter((s) => s.id !== sectionId)}
          onDone={() => {
            loadGrid()
            onChanged()
          }}
        />
      )}

      {!sectionId ? (
        <Card className="py-10 text-center text-sm text-zinc-500">
          This class has no sections yet. Add one in Settings.
        </Card>
      ) : loading ? (
        <InlineLoader label="Loading grid…" className="mt-8" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-white/[0.03]">
                <th className="sticky left-0 z-10 bg-[#0a0a0a] px-3 py-2 text-left text-xs font-medium text-zinc-400">
                  Period
                </th>
                {WORKING.map((d) => (
                  <th key={d.value} className="px-3 py-2 text-left text-xs font-medium text-zinc-400">
                    {d.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teachingPeriods.map((p) => (
                <tr key={p.id} className="border-t border-white/[0.06]">
                  <td className="sticky left-0 z-10 bg-[#0a0a0a] px-3 py-2 align-top">
                    <p className="font-medium text-white">{p.name}</p>
                    <p className="text-xs text-zinc-500">{formatPeriodRange(p.startTime, p.endTime)}</p>
                  </td>
                  {WORKING.map((d) => {
                    if (p.isBreak) {
                      return (
                        <td key={d.value} className="px-2 py-1.5">
                          <div className="rounded-md bg-amber-500/[0.06] px-2 py-2 text-center text-xs text-amber-400/70">
                            Break
                          </div>
                        </td>
                      )
                    }
                    const cell = cellAt(d.value, p.id)
                    const isConflict =
                      !!cell?.teacherId && conflictKeys.has(`${d.value}|${p.id}|${cell.teacherId}`)
                    return (
                      <td key={d.value} className="px-2 py-1.5">
                        <button
                          onClick={() => setEditCell({ dayOfWeek: d.value, period: p })}
                          className={
                            'w-full rounded-md border px-2 py-2 text-left transition-colors ' +
                            (isConflict
                              ? 'border-amber-500/50 bg-amber-500/[0.08] hover:bg-amber-500/[0.12]'
                              : 'border-white/5 bg-white/[0.02] hover:border-blue-500/40 hover:bg-blue-500/[0.06]')
                          }
                        >
                          {cell?.subjectName || cell?.teacherName ? (
                            <>
                              <p className="truncate text-xs font-medium text-white">
                                {cell?.subjectName ?? '—'}
                              </p>
                              <p className="truncate text-[11px] text-zinc-500">
                                {cell?.teacherName ?? 'No teacher'}
                                {cell?.room ? ` · ${cell.room}` : ''}
                              </p>
                              {isConflict && (
                                <p className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-amber-400">
                                  <AlertTriangle className="h-2.5 w-2.5" /> Teacher clash
                                </p>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-zinc-600">+ Add</span>
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editCell && grid && (
        <CellDialog
          schoolId={schoolId}
          sectionId={sectionId}
          dayOfWeek={editCell.dayOfWeek}
          period={editCell.period}
          current={cellAt(editCell.dayOfWeek, editCell.period.id)}
          subjects={grid.subjects}
          teachers={setup.teachers}
          assignments={setup.assignments}
          onClose={() => setEditCell(null)}
          onSaved={() => {
            setEditCell(null)
            loadGrid()
            onChanged()
          }}
        />
      )}
    </div>
  )
}

// ─── Bulk day / section helpers ──────────────────────────────

function DayActions({
  schoolId,
  sectionId,
  sectionLabel,
  workingDays,
  siblingSections,
  onDone,
}: {
  schoolId: string
  sectionId: string
  sectionLabel: string
  workingDays: number[]
  siblingSections: { id: string; name: string }[]
  onDone: () => void
}) {
  const days = workingColumns(workingDays)
  const [copyOpen, setCopyOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [dupOpen, setDupOpen] = useState(false)
  const [fromDay, setFromDay] = useState(days[0]?.value ?? 1)
  const [toDay, setToDay] = useState(days[1]?.value ?? days[0]?.value ?? 1)
  const [clearDayValue, setClearDayValue] = useState(days[0]?.value ?? 1)
  const [targetSection, setTargetSection] = useState(siblingSections[0]?.id ?? '')
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<void>, ok: string, done: () => void) {
    setBusy(true)
    try {
      await fn()
      toast.success(ok)
      done()
      onDone()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-zinc-500">Bulk:</span>
      <Button variant="outline" size="sm" onClick={() => setCopyOpen(true)}>
        <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy day
      </Button>
      <Button variant="outline" size="sm" onClick={() => setClearOpen(true)}>
        <Eraser className="mr-1.5 h-3.5 w-3.5" /> Clear day
      </Button>
      {siblingSections.length > 0 && (
        <Button variant="outline" size="sm" onClick={() => setDupOpen(true)}>
          <CalendarDays className="mr-1.5 h-3.5 w-3.5" /> Duplicate to…
        </Button>
      )}

      {/* Copy a day */}
      <Dialog open={copyOpen} onOpenChange={(o) => !o && setCopyOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy a day</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            Overwrites the target day in <span className="text-zinc-200">{sectionLabel}</span> with a copy of
            the source day.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Select value={String(fromDay)} onValueChange={(v) => setFromDay(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {days.map((d) => (
                    <SelectItem key={d.value} value={String(d.value)}>
                      {d.full}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Select value={String(toDay)} onValueChange={(v) => setToDay(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {days.map((d) => (
                    <SelectItem key={d.value} value={String(d.value)}>
                      {d.full}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCopyOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              loading={busy}
              loadingText="Copying…"
              disabled={fromDay === toDay}
              onClick={() =>
                run(() => copyDay(schoolId, sectionId, fromDay, toDay), 'Day copied', () =>
                  setCopyOpen(false),
                )
              }
            >
              Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear a day */}
      <Dialog open={clearOpen} onOpenChange={(o) => !o && setClearOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear a day</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            Removes every slot on the chosen day for <span className="text-zinc-200">{sectionLabel}</span>.
          </p>
          <div className="space-y-1.5">
            <Label>Day</Label>
            <Select value={String(clearDayValue)} onValueChange={(v) => setClearDayValue(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {days.map((d) => (
                  <SelectItem key={d.value} value={String(d.value)}>
                    {d.full}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClearOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={busy}
              loadingText="Clearing…"
              onClick={() =>
                run(() => clearDay(schoolId, sectionId, clearDayValue), 'Day cleared', () =>
                  setClearOpen(false),
                )
              }
            >
              Clear day
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate whole timetable to another section */}
      <Dialog open={dupOpen} onOpenChange={(o) => !o && setDupOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate timetable</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            Copies the whole weekly grid from <span className="text-zinc-200">{sectionLabel}</span> onto another
            section of the same class (overwriting it).
          </p>
          <div className="space-y-1.5">
            <Label>Target section</Label>
            <Select value={targetSection} onValueChange={setTargetSection}>
              <SelectTrigger>
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                {siblingSections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDupOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              loading={busy}
              loadingText="Duplicating…"
              disabled={!targetSection}
              onClick={() =>
                run(
                  () => duplicateSectionTimetable(schoolId, sectionId, targetSection),
                  'Timetable duplicated',
                  () => setDupOpen(false),
                )
              }
            >
              Duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CellDialog({
  schoolId,
  sectionId,
  dayOfWeek,
  period,
  current,
  subjects,
  teachers,
  assignments,
  onClose,
  onSaved,
}: {
  schoolId: string
  sectionId: string
  dayOfWeek: number
  period: PeriodRow
  current: EntryCell | undefined
  subjects: { id: string; name: string }[]
  teachers: { id: string; name: string }[]
  assignments: TeacherAssignment[]
  onClose: () => void
  onSaved: () => void
}) {
  const [subjectId, setSubjectId] = useState(current?.subjectId ?? NONE)
  const [teacherId, setTeacherId] = useState(current?.teacherId ?? NONE)
  const [room, setRoom] = useState(current?.room ?? '')
  const [saving, setSaving] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [occupancy, setOccupancy] = useState<{
    teacherIds: string[]
    rooms: string[]
    labelByTeacher: Record<string, string>
  } | null>(null)

  // Who/what is already booked in this exact day+period (live availability).
  useEffect(() => {
    let alive = true
    getSlotOccupancy(schoolId, dayOfWeek, period.id, sectionId)
      .then((o) => {
        if (alive) setOccupancy(o)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [schoolId, dayOfWeek, period.id, sectionId])

  // Teachers assigned to this section (optionally matching the chosen subject).
  const forSection = assignments.filter((a) => a.sectionId === sectionId)
  const subj = subjectId === NONE ? null : subjectId
  const matched = subj
    ? forSection.filter((a) => a.subjectId === subj || a.subjectId === null)
    : forSection
  const assignedIds = new Set((matched.length ? matched : forSection).map((a) => a.teacherId))
  const hasAssigned = assignedIds.size > 0

  let teacherList = showAll || !hasAssigned ? teachers : teachers.filter((t) => assignedIds.has(t.id))
  // Never hide the currently-selected teacher.
  if (teacherId !== NONE && !teacherList.some((t) => t.id === teacherId)) {
    const sel = teachers.find((t) => t.id === teacherId)
    if (sel) teacherList = [sel, ...teacherList]
  }

  const roomTrim = room.trim().toLowerCase()
  const roomBusy = !!roomTrim && (occupancy?.rooms.includes(roomTrim) ?? false)

  async function handleSave() {
    setSaving(true)
    try {
      const { conflictSections, roomConflictSections } = await upsertEntry({
        schoolId,
        sectionId,
        dayOfWeek,
        periodId: period.id,
        subjectId: subjectId === NONE ? null : subjectId,
        teacherId: teacherId === NONE ? null : teacherId,
        room: room.trim() || null,
      })
      const warnings: string[] = []
      if (conflictSections.length > 0) {
        warnings.push(`teacher also teaches ${conflictSections.join(', ')}`)
      }
      if (roomConflictSections.length > 0) {
        warnings.push(`room is also used by ${roomConflictSections.join(', ')}`)
      }
      if (warnings.length > 0) {
        toast.warning(`Saved — but this ${warnings.join(' and this ')} at this time.`)
      } else {
        toast.success('Slot updated')
      }
      onSaved()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {weekdayLabel(dayOfWeek, true)} · {period.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger>
                <SelectValue placeholder="No subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— None —</SelectItem>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {subjects.length === 0 && (
              <p className="text-xs text-amber-400/80">This class has no subjects — add them in Settings.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Teacher</Label>
              {hasAssigned && (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="text-[11px] text-blue-400 hover:underline"
                >
                  {showAll ? 'Show assigned only' : 'Show all teachers'}
                </button>
              )}
            </div>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger>
                <SelectValue placeholder="No teacher" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— None —</SelectItem>
                {teacherList.map((t) => {
                  const busy = occupancy?.teacherIds.includes(t.id)
                  const where = occupancy?.labelByTeacher[t.id]
                  return (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {busy ? ` · busy${where ? ` (${where})` : ''}` : ''}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {!hasAssigned && (
              <p className="text-[11px] text-zinc-500">
                No teachers are assigned to this section yet — showing everyone. Assign teachers on the
                teacher’s profile to narrow this list.
              </p>
            )}
            {teacherId !== NONE && occupancy?.teacherIds.includes(teacherId) && (
              <p className="flex items-center gap-1 text-[11px] font-medium text-amber-400">
                <AlertTriangle className="h-3 w-3" /> Already teaching
                {occupancy.labelByTeacher[teacherId] ? ` ${occupancy.labelByTeacher[teacherId]}` : ''} at this
                time.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Room (optional)</Label>
            <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Room 5 / Lab" />
            {roomBusy && (
              <p className="flex items-center gap-1 text-[11px] font-medium text-amber-400">
                <AlertTriangle className="h-3 w-3" /> This room is already booked at this time.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save slot'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Teacher view tab ────────────────────────────────────────

function TeacherViewTab({ schoolId, setup }: { schoolId: string; setup: TimetableSetup }) {
  const [teacherId, setTeacherId] = useState(setup.teachers[0]?.id ?? '')
  const [entries, setEntries] = useState<TeacherViewEntry[]>([])
  const [loading, setLoading] = useState(false)

  const WORKING = workingColumns(setup.workingDays)

  const load = useCallback(async () => {
    if (!teacherId) {
      setEntries([])
      return
    }
    setLoading(true)
    try {
      setEntries(await getTeacherGrid(schoolId, teacherId))
    } finally {
      setLoading(false)
    }
  }, [schoolId, teacherId])

  useEffect(() => {
    load()
  }, [load])

  function cellAt(dayOfWeek: number, periodId: string) {
    return entries.find((e) => e.dayOfWeek === dayOfWeek && e.periodId === periodId)
  }

  if (setup.teachers.length === 0) {
    return <Card className="py-12 text-center text-sm text-zinc-500">No active teachers yet.</Card>
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Teacher</Label>
        <Select value={teacherId} onValueChange={setTeacherId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Select teacher" />
          </SelectTrigger>
          <SelectContent>
            {setup.teachers.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {setup.periods.length === 0 ? (
        <Card className="py-10 text-center text-sm text-zinc-500">Define periods first.</Card>
      ) : loading ? (
        <InlineLoader label="Loading…" className="mt-8" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-white/[0.03]">
                <th className="sticky left-0 z-10 bg-[#0a0a0a] px-3 py-2 text-left text-xs font-medium text-zinc-400">
                  Period
                </th>
                {WORKING.map((d) => (
                  <th key={d.value} className="px-3 py-2 text-left text-xs font-medium text-zinc-400">
                    {d.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {setup.periods.map((p) => (
                <tr key={p.id} className="border-t border-white/[0.06]">
                  <td className="sticky left-0 z-10 bg-[#0a0a0a] px-3 py-2 align-top">
                    <p className="font-medium text-white">{p.name}</p>
                    <p className="text-xs text-zinc-500">{formatPeriodRange(p.startTime, p.endTime)}</p>
                  </td>
                  {WORKING.map((d) => {
                    if (p.isBreak) {
                      return (
                        <td key={d.value} className="px-2 py-1.5">
                          <div className="rounded-md bg-amber-500/[0.06] px-2 py-2 text-center text-xs text-amber-400/70">
                            Break
                          </div>
                        </td>
                      )
                    }
                    const cell = cellAt(d.value, p.id)
                    return (
                      <td key={d.value} className="px-2 py-1.5">
                        {cell ? (
                          <div className="rounded-md border border-white/5 bg-white/[0.02] px-2 py-2">
                            <p className="truncate text-xs font-medium text-white">{cell.sectionLabel}</p>
                            <p className="truncate text-[11px] text-zinc-500">
                              {cell.subjectName ?? '—'}
                              {cell.room ? ` · ${cell.room}` : ''}
                            </p>
                          </div>
                        ) : (
                          <div className="px-2 py-2 text-center text-xs text-zinc-700">Free</div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
