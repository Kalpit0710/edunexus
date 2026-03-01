'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import {
  getTeacherById,
  getTeacherAssignments,
  getClassesAndSections,
  toggleTeacherStatus,
  assignTeacherToSection,
  removeAssignment,
  type TeacherRow,
} from '../actions'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowLeft, Edit, Power, Plus, Trash2, BookOpen, User } from 'lucide-react'
import Link from 'next/link'
import { getInitials } from '@/lib/utils'

export default function TeacherProfilePage() {
  const params = useParams<{ id: string }>()
  const { school } = useAuthStore()

  const [teacher, setTeacher] = useState<TeacherRow | null>(null)
  const [assignments, setAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Assignment form state
  const [classes, setClasses] = useState<any[]>([])
  const [sections, setSections] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [selClass, setSelClass] = useState('')
  const [selSection, setSelSection] = useState('')
  const [selSubject, setSelSubject] = useState('')
  const [isClassTeacher, setIsClassTeacher] = useState(false)
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    if (params.id) loadAll()
  }, [params.id])

  async function loadAll() {
    setLoading(true)
    try {
      const [t, a] = await Promise.all([
        getTeacherById(params.id),
        getTeacherAssignments(params.id),
      ])
      setTeacher(t)
      setAssignments(a)
      if (school?.id) {
        const hier = await getClassesAndSections(school.id)
        setClasses(hier.classes)
        setSections(hier.sections)
        setSubjects(hier.subjects)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleStatus() {
    if (!teacher) return
    try {
      await toggleTeacherStatus(teacher.id, teacher.user_profile!.id, !teacher.is_active)
      toast.success(teacher.is_active ? 'Teacher deactivated' : 'Teacher activated')
      loadAll()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  async function handleAssign() {
    if (!school?.id || !selSection) {
      toast.error('Please select a section.')
      return
    }
    setAssigning(true)
    try {
      await assignTeacherToSection(
        school.id,
        params.id,
        selSection,
        selSubject || null,
        isClassTeacher
      )
      toast.success('Assignment added')
      setSelClass('')
      setSelSection('')
      setSelSubject('')
      setIsClassTeacher(false)
      loadAll()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setAssigning(false)
    }
  }

  async function handleRemoveAssignment(id: string) {
    try {
      await removeAssignment(id)
      toast.success('Assignment removed')
      loadAll()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const filteredSections = sections.filter((s) => s.class_id === selClass)
  const filteredSubjects = subjects.filter((s) => s.class_id === selClass)

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading teacher profile…</div>
  }

  if (!teacher) {
    return <div className="p-8 text-muted-foreground">Teacher not found.</div>
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <Link href={'/school-admin/teachers' as any}>
        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Teachers
        </Button>
      </Link>

      {/* Profile header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Avatar */}
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold shrink-0">
              {getInitials(teacher.user_profile?.full_name ?? '?')}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold truncate">
                  {teacher.user_profile?.full_name}
                </h2>
                <Badge variant={teacher.is_active ? 'default' : 'secondary'}>
                  {teacher.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {teacher.user_profile?.email}
                {teacher.user_profile?.phone && ` · ${teacher.user_profile.phone}`}
              </p>
              {teacher.specialization && (
                <p className="text-sm mt-0.5">{teacher.specialization}</p>
              )}
            </div>

            <div className="flex gap-2 shrink-0">
              <Link href={`/school-admin/teachers/${teacher.id}/edit` as any}>
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleStatus}
                className={teacher.is_active ? 'text-red-600 hover:text-red-600' : 'text-green-600 hover:text-green-600'}
              >
                <Power className="h-4 w-4 mr-1" />
                {teacher.is_active ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details grid */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4" />
              Personal Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="Employee ID" value={teacher.employee_id ?? '—'} />
            <DetailRow label="Qualification" value={teacher.qualification ?? '—'} />
            <DetailRow
              label="Date of Joining"
              value={
                teacher.join_date
                  ? new Date(teacher.join_date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })
                  : '—'
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Teaching Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="Total Assignments" value={String(assignments.length)} />
            <DetailRow
              label="Class Teacher Of"
              value={
                assignments
                  .filter((a) => a.is_class_teacher)
                  .map((a) => `${a.section?.class?.name} ${a.section?.name}`)
                  .join(', ') || '—'
              }
            />
          </CardContent>
        </Card>
      </div>

      {/* Class Assignments */}
      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-base">Class & Subject Assignments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {/* Existing assignments */}
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No assignments yet.</p>
          ) : (
            <div className="space-y-2">
              {assignments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm"
                >
                  <div>
                    <span className="font-medium">
                      {a.section?.class?.name} — {a.section?.name}
                    </span>
                    {a.subject && (
                      <span className="ml-2 text-muted-foreground">({a.subject.name})</span>
                    )}
                    {a.is_class_teacher && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        Class Teacher
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-500"
                    onClick={() => handleRemoveAssignment(a.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add assignment form */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <p className="text-sm font-medium">Add Assignment</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Class</Label>
                <Select
                  value={selClass}
                  onValueChange={(v) => {
                    setSelClass(v)
                    setSelSection('')
                    setSelSubject('')
                  }}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Section</Label>
                <Select
                  value={selSection}
                  onValueChange={setSelSection}
                  disabled={!selClass}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Subject (optional)</Label>
                <Select
                  value={selSubject}
                  onValueChange={setSelSubject}
                  disabled={!selClass}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Any / All subjects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any / All subjects</SelectItem>
                    {filteredSubjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="classTeacher"
                  checked={isClassTeacher}
                  onCheckedChange={(v) => setIsClassTeacher(Boolean(v))}
                />
                <Label htmlFor="classTeacher" className="text-sm cursor-pointer">
                  Class Teacher for this section
                </Label>
              </div>

              <Button size="sm" onClick={handleAssign} disabled={assigning || !selSection}>
                <Plus className="h-4 w-4 mr-1" />
                {assigning ? 'Adding…' : 'Add'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}
