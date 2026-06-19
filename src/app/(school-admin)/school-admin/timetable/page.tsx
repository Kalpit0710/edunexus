'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import {
  getTimetableSetup,
  getSectionGrid,
  getAllConflicts,
  getTeacherGrid,
  createPeriod,
  updatePeriod,
  deletePeriod,
  upsertEntry,
  type TimetableSetup,
  type PeriodRow,
  type SectionGrid,
  type EntryCell,
  type TeacherViewEntry,
} from './actions'
import type { TeacherConflict } from '@/lib/timetable-utils'
import {
  WEEKDAYS,
  DEFAULT_WORKING_DAYS,
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
import { CalendarRange, Plus, Pencil, Trash2, AlertTriangle, Coffee } from 'lucide-react'
import { toast } from 'sonner'

const NONE = '__none__'
const WORKING = WEEKDAYS.filter((w) => DEFAULT_WORKING_DAYS.includes(w.value))

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
      setError(e instanceof Error ? e.message : 'Could not load the timetable.')
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
          <ClassTimetableTab schoolId={schoolId} setup={setup} onChanged={refreshConflicts} />
        </TabsContent>
        <TabsContent value="periods" className="mt-4">
          <PeriodsTab schoolId={schoolId} periods={setup.periods} onChanged={loadSetup} />
        </TabsContent>
        <TabsContent value="teacher" className="mt-4">
          <TeacherViewTab schoolId={schoolId} setup={setup} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Periods tab ─────────────────────────────────────────────

function PeriodsTab({
  schoolId,
  periods,
  onChanged,
}: {
  schoolId: string
  periods: PeriodRow[]
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
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
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
      toast.error(e instanceof Error ? e.message : 'Save failed')
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
  onChanged,
}: {
  schoolId: string
  setup: TimetableSetup
  onChanged: () => void
}) {
  const firstClass = setup.classes[0]
  const [classId, setClassId] = useState(firstClass?.id ?? '')
  const selectedClass = setup.classes.find((c) => c.id === classId) ?? firstClass
  const [sectionId, setSectionId] = useState(firstClass?.sections[0]?.id ?? '')
  const [grid, setGrid] = useState<SectionGrid | null>(null)
  const [loading, setLoading] = useState(false)
  const [editCell, setEditCell] = useState<{ dayOfWeek: number; period: PeriodRow } | null>(null)

  const teachingPeriods = setup.periods
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
                    return (
                      <td key={d.value} className="px-2 py-1.5">
                        <button
                          onClick={() => setEditCell({ dayOfWeek: d.value, period: p })}
                          className="w-full rounded-md border border-white/5 bg-white/[0.02] px-2 py-2 text-left transition-colors hover:border-blue-500/40 hover:bg-blue-500/[0.06]"
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

function CellDialog({
  schoolId,
  sectionId,
  dayOfWeek,
  period,
  current,
  subjects,
  teachers,
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
  onClose: () => void
  onSaved: () => void
}) {
  const [subjectId, setSubjectId] = useState(current?.subjectId ?? NONE)
  const [teacherId, setTeacherId] = useState(current?.teacherId ?? NONE)
  const [room, setRoom] = useState(current?.room ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const { conflictSections } = await upsertEntry({
        schoolId,
        sectionId,
        dayOfWeek,
        periodId: period.id,
        subjectId: subjectId === NONE ? null : subjectId,
        teacherId: teacherId === NONE ? null : teacherId,
        room: room.trim() || null,
      })
      if (conflictSections.length > 0) {
        toast.warning(`Saved — but this teacher also teaches ${conflictSections.join(', ')} at this time.`)
      } else {
        toast.success('Slot updated')
      }
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
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
            <Label>Teacher</Label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger>
                <SelectValue placeholder="No teacher" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— None —</SelectItem>
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Room (optional)</Label>
            <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Room 5 / Lab" />
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
