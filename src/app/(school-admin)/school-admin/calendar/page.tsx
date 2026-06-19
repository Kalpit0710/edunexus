'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  type HolidayRow,
  type HolidayCategory,
} from './actions'
import { HOLIDAY_CATEGORIES, categoryClasses, categoryLabel, formatDateRange } from '@/lib/calendar-utils'
import { schoolToday } from '@/lib/date-utils'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { InlineLoader } from '@/components/loaders/page-loaders'
import { DataLoadError } from '@/components/shared/DataLoadError'
import { CalendarDays, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export default function AdminCalendarPage() {
  const { school } = useAuthStore()
  const schoolId = school?.id ?? ''
  const today = schoolToday()

  const [holidays, setHolidays] = useState<HolidayRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<HolidayRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<HolidayRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    setError(null)
    try {
      setHolidays(await getHolidays(schoolId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the calendar.')
    } finally {
      setLoading(false)
    }
  }, [schoolId])

  useEffect(() => {
    load()
  }, [load])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteHoliday(schoolId, deleteTarget.id)
      toast.success('Removed from calendar')
      setDeleteTarget(null)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const upcoming = holidays.filter((h) => (h.endDate ?? h.startDate) >= today)
  const past = holidays.filter((h) => (h.endDate ?? h.startDate) < today)

  if (loading) return <InlineLoader label="Loading calendar…" className="mt-20" />
  if (error) return <DataLoadError message={error} onRetry={load} />

  return (
    <div className="px-6 py-6 space-y-5 max-w-4xl">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-600/10 text-blue-400">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Academic Calendar</h1>
            <p className="text-sm text-zinc-500">Holidays, events, exams &amp; breaks — visible to teachers and parents.</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Add entry
        </Button>
      </header>

      {holidays.length === 0 ? (
        <Card className="py-12 text-center text-sm text-zinc-500">
          No calendar entries yet. Add holidays, events or exam windows.
        </Card>
      ) : (
        <div className="space-y-6">
          <CalendarList title="Upcoming" rows={upcoming} onEdit={setEditing} onDelete={setDeleteTarget} />
          {past.length > 0 && (
            <CalendarList title="Past" rows={past} dimmed onEdit={setEditing} onDelete={setDeleteTarget} />
          )}
        </div>
      )}

      {(creating || editing) && (
        <HolidayDialog
          schoolId={schoolId}
          holiday={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            load()
          }}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Remove calendar entry?"
        description={`"${deleteTarget?.title}" will be removed from the calendar.`}
        confirmLabel="Remove"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function CalendarList({
  title,
  rows,
  dimmed = false,
  onEdit,
  onDelete,
}: {
  title: string
  rows: HolidayRow[]
  dimmed?: boolean
  onEdit: (h: HolidayRow) => void
  onDelete: (h: HolidayRow) => void
}) {
  if (rows.length === 0) return null
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</p>
      {rows.map((h) => (
        <Card key={h.id} className={`flex items-center gap-3 p-3 ${dimmed ? 'opacity-60' : ''}`}>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${categoryClasses(h.category)}`}>
            {categoryLabel(h.category)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{h.title}</p>
            <p className="text-xs text-zinc-500">
              {formatDateRange(h.startDate, h.endDate)}
              {h.description ? ` · ${h.description}` : ''}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onEdit(h)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(h)}>
            <Trash2 className="h-4 w-4 text-red-400" />
          </Button>
        </Card>
      ))}
    </div>
  )
}

function HolidayDialog({
  schoolId,
  holiday,
  onClose,
  onSaved,
}: {
  schoolId: string
  holiday: HolidayRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(holiday?.title ?? '')
  const [category, setCategory] = useState<HolidayCategory>(holiday?.category ?? 'holiday')
  const [startDate, setStartDate] = useState(holiday?.startDate ?? schoolToday())
  const [endDate, setEndDate] = useState(holiday?.endDate ?? '')
  const [description, setDescription] = useState(holiday?.description ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const input = {
        schoolId,
        title,
        category,
        startDate,
        endDate: endDate || null,
        description: description || null,
      }
      if (holiday) await updateHoliday(holiday.id, input)
      else await createHoliday(input)
      toast.success(holiday ? 'Entry updated' : 'Entry added')
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
          <DialogTitle>{holiday ? 'Edit entry' : 'Add calendar entry'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Independence Day" />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as HolidayCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOLIDAY_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End date (optional)</Label>
              <Input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
