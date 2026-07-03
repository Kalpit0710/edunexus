'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, SendHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InlineLoader } from '@/components/loaders/page-loaders'
import { DataLoadError } from '@/components/shared/DataLoadError'
import { getErrorMessage } from '@/lib/utils'
import {
  SUPER_ADMIN_NOTIFICATION_SCOPES,
  estimatePreviewRecipientCount,
  scopeLabel,
  type SuperAdminNotificationScope,
} from '@/lib/super-admin-notification-utils'
import {
  createSuperAdminNotification,
  getSuperAdminNotificationsContext,
  type NotificationClassOption,
  type NotificationSchoolOption,
  type SuperAdminNotificationRow,
} from './actions'

export default function SuperAdminNotificationsPage() {
  const [schools, setSchools] = useState<NotificationSchoolOption[]>([])
  const [classes, setClasses] = useState<NotificationClassOption[]>([])
  const [list, setList] = useState<SuperAdminNotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [scope, setScope] = useState<SuperAdminNotificationScope>('global_everyone')
  const [targetSchoolId, setTargetSchoolId] = useState('')
  const [targetClassId, setTargetClassId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  const needsSchool = scope === 'school_everyone' || scope === 'school_students' || scope === 'school_teachers' || scope === 'class_students'
  const needsClass = scope === 'class_students'

  const filteredClasses = useMemo(
    () => classes.filter((c) => !targetSchoolId || c.schoolId === targetSchoolId),
    [classes, targetSchoolId],
  )

  const preview = useMemo(
    () =>
      estimatePreviewRecipientCount({
        scope,
        availableSchoolIds: schools.map((s) => s.id),
        targetSchoolId: needsSchool ? targetSchoolId || null : null,
        targetClassId: needsClass ? targetClassId || null : null,
      }),
    [scope, schools, needsSchool, targetSchoolId, needsClass, targetClassId],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const ctx = await getSuperAdminNotificationsContext()
      setSchools(ctx.schools)
      setClasses(ctx.classes)
      setList(ctx.notifications)
      if (!targetSchoolId && ctx.schools[0]) setTargetSchoolId(ctx.schools[0].id)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [targetSchoolId])

  useEffect(() => {
    load()
  }, [load])

  async function handleSend() {
    setSaving(true)
    try {
      const result = await createSuperAdminNotification({
        scope,
        targetSchoolId: needsSchool ? targetSchoolId || null : null,
        targetClassId: needsClass ? targetClassId || null : null,
        title,
        body,
      })
      toast.success(`Notification sent (${result.scope}) to ${result.inserted} delivery row(s).`)
      setTitle('')
      setBody('')
      if (!needsClass) setTargetClassId('')
      await load()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <InlineLoader label="Loading notifications console..." />
  if (error) return <DataLoadError message={error} onRetry={load} />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
          <Bell className="h-6 w-6 text-blue-400" /> Platform Notifications
        </h1>
        <p className="text-sm text-zinc-400">Send notifications globally, school-wise, or class-wise from the super-admin console.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-white">Compose Notification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sa-scope">Target Scope</Label>
              <select
                id="sa-scope"
                value={scope}
                onChange={(e) => {
                  const next = e.target.value as SuperAdminNotificationScope
                  setScope(next)
                  if (next !== 'class_students') setTargetClassId('')
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {SUPER_ADMIN_NOTIFICATION_SCOPES.map((s) => (
                  <option key={s} value={s}>
                    {scopeLabel(s)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sa-school">School {needsSchool ? '' : '(optional)'}</Label>
              <select
                id="sa-school"
                disabled={!needsSchool}
                value={targetSchoolId}
                onChange={(e) => {
                  setTargetSchoolId(e.target.value)
                  setTargetClassId('')
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
              >
                <option value="">Select school</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {needsClass && (
            <div className="space-y-2">
              <Label htmlFor="sa-class">Class</Label>
              <select
                id="sa-class"
                value={targetClassId}
                onChange={(e) => setTargetClassId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select class</option>
                {filteredClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="sa-title">Title</Label>
            <Input
              id="sa-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Platform maintenance notice"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sa-body">Message</Label>
            <textarea
              id="sa-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Write the notification message..."
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Preview Recipient Count</p>
            {preview.ready ? (
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] text-zinc-500">Schools affected</p>
                  <p className="text-lg font-semibold text-white">{preview.schoolsAffected}</p>
                </div>
                <div>
                  <p className="text-[11px] text-zinc-500">Classes affected</p>
                  <p className="text-lg font-semibold text-white">{preview.classesAffected}</p>
                </div>
                <div>
                  <p className="text-[11px] text-zinc-500">Estimated delivery rows</p>
                  <p className="text-lg font-semibold text-blue-400">{preview.deliveryRows}</p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">Choose required school/class fields to preview the impact.</p>
            )}
          </div>

          <Button onClick={handleSend} disabled={saving} className="bg-blue-600 text-white hover:bg-blue-700">
            <SendHorizontal className="mr-2 h-4 w-4" />
            {saving ? 'Sending...' : 'Send Notification'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-white">Recent Notifications Sent By You</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {list.length === 0 ? (
            <p className="text-sm text-zinc-500">No notifications sent yet.</p>
          ) : (
            list.map((n) => (
              <div key={n.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-white">{n.title}</p>
                  <span className="rounded bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">{n.audience}</span>
                  {n.schoolName && (
                    <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-zinc-400">
                      {n.schoolName} {n.schoolCode ? `(${n.schoolCode})` : ''}
                    </span>
                  )}
                  {n.targetClassName && (
                    <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-zinc-400">{n.targetClassName}</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-zinc-300">{n.body}</p>
                <p className="mt-1 text-xs text-zinc-500">{new Date(n.createdAt).toLocaleString('en-IN')}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
