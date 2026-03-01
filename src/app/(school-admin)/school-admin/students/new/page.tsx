'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
        class_id: '', section_id: '', admission_number: '', roll_number: '', date_of_joining: new Date().toISOString().split('T')[0] || '',
        parent_name: '', parent_contact: '', parent_email: '', address: '',
        blood_group: '', medical_conditions: ''
    })

    useEffect(() => {
        if (school?.id) {
            loadHierarchy()
        }
    }, [school?.id])

    async function loadHierarchy() {
        try {
            const res = await getClassesAndSections(school!.id)
            setClasses(res.classes || [])
            setSections(res.sections || [])
        } catch (e: any) {
            toast.error("Failed to load classes: " + e.message)
        }
    }

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
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href={"/school-admin/students" as any}>
                    <Button variant="outline" size="icon">
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
                                <Label>First Name <span className="text-red-500">*</span></Label>
                                <Input value={formData.first_name} onChange={e => updateForm('first_name', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Middle Name</Label>
                                <Input value={formData.middle_name} onChange={e => updateForm('middle_name', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Last Name</Label>
                                <Input value={formData.last_name} onChange={e => updateForm('last_name', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Gender <span className="text-red-500">*</span></Label>
                                <select
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
                                <Label>Date of Birth <span className="text-red-500">*</span></Label>
                                <Input type="date" value={formData.date_of_birth} onChange={e => updateForm('date_of_birth', e.target.value)} />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label>Student Photo (Optional)</Label>
                                <Input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files?.[0] || null)} />
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Class <span className="text-red-500">*</span></Label>
                                <select
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
                                <Label>Section</Label>
                                <select
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
                                <Label>Admission No. <span className="text-red-500">*</span></Label>
                                <Input value={formData.admission_number} onChange={e => updateForm('admission_number', e.target.value)} placeholder="e.g. ADM-2024-001" />
                            </div>
                            <div className="space-y-2">
                                <Label>Roll Number</Label>
                                <Input value={formData.roll_number} onChange={e => updateForm('roll_number', e.target.value)} placeholder="e.g. 42" />
                            </div>
                            <div className="space-y-2">
                                <Label>Date of Joining <span className="text-red-500">*</span></Label>
                                <Input type="date" value={formData.date_of_joining} onChange={e => updateForm('date_of_joining', e.target.value)} />
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Parent / Guardian Name</Label>
                                <Input value={formData.parent_name} onChange={e => updateForm('parent_name', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Contact Number</Label>
                                    <Input value={formData.parent_contact} onChange={e => updateForm('parent_contact', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email Address</Label>
                                    <Input type="email" value={formData.parent_email} onChange={e => updateForm('parent_email', e.target.value)} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Residential Address</Label>
                                <Input value={formData.address} onChange={e => updateForm('address', e.target.value)} />
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Blood Group</Label>
                                    <select
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
                                <Label>Medical Conditions / Notes</Label>
                                <textarea
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
