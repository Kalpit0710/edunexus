'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/utils'
import { audienceLabel } from '@/lib/announcement-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InlineLoader } from '@/components/loaders/page-loaders'
import { DataLoadError } from '@/components/shared/DataLoadError'
import { Bell, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  createStaffAnnouncement,
  deleteStaffAnnouncement,
  getStaffAnnouncementsContext,
  updateStaffAnnouncement,
  type StaffAnnouncementInput,
  type StaffAnnouncementRow,
  type AnnouncementClassOption,
} from './actions'
import type { AnnouncementAudience } from '@/lib/announcement-utils'

const TARGET_OPTIONS: { value: AnnouncementAudience; label: string }[] = [
  { value: 'class_students', label: 'Students of one class' },
  { value: 'all_students', label: 'All students' },
  { value: 'all_teachers', label: 'All teachers' },
]

export default function ManagerNotificationsPage() {
  const { school, user } = useAuthStore()
  const [classes, setClasses] = useState<AnnouncementClassOption[]>([])
  const [list, setList] = useState<StaffAnnouncementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [targetAudience, setTargetAudience] = useState<AnnouncementAudience>('class_students')
  const [targetClassId, setTargetClassId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  const isSchoolAdmin = user?.user_metadata?.role === 'school_admin'

  const load = useCallback(async () => {
    if (!school?.id) return
    setLoading(true)
    setError(null)
    try {
      const ctx = await getStaffAnnouncementsContext(school.id)
      setClasses(ctx.classes)
      setList(ctx.announcements)
      if (!targetClassId && ctx.classes[0]) setTargetClassId(ctx.classes[0].id)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [school?.id, targetClassId])

  useEffect(() => {
    if (school?.id) load()
  }, [school?.id, load])

  const classRequired = targetAudience === 'class_students'
  const classNameById = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes])
  const preview = useMemo(() => {
    const ready = !classRequired || Boolean(targetClassId)
    return {
      ready,
      schoolsAffected: school?.id ? 1 : 0,
      classesAffected: classRequired && targetClassId ? 1 : 0,
      // Manager/school-admin notifications persist one announcement row per send.
      deliveryRows: ready ? 1 : 0,
    }
  }, [classRequired, targetClassId, school?.id])

  function resetForm() {
    setEditingId(null)
    setTargetAudience('class_students')
    setTargetClassId(classes[0]?.id ?? '')
    setTitle('')
    setBody('')
  }

  function startEdit(a: StaffAnnouncementRow) {
    setEditingId(a.id)
    setTargetAudience(a.targetAudience)
    setTargetClassId(a.targetClassId ?? classes[0]?.id ?? '')
    setTitle(a.title)
    setBody(a.body)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit() {
    if (!school?.id) return

    const payload: StaffAnnouncementInput = {
      schoolId: school.id,
      targetAudience,
      targetClassId: classRequired ? targetClassId || null : null,
      title,
      body,
    }

    setSaving(true)
    try {
      if (editingId) {
        await updateStaffAnnouncement(editingId, payload)
        toast.success('Notification updated')
      } else {
        await createStaffAnnouncement(payload)
        toast.success('Notification sent')
      }
      resetForm()
      await load()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!school?.id) return
    if (!confirm('Delete this notification?')) return
    try {
      await deleteStaffAnnouncement(school.id, id)
      toast.success('Deleted')
      if (editingId === id) resetForm()
      await load()
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  if (loading) return <InlineLoader label="Loading notifications..." />
  if (error) return <DataLoadError message={error} onRetry={load} />

  return (
    <div className="space-y-6 p-1">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Bell className="h-6 w-6 text-blue-500" /> Notifications
        </h2>
        <p className="text-muted-foreground">
          {isSchoolAdmin
            ? 'Send class or broadcast notifications to students and teachers.'
            : 'Send class or broadcast notifications allowed for manager workflows.'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editingId ? 'Edit notification' : 'New notification'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="target-audience">Target</Label>
              <select
                id="target-audience"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={targetAudience}
                onChange={(e) => {
                  const next = e.target.value as AnnouncementAudience
                  setTargetAudience(next)
                  if (next !== 'class_students') setTargetClassId('')
                  else if (!targetClassId && classes[0]) setTargetClassId(classes[0].id)
                }}
              >
                {TARGET_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-class">Class (for class notifications)</Label>
              <select
                id="target-class"
                disabled={!classRequired}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
                value={targetClassId}
                onChange={(e) => setTargetClassId(e.target.value)}
              >
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notif-title">Title</Label>
            <Input id="notif-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Unit Test Schedule" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notif-body">Message</Label>
            <textarea
              id="notif-body"
              className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your notification message..."
            />
          </div>

          <div className="rounded-md border border-input bg-muted/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview Recipient Count</p>
            {preview.ready ? (
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] text-muted-foreground">Schools affected</p>
                  <p className="text-lg font-semibold">{preview.schoolsAffected}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Classes affected</p>
                  <p className="text-lg font-semibold">{preview.classesAffected}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Estimated delivery rows</p>
                  <p className="text-lg font-semibold text-blue-600">{preview.deliveryRows}</p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Choose a class to preview the impact.</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={saving} className="bg-blue-600 text-white hover:bg-blue-700">
              {editingId ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
              {saving ? 'Saving...' : editingId ? 'Update' : 'Send'}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={resetForm} disabled={saving}>
                <X className="mr-2 h-4 w-4" /> Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-lg font-medium">Recent notifications</h3>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          list.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.title}</span>
                    <span className="rounded bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">{audienceLabel(a.targetAudience)}</span>
                    {a.targetClassId && (
                      <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-muted-foreground">
                        {a.targetClassName ?? classNameById.get(a.targetClassId) ?? 'Class'}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(a.createdAt).toLocaleDateString('en-IN')} · by {a.createdByName ?? 'Staff'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" aria-label="Edit notification" onClick={() => startEdit(a)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Delete notification" className="text-red-500" onClick={() => handleDelete(a.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
