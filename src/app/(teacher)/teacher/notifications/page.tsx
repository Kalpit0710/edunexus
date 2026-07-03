'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InlineLoader } from '@/components/loaders/page-loaders'
import { DataLoadError } from '@/components/shared/DataLoadError'
import { Bell, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  createTeacherAnnouncement,
  deleteTeacherAnnouncement,
  getTeacherNotificationsContext,
  updateTeacherAnnouncement,
  type TeacherAnnouncementInput,
  type TeacherAnnouncementRow,
  type TeacherClassOption,
} from './actions'

export default function TeacherNotificationsPage() {
  const { school } = useAuthStore()
  const [teacherFound, setTeacherFound] = useState(true)
  const [classes, setClasses] = useState<TeacherClassOption[]>([])
  const [list, setList] = useState<TeacherAnnouncementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [classId, setClassId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  const classNameById = useMemo(() => new Map(classes.map((c) => [c.classId, c.className])), [classes])

  const load = useCallback(async () => {
    if (!school?.id) return
    setLoading(true)
    setError(null)
    try {
      const ctx = await getTeacherNotificationsContext(school.id)
      setTeacherFound(ctx.teacherFound)
      setClasses(ctx.classes)
      setList(ctx.announcements)
      if (!classId && ctx.classes[0]) setClassId(ctx.classes[0].classId)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [school?.id, classId])

  useEffect(() => {
    if (school?.id) load()
  }, [school?.id, load])

  function resetForm() {
    setEditingId(null)
    setClassId(classes[0]?.classId ?? '')
    setTitle('')
    setBody('')
  }

  function startEdit(a: TeacherAnnouncementRow) {
    setEditingId(a.id)
    setClassId(a.classId)
    setTitle(a.title)
    setBody(a.body)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit() {
    if (!school?.id) return
    const payload: TeacherAnnouncementInput = {
      schoolId: school.id,
      classId,
      title,
      body,
    }

    setSaving(true)
    try {
      if (editingId) {
        await updateTeacherAnnouncement(editingId, payload)
        toast.success('Notification updated')
      } else {
        await createTeacherAnnouncement(payload)
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
      await deleteTeacherAnnouncement(school.id, id)
      toast.success('Deleted')
      if (editingId === id) resetForm()
      await load()
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  if (loading) return <InlineLoader label="Loading notifications..." />
  if (error) return <DataLoadError message={error} onRetry={load} />

  if (!teacherFound) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Your teacher profile is not ready yet. Ask your school admin to assign you to class-sections.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 p-1">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Bell className="h-6 w-6 text-blue-500" /> Class Notifications
        </h2>
        <p className="text-muted-foreground">Send notifications to students of your assigned class only.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editingId ? 'Edit notification' : 'New class notification'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="teacher-target-class">Class</Label>
            <select
              id="teacher-target-class"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c.classId} value={c.classId}>
                  {c.className}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="teacher-notif-title">Title</Label>
            <Input id="teacher-notif-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Homework reminder" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="teacher-notif-body">Message</Label>
            <textarea
              id="teacher-notif-body"
              className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write a message for your class students..."
            />
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
        <h3 className="text-lg font-medium">Your notifications</h3>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notifications posted yet.</p>
        ) : (
          list.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.title}</span>
                    <span className="rounded bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">Class Students</span>
                    <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-muted-foreground">
                      {a.className ?? classNameById.get(a.classId) ?? 'Class'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleDateString('en-IN')}</p>
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
