'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { ChevronRight, ChevronLeft, Save, Plus, Trash2 } from 'lucide-react'
import { completeOnboarding, uploadSchoolLogo, type OnboardingData } from './actions'

export default function OnboardingWizardPage() {
    const router = useRouter()
    const { school } = useAuthStore()

    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)

    // Step 1
    const [address, setAddress] = useState('')
    const [themeColor, setThemeColor] = useState('#0f172a')
    const [photoFile, setPhotoFile] = useState<File | null>(null)

    // Step 2
    const [ayName, setAyName] = useState('2024-2025')
    const [ayStart, setAyStart] = useState('')
    const [ayEnd, setAyEnd] = useState('')

    // Step 3
    const predefinedClasses = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10']
    const [classesStr, setClassesStr] = useState(predefinedClasses.join(', '))
    const [sectionsStr, setSectionsStr] = useState('A, B')

    // Step 4
    const defaultGradingRules = [
        { grade_name: 'A+', min_marks: 90, max_marks: 100, grade_point: 4.0 },
        { grade_name: 'A', min_marks: 80, max_marks: 89, grade_point: 3.5 },
        { grade_name: 'B', min_marks: 70, max_marks: 79, grade_point: 3.0 },
        { grade_name: 'C', min_marks: 60, max_marks: 69, grade_point: 2.5 },
        { grade_name: 'D', min_marks: 50, max_marks: 59, grade_point: 2.0 },
        { grade_name: 'F', min_marks: 0, max_marks: 49, grade_point: 0.0 }
    ]
    const [gradingRules, setGradingRules] = useState(defaultGradingRules)

    const updateGradingRule = (index: number, field: string, value: string | number) => {
        const newRules = [...gradingRules]
        // @ts-expect-error
        newRules[index][field] = value
        setGradingRules(newRules)
    }

    const removeGradingRule = (index: number) => {
        setGradingRules(gradingRules.filter((_, i) => i !== index))
    }

    const addGradingRule = () => {
        setGradingRules([...gradingRules, { grade_name: 'NEW', min_marks: 0, max_marks: 10, grade_point: 0.0 }])
    }

    const validateStep = (currentStep: number) => {
        if (currentStep === 1) {
            // Address is optional, Theme color is provided. Logo is optional.
        }
        if (currentStep === 2) {
            if (!ayName || !ayStart || !ayEnd) {
                toast.error("Please fill in Academic Year details.")
                return false
            }
            if (new Date(ayStart) > new Date(ayEnd)) {
                toast.error("Start date must be before end date.")
                return false
            }
        }
        if (currentStep === 3) {
            if (!classesStr) {
                toast.error("Please specify at least one class.")
                return false
            }
        }
        if (currentStep === 4) {
            if (gradingRules.length === 0) {
                toast.error("Please define at least one grading rule.")
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
            // Upload logo if provided
            if (photoFile) {
                const fd = new FormData()
                fd.append('file', photoFile)
                fd.append('schoolId', school.id)
                await uploadSchoolLogo(fd)
            }

            const parsedClasses = classesStr.split(',').map(s => s.trim()).filter(Boolean)
            const parsedSections = sectionsStr.split(',').map(s => s.trim()).filter(Boolean)

            const classesPayload = parsedClasses.map(c => ({
                name: c,
                sections: parsedSections
            }))

            const payload: OnboardingData = {
                profile: {
                    address,
                    theme_color: themeColor
                },
                academicYear: {
                    name: ayName,
                    start_date: ayStart,
                    end_date: ayEnd
                },
                classes: classesPayload,
                gradingRules: gradingRules.map(r => ({
                    ...r,
                    min_marks: Number(r.min_marks),
                    max_marks: Number(r.max_marks),
                    grade_point: Number(r.grade_point)
                }))
            }

            await completeOnboarding(school.id, payload)
            toast.success("School setup completed successfully!")
            router.push('/school-admin/dashboard')
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setLoading(false)
        }
    }

    const stepTitles = ["School Identity", "Academic Year", "Classes & Sections", "Grading Rules"]
    const stepDesc = [
        "Customize your school's presence.",
        "Set up the active school year.",
        "Quickly generate your organizational structure.",
        "Define evaluation metrics for the school."
    ]

    return (
        <div className="max-w-4xl mx-auto space-y-6 pt-6">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold tracking-tight">Welcome to EduNexus</h2>
                <p className="text-muted-foreground mt-2 text-lg">Let's get your school off the ground in 4 easy steps.</p>
            </div>

            <div className="flex items-center justify-between mb-8 max-w-2xl mx-auto">
                {[1, 2, 3, 4].map(num => (
                    <div key={num} className="flex items-center w-full">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors duration-300 ${step >= num ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground shadow-sm'}`}>
                            {num}
                        </div>
                        {num < 4 && (
                            <div className={`h-1 mx-2 flex-1 rounded transition-colors duration-300 ${step > num ? 'bg-primary' : 'bg-muted'}`} />
                        )}
                    </div>
                ))}
            </div>

            <Card className="border-t-4 border-t-primary shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
                <CardHeader className="bg-muted/30">
                    <CardTitle className="text-2xl">{stepTitles[step - 1]}</CardTitle>
                    <CardDescription className="text-base">{stepDesc[step - 1]}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">

                    {step === 1 && (
                        <div className="grid grid-cols-1 gap-6">
                            <div className="space-y-2">
                                <Label className="text-lg">School Address</Label>
                                <Input
                                    value={address}
                                    onChange={e => setAddress(e.target.value)}
                                    placeholder="123 Education Lane, City, State"
                                    className="h-12"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-lg">Theme Color</Label>
                                    <div className="flex gap-4 items-center">
                                        <Input
                                            type="color"
                                            value={themeColor}
                                            onChange={e => setThemeColor(e.target.value)}
                                            className="w-16 h-12 p-1 cursor-pointer"
                                        />
                                        <div className="text-muted-foreground">{themeColor}</div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-lg">School Logo</Label>
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={e => setPhotoFile(e.target.files?.[0] || null)}
                                        className="h-12 file:h-full file:bg-muted file:border-0 file:mr-4 file:px-4 file:rounded-md hover:file:bg-muted/80 cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label className="text-lg">Academic Year Name</Label>
                                <Input value={ayName} onChange={e => setAyName(e.target.value)} placeholder="e.g. 2024-2025" className="h-12" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-lg">Start Date</Label>
                                <Input type="date" value={ayStart} onChange={e => setAyStart(e.target.value)} className="h-12" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-lg">End Date</Label>
                                <Input type="date" value={ayEnd} onChange={e => setAyEnd(e.target.value)} className="h-12" />
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 p-4 rounded-md border border-blue-200 dark:border-blue-800">
                                This will automatically generate a matrix of Classes and Sections. You can always add or remove them later in Settings.
                            </div>
                            <div className="space-y-2">
                                <Label className="text-lg">Classes (Comma Separated)</Label>
                                <textarea
                                    className="flex w-full rounded-md border border-input bg-background px-4 py-3 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[120px]"
                                    value={classesStr}
                                    onChange={e => setClassesStr(e.target.value)}
                                    placeholder="e.g. Nursery, KG, Grade 1, Grade 2"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-lg">Sections per Class (Comma Separated)</Label>
                                <Input
                                    value={sectionsStr}
                                    onChange={e => setSectionsStr(e.target.value)}
                                    placeholder="e.g. A, B, C"
                                    className="h-12"
                                />
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-4">
                            <div className="bg-muted p-4 rounded-md flex justify-between items-center">
                                <div>Configure how percentage grades map to letter grades and points.</div>
                                <Button variant="outline" size="sm" onClick={addGradingRule}>
                                    <Plus className="w-4 h-4 mr-2" /> Add Rule
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {gradingRules.map((rule, idx) => (
                                    <div key={idx} className="flex gap-4 items-end animate-in fade-in zoom-in duration-300">
                                        <div className="space-y-1 flex-1">
                                            <Label className="text-xs">Grade</Label>
                                            <Input value={rule.grade_name} onChange={e => updateGradingRule(idx, 'grade_name', e.target.value)} />
                                        </div>
                                        <div className="space-y-1 flex-1">
                                            <Label className="text-xs">Min %</Label>
                                            <Input type="number" value={rule.min_marks} onChange={e => updateGradingRule(idx, 'min_marks', e.target.value)} />
                                        </div>
                                        <div className="space-y-1 flex-1">
                                            <Label className="text-xs">Max %</Label>
                                            <Input type="number" value={rule.max_marks} onChange={e => updateGradingRule(idx, 'max_marks', e.target.value)} />
                                        </div>
                                        <div className="space-y-1 flex-1">
                                            <Label className="text-xs">Points</Label>
                                            <Input type="number" step="0.1" value={rule.grade_point} onChange={e => updateGradingRule(idx, 'grade_point', e.target.value)} />
                                        </div>
                                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-white hover:bg-red-500 rounded-md" onClick={() => removeGradingRule(idx)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </CardContent>
                <CardFooter className="flex justify-between border-t bg-muted/10 p-6">
                    <Button variant="outline" size="lg" onClick={handlePrev} disabled={step === 1} className="w-32">
                        <ChevronLeft className="w-4 h-4 mr-2" /> Back
                    </Button>

                    {step < 4 ? (
                        <Button size="lg" onClick={handleNext} className="w-32">
                            Next <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                    ) : (
                        <Button size="lg" onClick={handleSubmit} disabled={loading} className="w-40 bg-green-600 hover:bg-green-700 text-white shadow-md">
                            {loading ? "Completing..." : <><Save className="w-4 h-4 mr-2" /> Finish Setup</>}
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    )
}
