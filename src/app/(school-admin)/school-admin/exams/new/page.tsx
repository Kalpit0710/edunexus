'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { ArrowLeft, ChevronRight, ChevronLeft, Save, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { createExam, type CreateExamInput, type ExamSubjectInput } from '../actions'
import { getClasses, getAcademicYears, getSubjects } from '../../settings/actions'

export default function NewExamPage() {
    const router = useRouter()
    const { school } = useAuthStore()

    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [pageLoad, setPageLoad] = useState(true)

    const [classes, setClasses] = useState<any[]>([])
    const [academicYears, setAcademicYears] = useState<any[]>([])
    const [allSubjects, setAllSubjects] = useState<any[]>([])

    const [formData, setFormData] = useState<{
        name: string,
        classId: string,
        academicYearId: string,
        startDate: string,
        endDate: string,
        subjects: ExamSubjectInput[]
    }>({
        name: '',
        classId: '',
        academicYearId: '',
        startDate: '',
        endDate: '',
        subjects: []
    })

    useEffect(() => {
        if (school?.id) {
            loadInitialData()
        }
    }, [school?.id])

    async function loadInitialData() {
        try {
            setPageLoad(true)
            const [clsData, ayData, subData] = await Promise.all([
                getClasses(school!.id),
                getAcademicYears(school!.id),
                getSubjects(school!.id)
            ])
            setClasses(clsData || [])
            setAcademicYears(ayData || [])
            setAllSubjects(subData || [])
        } catch (e: any) {
            toast.error("Failed to load necessary data: " + e.message)
        } finally {
            setPageLoad(false)
        }
    }

    const updateForm = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const addSubjectRow = () => {
        setFormData(prev => ({
            ...prev,
            subjects: [
                ...prev.subjects,
                { subjectId: '', examDate: '', startTime: '', durationMins: 120, maxMarks: 100, passMarks: 33 }
            ]
        }))
    }

    const removeSubjectRow = (index: number) => {
        setFormData(prev => {
            const newSubjects = [...prev.subjects]
            newSubjects.splice(index, 1)
            return { ...prev, subjects: newSubjects }
        })
    }

    const updateSubjectRow = (index: number, field: keyof ExamSubjectInput, value: any) => {
        setFormData(prev => {
            const newSubjects = [...prev.subjects]
            newSubjects[index] = { ...newSubjects[index], [field]: value } as ExamSubjectInput
            return { ...prev, subjects: newSubjects }
        })
    }

    const validateStep = (currentStep: number) => {
        if (currentStep === 1) {
            if (!formData.name.trim() || !formData.classId) {
                toast.error("Exam Name and Class are required.")
                return false
            }
            if (formData.startDate && formData.endDate && new Date(formData.startDate) > new Date(formData.endDate)) {
                toast.error("Start Date cannot be after End Date.")
                return false
            }
        }
        if (currentStep === 2) {
            if (formData.subjects.length === 0) {
                toast.error("Please add at least one subject.")
                return false
            }
            const subjectIds = new Set()
            for (let i = 0; i < formData.subjects.length; i++) {
                const sub = formData.subjects[i]
                if (!sub) continue;
                if (!sub.subjectId) {
                    toast.error(`Please select a subject for row ${i + 1}.`)
                    return false
                }
                if (subjectIds.has(sub.subjectId)) {
                    toast.error(`Duplicate subject found: row ${i + 1}.`)
                    return false
                }
                subjectIds.add(sub.subjectId)
                if (sub.maxMarks !== undefined && sub.maxMarks <= 0) {
                    toast.error(`Maximum marks must be greater than 0 for row ${i + 1}.`)
                    return false
                }
                if (sub.passMarks !== undefined && sub.maxMarks !== undefined && sub.passMarks > sub.maxMarks) {
                    toast.error(`Pass marks cannot be greater than max marks for row ${i + 1}.`)
                    return false
                }
            }
        }
        return true
    }

    const handleNext = () => {
        if (validateStep(step)) {
            // Auto add an empty row if moving to step 2 and it's empty
            if (step === 1 && formData.subjects.length === 0) {
                addSubjectRow()
            }
            setStep(prev => prev + 1)
        }
    }

    const handlePrev = () => {
        setStep(prev => prev - 1)
    }

    const handleSubmit = async () => {
        if (!validateStep(2)) return
        if (!school?.id) return

        setLoading(true)
        try {
            const payload: CreateExamInput = {
                classId: formData.classId,
                name: formData.name,
                academicYearId: formData.academicYearId || null,
                startDate: formData.startDate || undefined,
                endDate: formData.endDate || undefined,
                subjects: formData.subjects.map((sub: ExamSubjectInput) => ({
                    subjectId: sub?.subjectId || '',
                    examDate: sub?.examDate || undefined,
                    startTime: sub?.startTime || undefined,
                    durationMins: sub?.durationMins ? Number(sub.durationMins) : undefined,
                    maxMarks: Number(sub?.maxMarks),
                    passMarks: sub?.passMarks ? Number(sub.passMarks) : undefined,
                }))
            }

            await createExam(school.id, payload)
            toast.success("Exam created successfully!")
            router.push('/school-admin/exams' as any)
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setLoading(false)
        }
    }

    // Filter subjects to only show those for the selected class
    const availableSubjects = allSubjects.filter(s => s.class_id === formData.classId)

    if (pageLoad) {
        return <div className="p-8 text-center text-muted-foreground">Loading form...</div>
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href={"/school-admin/exams" as any}>
                    <Button variant="outline" size="icon">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Create New Exam</h2>
                    <p className="text-muted-foreground">Set up a new examination and configure its subjects.</p>
                </div>
            </div>

            <div className="flex items-center justify-between mb-8 max-w-xl mx-auto">
                {[1, 2].map(num => (
                    <div key={num} className="flex items-center w-full relative">
                        <div className={`w-8 h-8 rounded-full flex z-10 items-center justify-center text-sm font-medium ${step >= num ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground border border-border'}`}>
                            {num}
                        </div>
                        {num < 2 && (
                            <div className={`absolute top-1/2 left-8 right-0 h-1 -translate-y-1/2 ${step > num ? 'bg-primary' : 'bg-muted'}`} />
                        )}
                    </div>
                ))}
            </div>

            <Card className="shadow-soft">
                <CardHeader>
                    <CardTitle>
                        {step === 1 && "Exam Details"}
                        {step === 2 && "Exam Subjects"}
                    </CardTitle>
                    <CardDescription>
                        {step === 1 && "Basic information about the examination."}
                        {step === 2 && "Add subjects, schedule, and marking rules."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">

                    {step === 1 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2 md:col-span-2">
                                <Label>Exam Name <span className="text-destructive">*</span></Label>
                                <Input
                                    placeholder="e.g. Mid-Term Examination 2026"
                                    value={formData.name}
                                    onChange={e => updateForm('name', e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Class <span className="text-destructive">*</span></Label>
                                <select
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={formData.classId}
                                    onChange={e => {
                                        updateForm('classId', e.target.value)
                                        // Reset subjects when class changes since available subjects change
                                        updateForm('subjects', [])
                                    }}
                                >
                                    <option value="" disabled>Select Class</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label>Academic Year (Optional)</Label>
                                <select
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={formData.academicYearId}
                                    onChange={e => updateForm('academicYearId', e.target.value)}
                                >
                                    <option value="">None / Default</option>
                                    {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label>Start Date (Optional)</Label>
                                <Input
                                    type="date"
                                    value={formData.startDate}
                                    onChange={e => updateForm('startDate', e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>End Date (Optional)</Label>
                                <Input
                                    type="date"
                                    value={formData.endDate}
                                    onChange={e => updateForm('endDate', e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            {formData.subjects.length === 0 ? (
                                <div className="text-center py-8 bg-muted/30 rounded-lg border border-dashed">
                                    <p className="text-muted-foreground mb-4">No subjects added yet.</p>
                                    <Button onClick={addSubjectRow} variant="outline">
                                        <Plus className="w-4 h-4 mr-2" /> Add First Subject
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {formData.subjects.map((sub, index) => (
                                        <div key={index} className="p-4 border rounded-lg bg-card shadow-sm space-y-4 relative">
                                            <div className="absolute right-2 top-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                    onClick={() => removeSubjectRow(index)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pr-8">
                                                <div className="space-y-2 md:col-span-1">
                                                    <Label>Subject <span className="text-destructive">*</span></Label>
                                                    <select
                                                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                                        value={sub.subjectId}
                                                        onChange={e => updateSubjectRow(index, 'subjectId', e.target.value)}
                                                    >
                                                        <option value="" disabled>Select subject</option>
                                                        {availableSubjects.map(s => <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>)}
                                                    </select>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label>Exam Date</Label>
                                                    <Input
                                                        type="date"
                                                        className="h-9"
                                                        value={sub.examDate || ''}
                                                        onChange={e => updateSubjectRow(index, 'examDate', e.target.value)}
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <Label>Start Time</Label>
                                                    <Input
                                                        type="time"
                                                        className="h-9"
                                                        value={sub.startTime || ''}
                                                        onChange={e => updateSubjectRow(index, 'startTime', e.target.value)}
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <Label>Duration (mins)</Label>
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        className="h-9"
                                                        value={sub.durationMins || ''}
                                                        onChange={e => updateSubjectRow(index, 'durationMins', e.target.value)}
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <Label>Max Marks <span className="text-destructive">*</span></Label>
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        className="h-9"
                                                        value={sub.maxMarks}
                                                        onChange={e => updateSubjectRow(index, 'maxMarks', e.target.value)}
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <Label>Pass Marks</Label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        className="h-9"
                                                        value={sub.passMarks || ''}
                                                        onChange={e => updateSubjectRow(index, 'passMarks', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    <Button onClick={addSubjectRow} variant="outline" className="w-full border-dashed">
                                        <Plus className="w-4 h-4 mr-2" /> Add Another Subject
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                </CardContent>
                <CardFooter className="flex justify-between border-t pt-6">
                    <Button variant="outline" onClick={handlePrev} disabled={step === 1}>
                        <ChevronLeft className="w-4 h-4 mr-2" /> Back
                    </Button>

                    {step < 2 ? (
                        <Button onClick={handleNext}>
                            Next <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-soft">
                            {loading ? "Creating..." : <><Save className="w-4 h-4 mr-2" /> Create Exam</>}
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    )
}
