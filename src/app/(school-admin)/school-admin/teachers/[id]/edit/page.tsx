'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { getTeacherById, updateTeacher, uploadTeacherPhoto } from '../../actions'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'
import { ContentAreaLoader } from '@/components/loaders/page-loaders'

export default function EditTeacherPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { school } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userProfileId, setUserProfileId] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    employee_id: '',
    qualification: '',
    specialization: '',
    signature_url: '',
    join_date: '',
  })

  useEffect(() => {
    if (params.id) {
      getTeacherById(params.id)
        .then((t) => {
          setUserProfileId(t.user_profile?.id ?? '')
          setPhotoUrl(t.photo_url ?? null)
          setForm({
            full_name: t.user_profile?.full_name ?? '',
            phone: t.user_profile?.phone ?? '',
            employee_id: t.employee_id ?? '',
            qualification: t.qualification ?? '',
            specialization: t.specialization ?? '',
            signature_url: t.signature_url ?? '',
            join_date: t.join_date,
          })
        })
        .catch((e) => toast.error(getErrorMessage(e)))
        .finally(() => setLoading(false))
    }
  }, [params.id])

  const update = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      toast.error('Full name is required.')
      return
    }
    setSaving(true)
    try {
      let nextPhotoUrl = photoUrl ?? undefined
      if (photoFile && school?.id) {
        const fd = new FormData()
        fd.append('file', photoFile)
        fd.append('schoolId', school.id)
        nextPhotoUrl = await uploadTeacherPhoto(fd)
      }
      await updateTeacher(params.id, userProfileId, { ...form, photo_url: nextPhotoUrl })
      toast.success('Teacher updated successfully')
      router.push(`/school-admin/teachers/${params.id}` as any)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <ContentAreaLoader label="Loading teacher..." />
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Link href={`/school-admin/teachers/${params.id}` as any}>
        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Profile
        </Button>
      </Link>

      <div>
        <h2 className="text-2xl font-bold">Edit Teacher</h2>
        <p className="text-muted-foreground">Update personal and professional details.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">
              Full Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="full_name"
              value={form.full_name}
              onChange={(e) => update('full_name', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="teacher_photo">Profile Photo</Label>
            <div className="flex items-center gap-4">
              {photoUrl && !photoFile && (
                // eslint-disable-next-line @next/next/no-img-element -- dynamic uploaded photo preview
                <img
                  src={photoUrl}
                  alt="Teacher's current profile photo"
                  className="w-12 h-12 rounded-full object-cover border shadow-sm"
                />
              )}
              <Input
                id="teacher_photo"
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                className="max-w-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Professional Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employee_id">Employee ID</Label>
              <Input
                id="employee_id"
                value={form.employee_id}
                onChange={(e) => update('employee_id', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="join_date">Date of Joining</Label>
              <Input
                id="join_date"
                type="date"
                value={form.join_date}
                onChange={(e) => update('join_date', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qualification">Highest Qualification</Label>
            <Input
              id="qualification"
              value={form.qualification}
              onChange={(e) => update('qualification', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="specialization">Subject Specialization</Label>
            <Input
              id="specialization"
              value={form.specialization}
              onChange={(e) => update('specialization', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="signature_url">Signature Image URL</Label>
            <Input
              id="signature_url"
              value={form.signature_url}
              onChange={(e) => update('signature_url', e.target.value)}
              placeholder="https://…/signature.png"
            />
            <p className="text-xs text-muted-foreground">
              Printed on report cards for the section where this teacher is the class teacher.
            </p>
          </div>
        </CardContent>

        <CardFooter className="justify-end border-t pt-4">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
