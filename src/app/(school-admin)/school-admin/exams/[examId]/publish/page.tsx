'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft, Lock, Unlock, Send, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { getExamById, publishExamResults, unlockExamResults, getClassPerformanceReport } from '../../actions'

export default function PublishExamPage() {
    const params = useParams()
    const examId = params.examId as string
    const { school } = useAuthStore()

    const [exam, setExam] = useState<any>(null)
    const [performance, setPerformance] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)
    const [notifyParents, setNotifyParents] = useState(false)

    useEffect(() => {
        if (school?.id && examId) {
            loadInitialData()
        }
    }, [school?.id, examId])

    async function loadInitialData() {
        if (!school?.id) return
        setLoading(true)
        try {
            const [ex, perf] = await Promise.all([
                getExamById(school.id, examId),
                getClassPerformanceReport(school.id, examId)
            ])
            setExam(ex)
            setPerformance(perf || [])
        } catch (e: any) {
            toast.error("Failed to load exam details: " + e.message)
        } finally {
            setLoading(false)
        }
    }

    const handlePublish = async () => {
        if (!confirm('Are you sure you want to publish results and lock the exam? This action will notify parents if selected.')) return

        setActionLoading(true)
        try {
            await publishExamResults(examId, notifyParents)
            toast.success("Exam results published and locked successfully!")
            await loadInitialData()
        } catch (e: any) {
            toast.error("Failed to publish: " + e.message)
        } finally {
            setActionLoading(false)
        }
    }

    const handleUnlock = async () => {
        if (!confirm('Are you sure you want to unlock the exam? This will revert it to "ongoing" status and hide results from parents temporarily.')) return

        setActionLoading(true)
        try {
            await unlockExamResults(examId)
            toast.success("Exam unlocked and results hidden.")
            await loadInitialData()
        } catch (e: any) {
            toast.error("Failed to unlock: " + e.message)
        } finally {
            setActionLoading(false)
        }
    }

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading exam details...</div>
    }

    if (!exam) return null

    const totalStudents = performance.length > 0 ? performance[0].studentCount : 0
    // sum marks entries across all subjects? No, performance gives presentCount + absentCount per subject.
    // If we take the first subject as a baseline for total expected entries
    const firstSub = performance[0]
    const marksEntered = firstSub ? (firstSub.passCount + firstSub.failCount + firstSub.absentCount) : 0
    const isReady = marksEntered > 0 && marksEntered >= totalStudents

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href={"/school-admin/exams" as any}>
                    <Button variant="outline" size="icon">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Publish & Lock: {exam.name}</h2>
                    <p className="text-muted-foreground">Manage the visibility state of examination results.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-1 space-y-4">
                    <Card className="shadow-soft">
                        <CardHeader className="bg-muted/30 pb-4 border-b">
                            <CardTitle className="flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-primary" /> Current Status
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="flex flex-col gap-1">
                                <span className="text-sm text-muted-foreground">Exam Status</span>
                                <span className={`inline-flex self-start px-3 py-1 rounded-full text-sm font-semibold uppercase tracking-wide
                                    ${exam.status === 'locked' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' :
                                        exam.status === 'published' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
                                            'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'}
                                `}>
                                    {exam.status}
                                </span>
                            </div>

                            <div className="flex flex-col gap-1 mt-4">
                                <span className="text-sm text-muted-foreground">Result Visibility</span>
                                <span className="font-medium text-foreground">
                                    {exam.result_visible ? (
                                        <span className="text-green-600 dark:text-green-400 font-semibold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Visible to Parents</span>
                                    ) : (
                                        <span className="text-muted-foreground font-medium flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Hidden from Parents</span>
                                    )}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="md:col-span-1 space-y-4">
                    <Card className="shadow-soft h-full">
                        <CardHeader className="bg-muted/30 pb-4 border-b">
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-amber-500" /> Readiness Check
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            {performance.length === 0 ? (
                                <p className="text-muted-foreground text-sm">No specific subjects or marks to validate.</p>
                            ) : (
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between items-center py-2 border-b">
                                        <span className="text-muted-foreground">Subjects Configured</span>
                                        <span className="font-semibold">{performance.length}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b">
                                        <span className="text-muted-foreground">Total Students</span>
                                        <span className="font-semibold">{totalStudents}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2">
                                        <span className="text-muted-foreground">Estimated Completion</span>
                                        <span className={`font-semibold ${isReady ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                            {marksEntered} / {totalStudents} Entered
                                        </span>
                                    </div>
                                    {!isReady && exam.status !== 'locked' && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                                            Warning: Not all marks appear to have been entered yet.
                                        </p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="md:col-span-2">
                    <Card className="shadow-soft border-primary/20">
                        <CardHeader>
                            <CardTitle>Action Center</CardTitle>
                            <CardDescription>Publishing results will lock marks from further changes and optionally notify parents.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {exam.status === 'locked' ? (
                                <div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-lg border border-red-100 dark:border-red-900 space-y-3">
                                    <div className="flex items-center gap-2 text-red-800 dark:text-red-300 font-medium">
                                        <Lock className="w-5 h-5" />
                                        This exam is currently locked.
                                    </div>
                                    <p className="text-sm text-red-700/80 dark:text-red-300/80">
                                        Marks cannot be modified while locked. Unlocking the exam will temporarily hide results from parents.
                                    </p>
                                    <Button
                                        onClick={handleUnlock}
                                        disabled={actionLoading}
                                        variant="outline"
                                        className="border-red-200 text-red-700 hover:bg-red-100 hover:text-red-800 mt-2"
                                    >
                                        {actionLoading ? "Processing..." : <><Unlock className="w-4 h-4 mr-2" /> Unlock Exam</>}
                                    </Button>
                                </div>
                            ) : (
                                <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-100 dark:border-blue-900 space-y-4">
                                    <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-medium">
                                        <Unlock className="w-5 h-5" />
                                        This exam is currently open.
                                    </div>
                                    <p className="text-sm text-blue-700/80 dark:text-blue-300/80">
                                        You can freely edit marks. Publishing will lock all entries and generate final report cards.
                                    </p>

                                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-blue-200 dark:border-blue-900/50">
                                        <input
                                            type="checkbox"
                                            id="notifyParents"
                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            checked={notifyParents}
                                            onChange={(e) => setNotifyParents(e.target.checked)}
                                        />
                                        <label htmlFor="notifyParents" className="text-sm font-medium cursor-pointer text-foreground">
                                            Send SMS / Email notification to parents
                                        </label>
                                    </div>

                                    <Button
                                        onClick={handlePublish}
                                        disabled={actionLoading}
                                        className="bg-primary hover:bg-primary/90 text-primary-foreground mt-4 w-full sm:w-auto"
                                    >
                                        {actionLoading ? "Processing..." : <><Send className="w-4 h-4 mr-2" /> Publish Results & Lock</>}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
