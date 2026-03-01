'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { getStudentById, updateStudent } from '../../actions'
import { getClassesAndSections, uploadStudentPhoto } from '../../new/actions'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
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

    useEffect(() => {
        if (school?.id && id) {
            loadData()
        }
    }, [school?.id, id])

    async function loadData() {
        try {
            const resLevels = await getClassesAndSections(school!.id)
            setClasses(resLevels.classes || [])
            setSections(resLevels.sections || [])

            const student = await getStudentById(id)
            setFormData(student)
        } catch (e: any) {
            toast.error("Failed to load data: " + e.message)
        } finally {
            setLoading(false)
        }
    }

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
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setSaving(false)
        }
    }

    if (loading || !formData) return <div className="p-8">Loading student data...</div>

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href={"/school-admin/students" as any}>
                    <Button variant="outline" size="icon">
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
                                <Label>First Name <span className="text-red-500">*</span></Label>
                                <Input value={formData.first_name || ''} onChange={e => updateForm('first_name', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Middle Name</Label>
                                <Input value={formData.middle_name || ''} onChange={e => updateForm('middle_name', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Last Name</Label>
                                <Input value={formData.last_name || ''} onChange={e => updateForm('last_name', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Gender <span className="text-red-500">*</span></Label>
                                <select
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
                                <Label>Date of Birth <span className="text-red-500">*</span></Label>
                                <Input type="date" value={formData.date_of_birth || ''} onChange={e => updateForm('date_of_birth', e.target.value)} />
                            </div>
                            <div className="space-y-2 md:col-span-2 mt-2">
                                <Label>Update Photo</Label>
                                <div className="flex items-center gap-4 mt-2">
                                    {formData.photo_url && !photoFile && (
                                        <img src={formData.photo_url} alt="Current photo" className="w-12 h-12 rounded-full object-cover border shadow-sm" />
                                    )}
                                    <Input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] || null)} className="max-w-xs" />
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
                                <Label>Class <span className="text-red-500">*</span></Label>
                                <select
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
                                <Label>Section</Label>
                                <select
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
                                <Label>Admission No. <span className="text-red-500">*</span></Label>
                                <Input value={formData.admission_number || ''} onChange={e => updateForm('admission_number', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Roll Number</Label>
                                <Input value={formData.roll_number || ''} onChange={e => updateForm('roll_number', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Date of Joining <span className="text-red-500">*</span></Label>
                                <Input type="date" value={formData.date_of_joining || ''} onChange={e => updateForm('date_of_joining', e.target.value)} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Parent & Contact Info</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Parent / Guardian Name</Label>
                                <Input value={formData.parent_name || ''} onChange={e => updateForm('parent_name', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Residential Address</Label>
                                <Input value={formData.address || ''} onChange={e => updateForm('address', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Contact Number</Label>
                                <Input value={formData.parent_contact || ''} onChange={e => updateForm('parent_contact', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Email Address</Label>
                                <Input type="email" value={formData.parent_email || ''} onChange={e => updateForm('parent_email', e.target.value)} />
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
