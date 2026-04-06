'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, BarChart3, Trophy, FileText, Download, User } from 'lucide-react'
import Link from 'next/link'
import {
    getExamById,
    getClassPerformanceReport,
    getTopperList,
    getStudentReportCardData
} from '../../actions'
import { getStudents } from '../../../students/actions'
import * as xlsx from 'xlsx'

export default function ExamReportsPage() {
    const params = useParams()
    const examId = params.examId as string
    const { school } = useAuthStore()

    const [loading, setLoading] = useState(true)
    const [exam, setExam] = useState<any>(null)
    const [performance, setPerformance] = useState<any[]>([])
    const [toppers, setToppers] = useState<any[]>([])
    const [students, setStudents] = useState<any[]>([])

    // Report Card State
    const [selectedStudentId, setSelectedStudentId] = useState<string>('')
    const [reportCardData, setReportCardData] = useState<any>(null)
    const [reportLoading, setReportLoading] = useState(false)

    useEffect(() => {
        if (school?.id && examId) {
            loadInitialData()
        }
    }, [school?.id, examId])

    async function loadInitialData() {
        if (!school?.id) return
        setLoading(true)
        try {
            const exRaw = await getExamById(school.id, examId); // Fetch exam details first
            const ex: any = exRaw;
            setExam(ex); // Set exam details

            // Now load reports
            const [perf, topList, studs] = await Promise.all([
                getClassPerformanceReport(school.id, examId),
                getTopperList(school.id, examId, 10),
                getStudents(school.id)
            ])

            setPerformance(perf || [])
            setToppers(topList || [])

            const examClassId = (ex as any)?.class_id
            const classStuds = Array.isArray(studs) ? (studs as any[]).filter((s: any) => s.class_id === examClassId) : []
            setStudents(classStuds)

        } catch (e: any) {
            toast.error("Failed to load reports: " + e.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleStudentSelect(studentId: string) {
        setSelectedStudentId(studentId)
        if (!studentId || !school?.id) {
            setReportCardData(null)
            return
        }

        setReportLoading(true)
        try {
            const data = await getStudentReportCardData(school.id, examId, studentId)
            setReportCardData(data)
        } catch (e: any) {
            toast.error("Failed to load report card: " + e.message)
            setReportCardData(null)
        } finally {
            setReportLoading(false)
        }
    }

    const exportPerformance = () => {
        if (!performance.length) return
        const exportData = performance.map(p => ({
            'Subject': p.subjectName,
            'Code': p.subjectCode || '',
            'Total Students': p.studentCount,
            'Present': p.studentCount - p.absentCount,
            'Absent': p.absentCount,
            'Average Marks': p.averageMarks,
            'Pass': p.passCount,
            'Fail': p.failCount,
        }))
        const ws = xlsx.utils.json_to_sheet(exportData)
        const wb = xlsx.utils.book_new()
        xlsx.utils.book_append_sheet(wb, ws, 'Performance')
        xlsx.writeFile(wb, `${exam?.name || 'exam'}_performance.xlsx`)
    }

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading reports...</div>
    }

    if (!exam) return null

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href={"/school-admin/exams" as any}>
                    <Button variant="outline" size="icon">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Exam Reports: {exam.name}</h2>
                    <p className="text-muted-foreground">View class performance, top rankers, and individual report cards.</p>
                </div>
            </div>

            <Tabs defaultValue="performance" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="performance" className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" /> Class Performance
                    </TabsTrigger>
                    <TabsTrigger value="toppers" className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-500" /> Rank Holders
                    </TabsTrigger>
                    <TabsTrigger value="report-cards" className="flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Report Cards
                    </TabsTrigger>
                </TabsList>

                {/* Class Performance Tab */}
                <TabsContent value="performance">
                    <Card className="shadow-soft">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <div>
                                <CardTitle>Subject-wise Performance</CardTitle>
                            </div>
                            <Button variant="outline" size="sm" onClick={exportPerformance}>
                                <Download className="w-4 h-4 mr-2" /> Export
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto mt-4">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">Subject</th>
                                            <th className="px-4 py-3 font-medium text-center">Enrolled</th>
                                            <th className="px-4 py-3 font-medium text-center">Appeared</th>
                                            <th className="px-4 py-3 font-medium text-center">Average Marks</th>
                                            <th className="px-4 py-3 font-medium text-center text-green-600 dark:text-green-400">Pass</th>
                                            <th className="px-4 py-3 font-medium text-center text-red-600 dark:text-red-400">Fail</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {performance.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="text-center py-8 text-muted-foreground">
                                                    No performance data available.
                                                </td>
                                            </tr>
                                        ) : (
                                            performance.map(p => (
                                                <tr key={p.examSubjectId} className="hover:bg-muted/10 transition-colors">
                                                    <td className="px-4 py-3 font-medium">
                                                        {p.subjectName} {p.subjectCode ? <span className="text-muted-foreground ml-1">({p.subjectCode})</span> : ''}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">{p.studentCount}</td>
                                                    <td className="px-4 py-3 text-center">{p.studentCount - p.absentCount}</td>
                                                    <td className="px-4 py-3 text-center font-semibold">{p.averageMarks}</td>
                                                    <td className="px-4 py-3 text-center text-green-700 dark:text-green-500">{p.passCount}</td>
                                                    <td className="px-4 py-3 text-center text-red-700 dark:text-red-500">{p.failCount}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Toppers Tab */}
                <TabsContent value="toppers">
                    <Card className="shadow-soft">
                        <CardContent className="pt-6">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                                        <tr>
                                            <th className="px-4 py-3 font-medium text-center w-16">Rank</th>
                                            <th className="px-4 py-3 font-medium">Student Name</th>
                                            <th className="px-4 py-3 font-medium text-center">Adm No</th>
                                            <th className="px-4 py-3 font-medium text-center">Total Marks</th>
                                            <th className="px-4 py-3 font-medium text-center">Percentage</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {toppers.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="text-center py-8 text-muted-foreground">
                                                    No rank data available yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            toppers.map(t => (
                                                <tr key={t.studentId} className="hover:bg-muted/10 transition-colors">
                                                    <td className="px-4 py-3 text-center">
                                                        {t.rank === 1 ? <Trophy className="w-5 h-5 text-yellow-500 mx-auto" /> :
                                                            t.rank === 2 ? <Trophy className="w-5 h-5 text-gray-400 mx-auto" /> :
                                                                t.rank === 3 ? <Trophy className="w-5 h-5 text-orange-400 mx-auto" /> :
                                                                    <span className="font-bold text-muted-foreground">{t.rank}</span>}
                                                    </td>
                                                    <td className="px-4 py-3 font-medium">{t.studentName}</td>
                                                    <td className="px-4 py-3 text-center text-muted-foreground">{t.admissionNumber}</td>
                                                    <td className="px-4 py-3 text-center font-bold text-primary">{t.totalMarks}</td>
                                                    <td className="px-4 py-3 text-center font-semibold">{t.percentage}%</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Report Cards Tab */}
                <TabsContent value="report-cards">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        <div className="lg:col-span-1 border rounded-lg bg-card overflow-hidden flex flex-col h-[600px]">
                            <div className="p-3 border-b bg-muted/30">
                                <input
                                    type="text"
                                    placeholder="Search student..."
                                    className="w-full px-3 py-2 text-sm border rounded-md"
                                />
                            </div>
                            <div className="overflow-y-auto flex-1 p-2 space-y-1">
                                {students.map(stud => (
                                    <button
                                        key={stud.id}
                                        onClick={() => handleStudentSelect(stud.id)}
                                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2
                                            ${selectedStudentId === stud.id ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted'}`}
                                    >
                                        <User className="w-4 h-4 opacity-70" />
                                        <div className="truncate flex-1">
                                            <div>{stud.full_name}</div>
                                            <div className={`text-xs ${selectedStudentId === stud.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                                {stud.admission_number}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="lg:col-span-3">
                            {reportLoading ? (
                                <div className="h-full flex items-center justify-center p-12 border rounded-lg bg-card text-muted-foreground">
                                    Loading report card...
                                </div>
                            ) : reportCardData ? (
                                <Card className="shadow-sm border-2">
                                    <div className="p-8 space-y-8">
                                        <div className="text-center space-y-2 border-b pb-6">
                                            <h1 className="text-2xl font-bold uppercase tracking-widest">{exam.name}</h1>
                                            <h2 className="text-lg font-semibold text-muted-foreground">Report Card</h2>
                                        </div>

                                        <div className="flex justify-between items-start text-sm">
                                            <div className="space-y-1">
                                                <p><span className="text-muted-foreground">Name:</span> <span className="font-semibold">{reportCardData.student.full_name}</span></p>
                                                <p><span className="text-muted-foreground">Adm No:</span> <span className="font-semibold">{reportCardData.student.admission_number}</span></p>
                                            </div>
                                            <div className="space-y-1 text-right">
                                                <p><span className="text-muted-foreground">Roll No:</span> <span className="font-semibold">{reportCardData.student.roll_number || '-'}</span></p>
                                            </div>
                                        </div>

                                        <table className="w-full text-sm border">
                                            <thead className="bg-muted/50 border-b">
                                                <tr>
                                                    <th className="px-4 py-2 text-left border-r w-1/2">Subject</th>
                                                    <th className="px-4 py-2 text-center border-r">Max Marks</th>
                                                    <th className="px-4 py-2 text-center border-r">Pass</th>
                                                    <th className="px-4 py-2 text-center border-r">Secured</th>
                                                    <th className="px-4 py-2 text-center">Grade</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reportCardData.rows.map((row: any, i: number) => (
                                                    <tr key={i} className="border-b">
                                                        <td className="px-4 py-2 border-r font-medium">{row.subjectName}</td>
                                                        <td className="px-4 py-2 border-r text-center">{row.maxMarks}</td>
                                                        <td className="px-4 py-2 border-r text-center text-muted-foreground">{row.passMarks}</td>
                                                        <td className="px-4 py-2 border-r text-center font-bold">
                                                            {row.isAbsent ? 'AB' : (row.marksObtained ?? '-')}
                                                        </td>
                                                        <td className="px-4 py-2 text-center font-semibold">{row.grade || '-'}</td>
                                                    </tr>
                                                ))}
                                                <tr className="bg-muted/20 font-bold border-t-2 border-foreground/20">
                                                    <td className="px-4 py-3 border-r">GRAND TOTAL</td>
                                                    <td className="px-4 py-3 border-r text-center">{reportCardData.summary.totalMax}</td>
                                                    <td className="px-4 py-3 border-r text-center"></td>
                                                    <td className="px-4 py-3 border-r text-center text-primary">{reportCardData.summary.totalObtained}</td>
                                                    <td className="px-4 py-3 text-center">{reportCardData.summary.percentage}%</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <CardFooter className="bg-muted/30 border-t justify-end p-4">
                                        <Button variant="outline"><Download className="w-4 h-4 mr-2" /> Download PDF</Button>
                                    </CardFooter>
                                </Card>
                            ) : (
                                <div className="h-full flex items-center justify-center p-12 border rounded-lg bg-muted/10 text-muted-foreground border-dashed">
                                    Select a student from the list to view their report card.
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
