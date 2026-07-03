'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/utils'
import { schoolToday } from '@/lib/date-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'
import { InlineLoader } from '@/components/loaders/page-loaders'
import { DataLoadError } from '@/components/shared/DataLoadError'
import { BookText, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  createSchoolHomework,
  deleteSchoolHomework,
  getSchoolHomeworkContext,
  updateSchoolHomework,
  type HomeworkInput,
  type HomeworkRow,
  type HomeworkClassOption,
  type HomeworkSectionOption,
  type HomeworkSubjectOption,
} from './actions'

export default function SchoolAdminHomeworkPage() {
  const { school } = useAuthStore()
  const [classes, setClasses] = useState<HomeworkClassOption[]>([])
  const [sections, setSections] = useState<HomeworkSectionOption[]>([])
  const [subjects, setSubjects] = useState<HomeworkSubjectOption[]>([])
  const [list, setList] = useState<HomeworkRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [classId, setClassId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [homeworkDate, setHomeworkDate] = useState(schoolToday())
  const [dueDate, setDueDate] = useState('')

  const filteredSections = useMemo(
    () => sections.filter((s) => s.classId === classId),
    [sections, classId],
  )
  const filteredSubjects = useMemo(
    () => subjects.filter((s) => s.classId === classId),
    [subjects, classId],
  )

  const load = useCallback(async () => {
    if (!school?.id) return
    setLoading(true)
    setError(null)
    try {
      const ctx = await getSchoolHomeworkContext(school.id)
      setClasses(ctx.classes)
      setSections(ctx.sections)
      setSubjects(ctx.subjects)
      setList(ctx.homework)
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
    setSectionId('')
    setSubjectId('')
    setTitle('')
    setDescription('')
    setHomeworkDate(schoolToday())
    setDueDate('')
  }

  function startEdit(h: HomeworkRow) {
    setEditingId(h.id)
    setClassId(h.class_id)
    setSectionId(h.section_id ?? '')
    setSubjectId(h.subject_id ?? '')
    setTitle(h.title)
    setDescription(h.description ?? '')
    setHomeworkDate(h.homework_date)
    setDueDate(h.due_date ?? '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit() {
    if (!school?.id) return

    const payload: HomeworkInput = {
      schoolId: school.id,
      classId,
      sectionId: sectionId || null,
      subjectId: subjectId || null,
      title,
      description: description || null,
      homeworkDate,
      dueDate: dueDate || null,
    }

    setSaving(true)
    try {
      if (editingId) {
        await updateSchoolHomework(editingId, payload)
        toast.success('Homework updated')
      } else {
        await createSchoolHomework(payload)
        toast.success('Homework posted')
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
    if (!confirm('Delete this homework entry?')) return
    try {
      await deleteSchoolHomework(school.id, id)
      toast.success('Deleted')
      if (editingId === id) resetForm()
      await load()
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  if (loading) return <InlineLoader label="Loading homework..." />
  if (error) return <DataLoadError message={error} onRetry={load} />

  return (
    <div className="space-y-6 p-1">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BookText className="h-6 w-6 text-blue-500" /> Homework Management
        </h2>
        <p className="text-muted-foreground">Create, review, edit, or delete homework across classes.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editingId ? 'Edit entry' : 'New entry'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="sa-hw-class">Class</Label>
              <select
                id="sa-hw-class"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value)
                  setSectionId('')
                  setSubjectId('')
                }}
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
              <Label htmlFor="sa-hw-section">Section (optional)</Label>
              <select
                id="sa-hw-section"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
              >
                <option value="">Whole class</option>
                {filteredSections.map((s) => (
                  <option key={s.sectionId} value={s.sectionId}>
                    {s.sectionName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sa-hw-subject">Subject (optional)</Label>
              <select
                id="sa-hw-subject"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                <option value="">General / Diary</option>
                {filteredSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sa-hw-title">Title</Label>
            <Input id="sa-hw-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Science worksheet" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sa-hw-desc">Details</Label>
            <textarea
              id="sa-hw-desc"
              className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the work or diary note..."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sa-hw-date">Date</Label>
              <DateInput id="sa-hw-date" value={homeworkDate} onChange={(e) => setHomeworkDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sa-hw-due">Due date (optional)</Label>
              <DateInput id="sa-hw-due" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={saving} className="bg-blue-600 text-white hover:bg-blue-700">
              {editingId ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
              {saving ? 'Saving...' : editingId ? 'Update' : 'Post homework'}
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
        <h3 className="text-lg font-medium">Recent homework</h3>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No homework posted yet.</p>
        ) : (
          list.map((h) => (
            <Card key={h.id}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{h.title}</span>
                    <span className="rounded bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">
                      {h.className} {h.sectionName ? `- ${h.sectionName}` : '- All Sections'}
                    </span>
                    {h.subjectName && (
                      <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-muted-foreground">{h.subjectName}</span>
                    )}
                  </div>
                  {h.description && <p className="mt-1 text-sm text-muted-foreground">{h.description}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(h.homework_date).toLocaleDateString('en-IN')}
                    {h.due_date ? ` - due ${new Date(h.due_date).toLocaleDateString('en-IN')}` : ''}
                    {` - by ${h.created_by_name ?? 'Staff'}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" aria-label="Edit homework" onClick={() => startEdit(h)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Delete homework" className="text-red-500" onClick={() => handleDelete(h.id)}>
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
