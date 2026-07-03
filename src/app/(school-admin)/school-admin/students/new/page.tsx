'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/utils'
import { schoolToday } from '@/lib/date-utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { ArrowLeft, ChevronRight, ChevronLeft, Save } from 'lucide-react'
import Link from 'next/link'
import { createStudent, getClassesAndSections, uploadStudentPhoto } from './actions'

type StudentFormData = {
    // Step 1: Personal
    first_name: string
    middle_name: string
    last_name: string
    gender: string
    date_of_birth: string
    // Step 2: Academic
    class_id: string
    section_id: string
    admission_number: string
    roll_number: string
    date_of_joining: string
    // Step 3: Contacts
    parent_name: string
    parent_contact: string
    parent_email: string
    address: string
    // Step 4: Medical/Other
    blood_group: string
    medical_conditions: string
}

export default function NewStudentPage() {
    const router = useRouter()
    const { school } = useAuthStore()

    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)

    const [classes, setClasses] = useState<any[]>([])
    const [sections, setSections] = useState<any[]>([])
    const [photoFile, setPhotoFile] = useState<File | null>(null)

    const [formData, setFormData] = useState<StudentFormData>({
        first_name: '', middle_name: '', last_name: '', gender: '', date_of_birth: '',
        class_id: '', section_id: '', admission_number: '', roll_number: '', date_of_joining: schoolToday(),
        parent_name: '', parent_contact: '', parent_email: '', address: '',
        blood_group: '', medical_conditions: ''
    })

    const loadHierarchy = useCallback(async () => {
        if (!school?.id) return
        try {
            const res = await getClassesAndSections(school.id)
            setClasses(res.classes || [])
            setSections(res.sections || [])
        } catch (e) {
            toast.error("Failed to load classes: " + getErrorMessage(e))
        }
    }, [school?.id])

    useEffect(() => {
        if (school?.id) {
            loadHierarchy()
        }
    }, [loadHierarchy, school?.id])

    const updateForm = (field: keyof StudentFormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const availableSections = sections.filter(s => s.class_id === formData.class_id)

    const validateStep = (currentStep: number) => {
        if (currentStep === 1) {
            if (!formData.first_name || !formData.date_of_birth || !formData.gender) {
                toast.error("Please fill required personal details (Name, DOB, Gender).")
                return false
            }
        }
        if (currentStep === 2) {
            if (!formData.class_id || !formData.admission_number || !formData.date_of_joining) {
                toast.error("Please fill required academic details (Class, Admission No, Date).")
                return false
            }
        }
        return true
    }

    const handleNext = () => {
        if (validateStep(step)) {
            setStep(prev => prev + 1)
        }
    }

    const handlePrev = () => {
        setStep(prev => prev - 1)
    }

    const handleSubmit = async () => {
        if (!school?.id) return
        setLoading(true)
        try {
            let photoUrl = ''
            if (photoFile) {
                const fd = new FormData()
                fd.append('file', photoFile)
                fd.append('schoolId', school.id)
                photoUrl = await uploadStudentPhoto(fd)
            }
            await createStudent(school.id, { ...formData, photo_url: photoUrl })
            toast.success("Student added successfully!")
            router.push('/school-admin/students')
        } catch (e) {
            toast.error(getErrorMessage(e))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href={"/school-admin/students" as any}>
                    <Button variant="outline" size="icon" aria-label="Go back">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Add New Student</h2>
                    <p className="text-muted-foreground">Register a new student into the system.</p>
                </div>
            </div>

            <div className="flex items-center justify-between mb-8">
                {[1, 2, 3, 4].map(num => (
                    <div key={num} className="flex items-center w-full">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= num ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                            {num}
                        </div>
                        {num < 4 && (
                            <div className={`h-1 mx-2 flex-1 rounded ${step > num ? 'bg-primary' : 'bg-muted'}`} />
                        )}
                    </div>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>
                        {step === 1 && "Personal Details"}
                        {step === 2 && "Academic Information"}
                        {step === 3 && "Parent & Contact Info"}
                        {step === 4 && "Medical & Additional Info"}
                    </CardTitle>
                    <CardDescription>
                        {step === 1 && "Basic identification data."}
                        {step === 2 && "Class assignment and enrollment details."}
                        {step === 3 && "Emergency contacts and residence."}
                        {step === 4 && "Health records and extra notes."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">

                    {step === 1 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="first_name">First Name <span className="text-red-500">*</span></Label>
                                <Input id="first_name" value={formData.first_name} onChange={e => updateForm('first_name', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="middle_name">Middle Name</Label>
                                <Input id="middle_name" value={formData.middle_name} onChange={e => updateForm('middle_name', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="last_name">Last Name</Label>
                                <Input id="last_name" value={formData.last_name} onChange={e => updateForm('last_name', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="gender">Gender <span className="text-red-500">*</span></Label>
                                <select
                                    id="gender"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={formData.gender}
                                    onChange={e => updateForm('gender', e.target.value)}
                                >
                                    <option value="" disabled>Select gender</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="date_of_birth">Date of Birth <span className="text-red-500">*</span></Label>
                                <DateInput id="date_of_birth" value={formData.date_of_birth} onChange={e => updateForm('date_of_birth', e.target.value)} />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="student_photo">Student Photo (Optional)</Label>
                                <Input id="student_photo" type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] || null)} />
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="class_id">Class <span className="text-red-500">*</span></Label>
                                <select
                                    id="class_id"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={formData.class_id}
                                    onChange={e => {
                                        updateForm('class_id', e.target.value)
                                        updateForm('section_id', '') // reset section when class changes
                                    }}
                                >
                                    <option value="" disabled>Select Class</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="section_id">Section</Label>
                                <select
                                    id="section_id"
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                                    value={formData.section_id}
                                    onChange={e => updateForm('section_id', e.target.value)}
                                    disabled={!formData.class_id}
                                >
                                    <option value="">No Section</option>
                                    {availableSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="admission_number">Admission No. <span className="text-red-500">*</span></Label>
                                <Input id="admission_number" value={formData.admission_number} onChange={e => updateForm('admission_number', e.target.value)} placeholder="e.g. ADM-2024-001" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="roll_number">Roll Number</Label>
                                <Input id="roll_number" value={formData.roll_number} onChange={e => updateForm('roll_number', e.target.value)} placeholder="e.g. 42" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="date_of_joining">Date of Joining <span className="text-red-500">*</span></Label>
                                <DateInput id="date_of_joining" value={formData.date_of_joining} onChange={e => updateForm('date_of_joining', e.target.value)} />
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="parent_name">Parent / Guardian Name</Label>
                                <Input id="parent_name" value={formData.parent_name} onChange={e => updateForm('parent_name', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="parent_contact">Contact Number</Label>
                                    <Input id="parent_contact" value={formData.parent_contact} onChange={e => updateForm('parent_contact', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="parent_email">Email Address</Label>
                                    <Input id="parent_email" type="email" value={formData.parent_email} onChange={e => updateForm('parent_email', e.target.value)} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="address">Residential Address</Label>
                                <Input id="address" value={formData.address} onChange={e => updateForm('address', e.target.value)} />
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="blood_group">Blood Group</Label>
                                    <select
                                        id="blood_group"
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={formData.blood_group}
                                        onChange={e => updateForm('blood_group', e.target.value)}
                                    >
                                        <option value="">Unknown</option>
                                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                                            <option key={bg} value={bg}>{bg}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="medical_conditions">Medical Conditions / Notes</Label>
                                <textarea
                                    id="medical_conditions"
                                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px]"
                                    value={formData.medical_conditions}
                                    onChange={e => updateForm('medical_conditions', e.target.value)}
                                    placeholder="List any allergies, illnesses..."
                                />
                            </div>
                        </div>
                    )}

                </CardContent>
                <CardFooter className="flex justify-between border-t pt-6">
                    <Button variant="outline" onClick={handlePrev} disabled={step === 1}>
                        <ChevronLeft className="w-4 h-4 mr-2" /> Back
                    </Button>

                    {step < 4 ? (
                        <Button onClick={handleNext}>
                            Next <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white">
                            {loading ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Student</>}
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    )
}
