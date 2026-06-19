'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import {
  getTransportData,
  createBus,
  updateBus,
  deleteBus,
  addStop,
  deleteStop,
  assignStudent,
  unassignStudent,
  type TransportData,
  type BusRow,
  type StopRow,
  type AssignmentRow,
} from './actions'
import { formatTime } from '@/lib/timetable-utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Bus, Plus, Pencil, Trash2, MapPin, User, Phone, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

const NONE = '__none__'

export default function TransportPage() {
  const { school } = useAuthStore()
  const schoolId = school?.id ?? ''
  const [data, setData] = useState<TransportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    setError(null)
    try {
      setData(await getTransportData(schoolId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load transport.')
    } finally {
      setLoading(false)
    }
  }, [schoolId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <InlineLoader label="Loading transport…" className="mt-20" />
  if (error) return <DataLoadError message={error} onRetry={load} />
  if (!data) return null

  return (
    <div className="px-6 py-6 space-y-5 max-w-5xl">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-600/10 text-blue-400">
          <Bus className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Transport</h1>
          <p className="text-sm text-zinc-500">
            {data.buses.length} bus{data.buses.length === 1 ? '' : 'es'} · {data.assignments.length} students assigned
          </p>
        </div>
      </header>

      <Tabs defaultValue="buses">
        <TabsList>
          <TabsTrigger value="buses">Buses &amp; routes</TabsTrigger>
          <TabsTrigger value="assignments">Student assignments</TabsTrigger>
        </TabsList>
        <TabsContent value="buses" className="mt-4">
          <BusesTab schoolId={schoolId} buses={data.buses} onChanged={load} />
        </TabsContent>
        <TabsContent value="assignments" className="mt-4">
          <AssignmentsTab schoolId={schoolId} data={data} onChanged={load} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Buses ───────────────────────────────────────────────────

function BusesTab({ schoolId, buses, onChanged }: { schoolId: string; buses: BusRow[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<BusRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [stopsBus, setStopsBus] = useState<BusRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BusRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteBus(schoolId, deleteTarget.id)
      toast.success('Bus removed')
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
          <Plus className="mr-1.5 h-4 w-4" /> Add bus
        </Button>
      </div>

      {buses.length === 0 ? (
        <Card className="py-12 text-center text-sm text-zinc-500">
          No buses yet. Add a bus with its driver and route details.
        </Card>
      ) : (
        <div className="space-y-2">
          {buses.map((b) => {
            const full = b.capacity > 0 && b.assignedCount >= b.capacity
            return (
              <Card key={b.id} className="p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-white">
                      {b.busNumber}
                      {b.routeName && <span className="text-xs font-normal text-zinc-500">· {b.routeName}</span>}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {[b.registrationNumber, b.model].filter(Boolean).join(' · ') || 'No vehicle details'}
                    </p>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      full ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                    }`}
                  >
                    {b.assignedCount}/{b.capacity || '∞'} seats
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                  <span className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5" /> {b.driverName || 'No driver'}
                  </span>
                  {b.driverPhone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" /> {b.driverPhone}
                    </span>
                  )}
                  {b.driverLicense && <span>Licence {b.driverLicense}</span>}
                  {b.attendantName && <span>Attendant: {b.attendantName}</span>}
                </div>

                {b.stops.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {b.stops.map((s) => (
                      <span key={s.id} className="rounded bg-white/5 px-2 py-0.5 text-xs text-zinc-400">
                        {s.name}
                        {s.pickupTime ? ` · ${formatTime(s.pickupTime)}` : ''}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-1 pt-1">
                  <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setStopsBus(b)}>
                    <MapPin className="h-3.5 w-3.5" /> Stops
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setEditing(b)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(b)}>
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {(creating || editing) && (
        <BusDialog
          schoolId={schoolId}
          bus={editing}
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

      {stopsBus && (
        <StopsDialog schoolId={schoolId} bus={stopsBus} onClose={() => setStopsBus(null)} onChanged={onChanged} />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Remove bus?"
        description={`"${deleteTarget?.busNumber}" and its stops will be removed.`}
        confirmLabel="Remove"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function BusDialog({
  schoolId,
  bus,
  onClose,
  onSaved,
}: {
  schoolId: string
  bus: BusRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const [f, setF] = useState({
    busNumber: bus?.busNumber ?? '',
    registrationNumber: bus?.registrationNumber ?? '',
    model: bus?.model ?? '',
    capacity: bus?.capacity ?? 0,
    routeName: bus?.routeName ?? '',
    driverName: bus?.driverName ?? '',
    driverPhone: bus?.driverPhone ?? '',
    driverLicense: bus?.driverLicense ?? '',
    attendantName: bus?.attendantName ?? '',
    attendantPhone: bus?.attendantPhone ?? '',
    notes: bus?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof f, v: string | number) => setF((p) => ({ ...p, [k]: v }))

  async function handleSave() {
    setSaving(true)
    try {
      const input = {
        schoolId,
        busNumber: f.busNumber,
        registrationNumber: f.registrationNumber || null,
        model: f.model || null,
        capacity: Number(f.capacity) || 0,
        routeName: f.routeName || null,
        driverName: f.driverName || null,
        driverPhone: f.driverPhone || null,
        driverLicense: f.driverLicense || null,
        attendantName: f.attendantName || null,
        attendantPhone: f.attendantPhone || null,
        notes: f.notes || null,
      }
      if (bus) await updateBus(bus.id, input)
      else await createBus(input)
      toast.success(bus ? 'Bus updated' : 'Bus added')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{bus ? 'Edit bus' : 'Add bus'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Bus number / name</Label>
              <Input value={f.busNumber} onChange={(e) => set('busNumber', e.target.value)} placeholder="Bus 1" />
            </div>
            <div className="space-y-1.5">
              <Label>Capacity</Label>
              <Input type="number" min={0} value={f.capacity} onChange={(e) => set('capacity', Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Registration no.</Label>
              <Input value={f.registrationNumber} onChange={(e) => set('registrationNumber', e.target.value)} placeholder="KA01AB1234" />
            </div>
            <div className="space-y-1.5">
              <Label>Model</Label>
              <Input value={f.model} onChange={(e) => set('model', e.target.value)} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Route name</Label>
              <Input value={f.routeName} onChange={(e) => set('routeName', e.target.value)} placeholder="e.g. North Loop" />
            </div>
          </div>

          <div className="border-t border-white/10 pt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Driver &amp; attendant</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Driver name</Label>
                <Input value={f.driverName} onChange={(e) => set('driverName', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Driver phone</Label>
                <Input value={f.driverPhone} onChange={(e) => set('driverPhone', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Driver licence no.</Label>
                <Input value={f.driverLicense} onChange={(e) => set('driverLicense', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Attendant name</Label>
                <Input value={f.attendantName} onChange={(e) => set('attendantName', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Attendant phone</Label>
                <Input value={f.attendantPhone} onChange={(e) => set('attendantPhone', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !f.busNumber.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StopsDialog({
  schoolId,
  bus,
  onClose,
  onChanged,
}: {
  schoolId: string
  bus: BusRow
  onClose: () => void
  onChanged: () => void
}) {
  const [stops, setStops] = useState<StopRow[]>(bus.stops)
  const [name, setName] = useState('')
  const [pickup, setPickup] = useState('')
  const [drop, setDrop] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    // Re-pull via parent loader; locally optimistic for snappiness.
    onChanged()
  }

  async function handleAdd() {
    if (!name.trim()) return
    setBusy(true)
    try {
      await addStop({
        schoolId,
        busId: bus.id,
        name,
        pickupTime: pickup || null,
        dropTime: drop || null,
        stopOrder: stops.length + 1,
      })
      setStops((p) => [...p, { id: `tmp-${Date.now()}`, name, pickupTime: pickup || null, dropTime: drop || null, stopOrder: p.length + 1 }])
      setName('')
      setPickup('')
      setDrop('')
      toast.success('Stop added')
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add stop')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(id: string) {
    setBusy(true)
    try {
      await deleteStop(schoolId, id)
      setStops((p) => p.filter((s) => s.id !== id))
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove stop')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stops — {bus.busNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {stops.length === 0 ? (
            <p className="text-sm text-zinc-500">No stops added yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {stops.map((s) => (
                <li key={s.id} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm">
                  <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                  <span className="flex-1 text-white">{s.name}</span>
                  <span className="text-xs text-zinc-500">
                    {[formatTime(s.pickupTime), formatTime(s.dropTime)].filter(Boolean).join(' / ')}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => handleRemove(s.id)} disabled={busy}>
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
            <div className="col-span-3 space-y-1.5">
              <Label>Stop name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Gate" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pickup</Label>
              <Input type="time" value={pickup} onChange={(e) => setPickup(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Drop</Label>
              <Input type="time" value={drop} onChange={(e) => setDrop(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAdd} disabled={busy || !name.trim()} className="w-full">
                Add
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Assignments ─────────────────────────────────────────────

function AssignmentsTab({
  schoolId,
  data,
  onChanged,
}: {
  schoolId: string
  data: TransportData
  onChanged: () => void
}) {
  const [assigning, setAssigning] = useState(false)
  const [unassignTarget, setUnassignTarget] = useState<AssignmentRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')

  const assignedIds = useMemo(() => new Set(data.assignments.map((a) => a.studentId)), [data.assignments])
  const unassignedStudents = data.students.filter((s) => !assignedIds.has(s.id))

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data.assignments
    return data.assignments.filter(
      (a) => a.studentName.toLowerCase().includes(q) || a.busNumber.toLowerCase().includes(q),
    )
  }, [data.assignments, search])

  async function handleUnassign() {
    if (!unassignTarget) return
    setBusy(true)
    try {
      await unassignStudent(schoolId, unassignTarget.id)
      toast.success('Student unassigned')
      setUnassignTarget(null)
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search student or bus…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button
          size="sm"
          className="ml-auto"
          onClick={() => setAssigning(true)}
          disabled={data.buses.length === 0 || unassignedStudents.length === 0}
        >
          <UserPlus className="mr-1.5 h-4 w-4" /> Assign student
        </Button>
      </div>

      {visible.length === 0 ? (
        <Card className="py-12 text-center text-sm text-zinc-500">
          {data.assignments.length === 0 ? 'No students assigned to transport yet.' : 'No matches.'}
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((a) => (
            <Card key={a.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {a.studentName}
                  {a.className ? <span className="text-xs font-normal text-zinc-500"> · {a.className}</span> : ''}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {a.busNumber}
                  {a.stopName ? ` · ${a.stopName}` : a.pickupPoint ? ` · ${a.pickupPoint}` : ''}
                  {a.feeAmount > 0 ? ` · ₹${a.feeAmount}` : ''}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setUnassignTarget(a)}>
                Unassign
              </Button>
            </Card>
          ))}
        </div>
      )}

      {assigning && (
        <AssignDialog
          schoolId={schoolId}
          data={data}
          unassignedStudents={unassignedStudents}
          onClose={() => setAssigning(false)}
          onAssigned={() => {
            setAssigning(false)
            onChanged()
          }}
        />
      )}

      <ConfirmModal
        open={!!unassignTarget}
        onOpenChange={(o) => !o && setUnassignTarget(null)}
        title="Unassign student?"
        description={`${unassignTarget?.studentName} will be removed from ${unassignTarget?.busNumber}.`}
        confirmLabel="Unassign"
        variant="destructive"
        loading={busy}
        onConfirm={handleUnassign}
      />
    </div>
  )
}

function AssignDialog({
  schoolId,
  data,
  unassignedStudents,
  onClose,
  onAssigned,
}: {
  schoolId: string
  data: TransportData
  unassignedStudents: { id: string; name: string; className: string | null }[]
  onClose: () => void
  onAssigned: () => void
}) {
  const [studentId, setStudentId] = useState('')
  const [busId, setBusId] = useState('')
  const [stopId, setStopId] = useState(NONE)
  const [pickupPoint, setPickupPoint] = useState('')
  const [fee, setFee] = useState(0)
  const [saving, setSaving] = useState(false)

  const bus = data.buses.find((b) => b.id === busId)
  const seatsLeft = bus ? (bus.capacity > 0 ? bus.capacity - bus.assignedCount : Infinity) : 0

  async function handleAssign() {
    setSaving(true)
    try {
      await assignStudent({
        schoolId,
        studentId,
        busId,
        stopId: stopId === NONE ? null : stopId,
        pickupPoint: pickupPoint || null,
        fee: Number(fee) || 0,
      })
      toast.success('Student assigned')
      onAssigned()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not assign')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign student to a bus</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Student</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a student" />
              </SelectTrigger>
              <SelectContent>
                {unassignedStudents.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {s.className ? ` · ${s.className}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Bus</Label>
            <Select
              value={busId}
              onValueChange={(v) => {
                setBusId(v)
                setStopId(NONE)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a bus" />
              </SelectTrigger>
              <SelectContent>
                {data.buses.map((b) => {
                  const left = b.capacity > 0 ? b.capacity - b.assignedCount : Infinity
                  return (
                    <SelectItem key={b.id} value={b.id} disabled={left <= 0}>
                      {b.busNumber} {b.capacity > 0 ? `(${Math.max(left, 0)} seats left)` : '(open)'}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {bus && seatsLeft <= 0 && <p className="text-xs text-rose-400">This bus is full.</p>}
          </div>
          {bus && bus.stops.length > 0 && (
            <div className="space-y-1.5">
              <Label>Stop (optional)</Label>
              <Select value={stopId} onValueChange={setStopId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— None —</SelectItem>
                  {bus.stops.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Pickup point</Label>
              <Input value={pickupPoint} onChange={(e) => setPickupPoint(e.target.value)} placeholder="e.g. Near park" />
            </div>
            <div className="space-y-1.5">
              <Label>Monthly fee (₹)</Label>
              <Input type="number" min={0} value={fee} onChange={(e) => setFee(Number(e.target.value))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={saving || !studentId || !busId || seatsLeft <= 0}>
            {saving ? 'Assigning…' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
