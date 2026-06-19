'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { getStudentById, updateStudent } from '../../actions'
import { getClassesAndSections, uploadStudentPhoto } from '../../new/actions'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ContentAreaLoader } from '@/components/loaders/page-loaders'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

export default function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
    const unwrappedParams = React.use(params)
    const id = unwrappedParams.id

    const router = useRouter()
    const { school } = useAuthStore()

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const [classes, setClasses] = useState<any[]>([])
    const [sections, setSections] = useState<any[]>([])
    const [photoFile, setPhotoFile] = useState<File | null>(null)

    const [formData, setFormData] = useState<any>(null)

    const loadData = useCallback(async () => {
        if (!school?.id) return
        try {
            const resLevels = await getClassesAndSections(school.id)
            setClasses(resLevels.classes || [])
            setSections(resLevels.sections || [])

            const student = await getStudentById(id)
            setFormData(student)
        } catch (e) {
            toast.error("Failed to load data: " + getErrorMessage(e))
        } finally {
            setLoading(false)
        }
    }, [school?.id, id])

    useEffect(() => {
        if (school?.id && id) {
            loadData()
        }
    }, [loadData, school?.id, id])

    const updateForm = (field: string, value: string) => {
        setFormData((prev: any) => ({ ...prev, [field]: value }))
    }

    const availableSections = formData ? sections.filter(s => s.class_id === formData.class_id) : []

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.first_name || !formData.date_of_birth || !formData.gender || !formData.class_id || !formData.admission_number) {
            toast.error("Please fill all required fields.")
            return
        }
        setSaving(true)
        try {
            let photoUrl = formData.photo_url || null
            if (photoFile) {
                const fd = new FormData()
                fd.append('file', photoFile)
                fd.append('schoolId', school!.id)
                photoUrl = await uploadStudentPhoto(fd)
            }

            const payload = {
                first_name: formData.first_name,
                middle_name: formData.middle_name,
                last_name: formData.last_name,
                gender: formData.gender,
                date_of_birth: formData.date_of_birth,
                date_of_joining: formData.date_of_joining,
                admission_number: formData.admission_number,
                roll_number: formData.roll_number,
                class_id: formData.class_id,
                section_id: formData.section_id || null,
                parent_name: formData.parent_name,
                parent_contact: formData.parent_contact,
                parent_email: formData.parent_email,
                address: formData.address,
                blood_group: formData.blood_group,
                medical_conditions: formData.medical_conditions,
                photo_url: photoUrl
            }
            await updateStudent(id, payload)
            toast.success("Student updated successfully!")
            router.push('/school-admin/students')
        } catch (e) {
            toast.error(getErrorMessage(e))
        } finally {
            setSaving(false)
        }
    }

    if (loading || !formData) return <ContentAreaLoader label="Loading student data..." />

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href={"/school-admin/students" as any}>
                    <Button variant="outline" size="icon" aria-label="Go back">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Edit Student: {formData.first_name} {formData.last_name}</h2>
                    <p className="text-muted-foreground">Modify student details and records.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="grid gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Personal Details</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-first_name">First Name <span className="text-red-500">*</span></Label>
                                <Input id="edit-first_name" value={formData.first_name || ''} onChange={e => updateForm('first_name', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-middle_name">Middle Name</Label>
                                <Input id="edit-middle_name" value={formData.middle_name || ''} onChange={e => updateForm('middle_name', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-last_name">Last Name</Label>
                                <Input id="edit-last_name" value={formData.last_name || ''} onChange={e => updateForm('last_name', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-gender">Gender <span className="text-red-500">*</span></Label>
                                <select
                                    id="edit-gender"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={formData.gender || ''}
                                    onChange={e => updateForm('gender', e.target.value)}
                                >
                                    <option value="" disabled>Select gender</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-date_of_birth">Date of Birth <span className="text-red-500">*</span></Label>
                                <Input id="edit-date_of_birth" type="date" value={formData.date_of_birth || ''} onChange={e => updateForm('date_of_birth', e.target.value)} />
                            </div>
                            <div className="space-y-2 md:col-span-2 mt-2">
                                <Label htmlFor="edit-photo">Update Photo</Label>
                                <div className="flex items-center gap-4 mt-2">
                                    {formData.photo_url && !photoFile && (
                                        // eslint-disable-next-line @next/next/no-img-element -- dynamic uploaded-photo preview
                                        <img src={formData.photo_url} alt="Student's current profile photo" className="w-12 h-12 rounded-full object-cover border shadow-sm" />
                                    )}
                                    <Input id="edit-photo" type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] || null)} className="max-w-xs" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Academic Information</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-class_id">Class <span className="text-red-500">*</span></Label>
                                <select
                                    id="edit-class_id"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={formData.class_id || ''}
                                    onChange={e => {
                                        updateForm('class_id', e.target.value)
                                        updateForm('section_id', '')
                                    }}
                                >
                                    <option value="" disabled>Select Class</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-section_id">Section</Label>
                                <select
                                    id="edit-section_id"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                                    value={formData.section_id || ''}
                                    onChange={e => updateForm('section_id', e.target.value)}
                                    disabled={!formData.class_id}
                                >
                                    <option value="">No Section</option>
                                    {availableSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-admission_number">Admission No. <span className="text-red-500">*</span></Label>
                                <Input id="edit-admission_number" value={formData.admission_number || ''} onChange={e => updateForm('admission_number', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-roll_number">Roll Number</Label>
                                <Input id="edit-roll_number" value={formData.roll_number || ''} onChange={e => updateForm('roll_number', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-date_of_joining">Date of Joining <span className="text-red-500">*</span></Label>
                                <Input id="edit-date_of_joining" type="date" value={formData.date_of_joining || ''} onChange={e => updateForm('date_of_joining', e.target.value)} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Parent & Contact Info</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-parent_name">Parent / Guardian Name</Label>
                                <Input id="edit-parent_name" value={formData.parent_name || ''} onChange={e => updateForm('parent_name', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-address">Residential Address</Label>
                                <Input id="edit-address" value={formData.address || ''} onChange={e => updateForm('address', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-parent_contact">Contact Number</Label>
                                <Input id="edit-parent_contact" value={formData.parent_contact || ''} onChange={e => updateForm('parent_contact', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-parent_email">Email Address</Label>
                                <Input id="edit-parent_email" type="email" value={formData.parent_email || ''} onChange={e => updateForm('parent_email', e.target.value)} />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
                            {saving ? "Saving Changes..." : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
                        </Button>
                    </div>
                </div>
            </form>

        </div>
    )
}
