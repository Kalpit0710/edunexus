'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Save, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { getExamById, getExamSubjects, saveExamMarks, type MarkEntryInput } from '../../actions'
import { getStudents } from '../../../students/actions'
import { createClient } from '@/lib/supabase/client'
import { canEnterMarks, calculatePercentage, resolveGradeFromRules, type ExamStatus, type GradingRule } from '@/lib/exam-utils'
import { getGradingRules } from '../../../settings/actions'

export default function ExamMarksPage() {
    const params = useParams()
    const examId = params.examId as string
    const { school } = useAuthStore()

    const [exam, setExam] = useState<any>(null)
    const [subjects, setSubjects] = useState<any[]>([])
    const [students, setStudents] = useState<any[]>([])
    const [gradingRules, setGradingRules] = useState<GradingRule[]>([])

    const [selectedSubjectId, setSelectedSubjectId] = useState<string>('')
    const [marksData, setMarksData] = useState<Record<string, MarkEntryInput>>({})

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (school?.id && examId) {
            loadInitialData()
        }
    }, [school?.id, examId])

    async function loadInitialData() {
        if (!school?.id) return
        setLoading(true)
        try {
            const [exRaw, subs, studs, rules] = await Promise.all([
                getExamById(school.id, examId),
                getExamSubjects(school.id, examId),
                getStudents(school.id),
                getGradingRules(school.id)
            ])
            const ex: any = exRaw;
            setExam(ex)
            setSubjects(subs || [])
            setGradingRules(rules || [])

            // Filter students to only those in the exam's class
            const examClassId = (ex as any)?.class_id
            const classStuds = Array.isArray(studs) ? (studs as any[]).filter((s: any) => s.class_id === examClassId) : []
            setStudents(classStuds)

            if (subs && subs.length > 0) {
                setSelectedSubjectId(subs[0].id)
                await loadMarksForSubject(subs[0].id, classStuds)
            }
        } catch (e: any) {
            toast.error("Failed to load exam data: " + e.message)
        } finally {
            setLoading(false)
        }
    }

    async function loadMarksForSubject(subjectId: string, classStudents: any[]) {
        if (!school?.id) return
        try {
            const supabase = createClient()
            const { data: fetchedMarks, error } = await supabase
                .from('marks')
                .select('*')
                .eq('school_id', school.id)
                .eq('exam_id', examId)
                .eq('exam_subject_id', subjectId)

            if (error) throw error
            const marksList = (fetchedMarks || []) as any[];

            const initialMarks: Record<string, MarkEntryInput> = {}
            classStudents.forEach(stud => {
                const existingMark = marksList.find((m: any) => m.student_id === stud.id)
                initialMarks[stud.id] = {
                    studentId: stud.id,
                    marksObtained: existingMark?.marks_obtained ?? null,
                    isAbsent: existingMark?.is_absent ?? false
                }
            })
            setMarksData(initialMarks)
        } catch (e: any) {
            toast.error("Failed to load existing marks: " + e.message)

            // Initialize blank on error
            const blankMarks: Record<string, MarkEntryInput> = {}
            classStudents.forEach(stud => {
                blankMarks[stud.id] = { studentId: stud.id, marksObtained: null, isAbsent: false }
            })
            setMarksData(blankMarks)
        }
    }

    const handleSubjectChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const subId = e.target.value
        setSelectedSubjectId(subId)
        await loadMarksForSubject(subId, students)
    }

    const updateMark = (studentId: string | undefined, val: string) => {
        if (!studentId) return;
        const num = val === '' ? null : Number(val)
        setMarksData(prev => ({
            ...prev,
            [studentId]: {
                studentId,
                ...prev[studentId],
                marksObtained: num
            }
        }))
    }

    const toggleAbsent = (studentId: string | undefined) => {
        if (!studentId) return;
        setMarksData(prev => ({
            ...prev,
            [studentId]: {
                studentId,
                ...prev[studentId],
                isAbsent: !(prev[studentId]?.isAbsent),
                marksObtained: !(prev[studentId]?.isAbsent) ? null : prev[studentId]?.marksObtained // clear marks if absent
            }
        }))
    }

    const handleSave = async () => {
        if (!school?.id || !exam || !selectedSubjectId) return
        setSaving(true)
        try {
            const payload = Object.values(marksData).filter(m => m.studentId) as MarkEntryInput[]
            await saveExamMarks(school.id, examId, selectedSubjectId, payload)
            toast.success("Marks saved successfully!")
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading marks entry...</div>
    }

    if (!exam) return null

    const selectedSubject = subjects.find(s => s.id === selectedSubjectId)
    const isEditingAllowed = canEnterMarks(exam.status as ExamStatus)

    // Compute live grade for preview
    const getPreviewGrade = (marksObtained: number | null, isAbsent: boolean) => {
        if (isAbsent) return 'AB'
        if (marksObtained === null || !selectedSubject?.max_marks) return '-'
        const percentage = calculatePercentage(marksObtained, selectedSubject.max_marks)
        return resolveGradeFromRules(percentage, gradingRules) || '-'
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href={"/school-admin/exams" as any}>
                        <Button variant="outline" size="icon">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </Link>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Marks Entry: {exam.name}</h2>
                        <p className="text-muted-foreground">Status: <span className="font-semibold capitalize">{exam.status}</span></p>
                    </div>
                </div>
                {isEditingAllowed && (
                    <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-soft">
                        {saving ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save Marks</>}
                    </Button>
                )}
            </div>

            {!isEditingAllowed && (
                <div className="bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm font-medium">Marks entry is disabled. Exam status must be Published or Ongoing to enter marks.</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-1 space-y-4">
                    <Card className="shadow-soft sticky top-6">
                        <CardHeader>
                            <CardTitle className="text-lg">Select Subject</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <select
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    value={selectedSubjectId}
                                    onChange={handleSubjectChange}
                                >
                                    {subjects.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.subjects?.name} {s.subjects?.code ? `(${s.subjects.code})` : ''}
                                        </option>
                                    ))}
                                </select>

                                {selectedSubject && (
                                    <div className="bg-muted/50 p-4 rounded-lg text-sm space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Max Marks:</span>
                                            <span className="font-semibold">{selectedSubject.max_marks}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Pass Marks:</span>
                                            <span className="font-semibold">{selectedSubject.pass_marks}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="md:col-span-3">
                    <Card className="shadow-soft">
                        <CardContent className="p-0">
                            {students.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground">
                                    No students found in this class.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                                            <tr>
                                                <th className="px-6 py-4 font-medium">Roll No</th>
                                                <th className="px-6 py-4 font-medium">Student Name</th>
                                                <th className="px-6 py-4 font-medium w-32">Absent</th>
                                                <th className="px-6 py-4 font-medium w-32">Marks</th>
                                                <th className="px-6 py-4 font-medium w-24 text-center">Grade</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {students.map(stud => {
                                                const rowData = marksData[stud.id]
                                                if (!rowData) return null

                                                return (
                                                    <tr key={stud.id} className="hover:bg-muted/10 transition-colors">
                                                        <td className="px-6 py-3 font-medium text-muted-foreground">
                                                            {stud.roll_number || '-'}
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <div className="font-semibold text-foreground">{stud.full_name}</div>
                                                            <div className="text-xs text-muted-foreground">{stud.admission_number}</div>
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <div className="flex items-center h-full">
                                                                <input
                                                                    type="checkbox"
                                                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                                    checked={rowData.isAbsent}
                                                                    onChange={() => toggleAbsent(stud.id)}
                                                                    disabled={!isEditingAllowed}
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                max={selectedSubject?.max_marks}
                                                                className={`h-9 w-24 ${rowData.isAbsent ? 'opacity-50' : ''}`}
                                                                value={rowData.marksObtained ?? ''}
                                                                onChange={(e) => updateMark(stud.id, e.target.value)}
                                                                disabled={!isEditingAllowed || rowData.isAbsent}
                                                                placeholder="-"
                                                            />
                                                        </td>
                                                        <td className="px-6 py-3 text-center">
                                                            <span className="inline-flex items-center justify-center px-2 py-1 rounded-md text-sm font-bold bg-muted text-muted-foreground min-w-[2.5rem]">
                                                                {getPreviewGrade(rowData.marksObtained ?? null, rowData.isAbsent ?? false)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
