'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/utils'
import { schoolToday } from '@/lib/date-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InlineLoader } from '@/components/loaders/page-loaders'
import { DataLoadError } from '@/components/shared/DataLoadError'
import { BookText, Trash2, Plus, Pencil, X } from 'lucide-react'
import {
  getTeacherHomeworkContext,
  createHomework,
  updateHomework,
  deleteHomework,
  type HomeworkRow,
  type HomeworkSectionOption,
  type HomeworkSubjectOption,
} from './actions'

export default function TeacherHomeworkPage() {
  const { school } = useAuthStore()
  const [sections, setSections] = useState<HomeworkSectionOption[]>([])
  const [subjects, setSubjects] = useState<HomeworkSubjectOption[]>([])
  const [list, setList] = useState<HomeworkRow[]>([])
  const [teacherFound, setTeacherFound] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // form
  const [editingId, setEditingId] = useState<string | null>(null)
  const [sectionId, setSectionId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [homeworkDate, setHomeworkDate] = useState(schoolToday())
  const [dueDate, setDueDate] = useState('')

  const load = useCallback(async () => {
    if (!school?.id) return
    setLoading(true)
    setError(null)
    try {
      const ctx = await getTeacherHomeworkContext(school.id)
      setTeacherFound(ctx.teacherFound)
      setSections(ctx.sections)
      setSubjects(ctx.subjects)
      setList(ctx.homework)
      if (!sectionId && ctx.sections[0]) setSectionId(ctx.sections[0].sectionId)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [school?.id, sectionId])

  useEffect(() => {
    if (school?.id) load()
  }, [load, school?.id])

  const selectedSection = useMemo(
    () => sections.find((s) => s.sectionId === sectionId) ?? null,
    [sections, sectionId],
  )
  const subjectOptions = useMemo(
    () => subjects.filter((s) => selectedSection && s.classId === selectedSection.classId),
    [subjects, selectedSection],
  )

  function resetForm() {
    setEditingId(null)
    setSubjectId('')
    setTitle('')
    setDescription('')
    setHomeworkDate(schoolToday())
    setDueDate('')
    if (sections[0]) setSectionId(sections[0].sectionId)
  }

  function startEdit(h: HomeworkRow) {
    setEditingId(h.id)
    const sec = sections.find((s) => s.sectionId === h.section_id)
    setSectionId(sec?.sectionId ?? sections[0]?.sectionId ?? '')
    setSubjectId(h.subject_id ?? '')
    setTitle(h.title)
    setDescription(h.description ?? '')
    setHomeworkDate(h.homework_date)
    setDueDate(h.due_date ?? '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit() {
    if (!school?.id || !selectedSection) {
      toast.error('Select a class-section first.')
      return
    }
    const input = {
      schoolId: school.id,
      classId: selectedSection.classId,
      sectionId: selectedSection.sectionId,
      subjectId: subjectId || null,
      title,
      description: description || null,
      homeworkDate,
      dueDate: dueDate || null,
    }
    setSaving(true)
    try {
      if (editingId) {
        await updateHomework(editingId, input)
        toast.success('Homework updated')
      } else {
        await createHomework(input)
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
    if (!confirm('Delete this homework entry?')) return
    try {
      await deleteHomework(id)
      toast.success('Deleted')
      if (editingId === id) resetForm()
      await load()
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  if (loading) return <InlineLoader label="Loading homework..." />
  if (error) return <DataLoadError message={error} onRetry={load} />

  if (!teacherFound) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Your teacher profile isn’t set up yet. Ask your school admin to assign you to a class-section.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 p-1">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BookText className="h-6 w-6 text-blue-500" /> Homework & Diary
        </h2>
        <p className="text-muted-foreground">Post daily homework or diary notes for your classes. Parents see them instantly.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editingId ? 'Edit entry' : 'New entry'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have no assigned class-sections yet. Ask your school admin to assign you.
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="hw-section">Class &amp; Section</Label>
                  <select
                    id="hw-section"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={sectionId}
                    onChange={(e) => { setSectionId(e.target.value); setSubjectId('') }}
                  >
                    {sections.map((s) => (
                      <option key={s.sectionId} value={s.sectionId}>
                        {s.className} — {s.sectionName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hw-subject">Subject (optional)</Label>
                  <select
                    id="hw-subject"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                  >
                    <option value="">General / Diary</option>
                    {subjectOptions.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hw-title">Title</Label>
                <Input id="hw-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Maths — Worksheet 3" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hw-desc">Details</Label>
                <textarea
                  id="hw-desc"
                  className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the homework, pages, or diary note…"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="hw-date">Date</Label>
                  <Input id="hw-date" type="date" value={homeworkDate} onChange={(e) => setHomeworkDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hw-due">Due date (optional)</Label>
                  <Input id="hw-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSubmit} disabled={saving} className="bg-blue-600 text-white hover:bg-blue-700">
                  {editingId ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                  {saving ? 'Saving…' : editingId ? 'Update' : 'Post homework'}
                </Button>
                {editingId && (
                  <Button variant="outline" onClick={resetForm} disabled={saving}>
                    <X className="mr-2 h-4 w-4" /> Cancel
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-lg font-medium">Your recent posts</h3>
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
                      {h.className} {h.sectionName}
                    </span>
                    {h.subjectName && (
                      <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-muted-foreground">{h.subjectName}</span>
                    )}
                  </div>
                  {h.description && <p className="mt-1 text-sm text-muted-foreground">{h.description}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(h.homework_date).toLocaleDateString('en-IN')}
                    {h.due_date ? ` · due ${new Date(h.due_date).toLocaleDateString('en-IN')}` : ''}
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
