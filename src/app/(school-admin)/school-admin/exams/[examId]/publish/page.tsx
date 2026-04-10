'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
        if (school?.id && examId) loadInitialData()
    }, [school?.id, examId])

    async function loadInitialData() {
        if (!school?.id) return
        setLoading(true)
        try {
            const [ex, perf] = await Promise.all([
                getExamById(school.id, examId),
                getClassPerformanceReport(school.id, examId),
            ])
            setExam(ex)
            setPerformance(perf || [])
        } catch (e: any) {
            toast.error('Failed to load exam details: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    const handlePublish = async () => {
        if (!confirm('Publish results and lock the exam? Parents will be notified if selected.')) return
        setActionLoading(true)
        try {
            await publishExamResults(examId, notifyParents)
            toast.success('Exam results published and locked!')
            await loadInitialData()
        } catch (e: any) {
            toast.error('Failed to publish: ' + e.message)
        } finally {
            setActionLoading(false)
        }
    }

    const handleUnlock = async () => {
        if (!confirm('Unlock the exam? Results will be hidden from parents temporarily.')) return
        setActionLoading(true)
        try {
            await unlockExamResults(examId)
            toast.success('Exam unlocked — results hidden from parents.')
            await loadInitialData()
        } catch (e: any) {
            toast.error('Failed to unlock: ' + e.message)
        } finally {
            setActionLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="max-w-3xl mx-auto space-y-5">
                <Skeleton className="h-10 w-64 rounded-xl bg-white/5" />
                <div className="grid sm:grid-cols-2 gap-4">
                    <Skeleton className="h-40 rounded-2xl bg-white/5" />
                    <Skeleton className="h-40 rounded-2xl bg-white/5" />
                </div>
                <Skeleton className="h-48 rounded-2xl bg-white/5" />
            </div>
        )
    }

    if (!exam) return null

    const totalStudents = performance.length > 0 ? performance[0].studentCount : 0
    const recordedCounts = performance.map((row: any) => (
        row.recordedCount ?? (row.passCount + row.failCount + row.absentCount)
    ))
    const minRecorded = recordedCounts.length ? Math.min(...recordedCounts) : 0
    const isReady = totalStudents > 0 && recordedCounts.length > 0 && recordedCounts.every((count) => count >= totalStudents)

    const isLocked = exam.status === 'locked'

    const statusAccent = isLocked
        ? { color: '#ef4444', bg: '#ef444414', border: '#ef444430', label: 'Locked' }
        : exam.status === 'published'
            ? { color: '#3b82f6', bg: '#3b82f614', border: '#3b82f630', label: 'Published' }
            : { color: '#f59e0b', bg: '#f59e0b14', border: '#f59e0b30', label: 'Ongoing' }

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
            {/* Back + title */}
            <div className="flex items-center gap-4">
                <Link href={'/school-admin/exams' as any}>
                    <Button variant="outline" size="icon" className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-white">Publish & Lock</h2>
                    <p className="text-sm text-zinc-500 mt-0.5">{exam.name}</p>
                </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
                {/* Current status card */}
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl border" style={{ backgroundColor: statusAccent.bg, borderColor: statusAccent.border, color: statusAccent.color }}>
                            <ShieldCheck className="h-4 w-4" />
                        </div>
                        <p className="text-sm font-semibold text-white">Current Status</p>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <p className="text-xs text-zinc-500 mb-1">Exam Status</p>
                            <span
                                className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                                style={{ color: statusAccent.color, backgroundColor: statusAccent.bg, borderColor: statusAccent.border }}
                            >
                                {statusAccent.label}
                            </span>
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500 mb-1">Result Visibility</p>
                            {exam.result_visible ? (
                                <span className="text-emerald-400 text-sm font-medium flex items-center gap-1.5">
                                    <CheckCircle2 className="h-4 w-4" /> Visible to Parents
                                </span>
                            ) : (
                                <span className="text-zinc-500 text-sm font-medium flex items-center gap-1.5">
                                    <ShieldCheck className="h-4 w-4" /> Hidden from Parents
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Readiness check */}
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
                            <AlertTriangle className="h-4 w-4 text-amber-400" />
                        </div>
                        <p className="text-sm font-semibold text-white">Readiness Check</p>
                    </div>
                    {performance.length === 0 ? (
                        <p className="text-sm text-zinc-500">No subjects configured yet.</p>
                    ) : (
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between items-center py-1.5 border-b border-white/[0.05]">
                                <span className="text-zinc-500 text-xs">Subjects</span>
                                <span className="font-semibold text-white">{performance.length}</span>
                            </div>
                            <div className="flex justify-between items-center py-1.5 border-b border-white/[0.05]">
                                <span className="text-zinc-500 text-xs">Total Students</span>
                                <span className="font-semibold text-white">{totalStudents}</span>
                            </div>
                            <div className="flex justify-between items-center py-1.5">
                                <span className="text-zinc-500 text-xs">Marks Recorded (Lowest Subject)</span>
                                <span className={`font-semibold text-sm ${isReady ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {minRecorded} / {totalStudents}
                                </span>
                            </div>
                            {!isReady && !isLocked && totalStudents > 0 && (
                                <p className="text-[11px] text-amber-400 mt-1">
                                    ⚠ Not all marks have been entered yet.
                                </p>
                            )}
                            {!isReady && !isLocked && totalStudents === 0 && (
                                <p className="text-[11px] text-amber-400 mt-1">
                                    ⚠ No enrolled students found for this class.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Action center */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 space-y-4">
                <div>
                    <p className="text-sm font-semibold text-white">Action Center</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                        Publishing locks all marks and optionally notifies parents.
                    </p>
                </div>

                {isLocked ? (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/8 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-red-400 font-medium text-sm">
                            <Lock className="h-4 w-4" /> This exam is currently locked
                        </div>
                        <p className="text-xs text-red-300/70">
                            Marks cannot be modified while locked. Unlocking will temporarily hide results from parents.
                        </p>
                        <Button
                            onClick={handleUnlock}
                            disabled={actionLoading}
                            variant="outline"
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        >
                            {actionLoading ? 'Processing...' : <><Unlock className="h-4 w-4 mr-2" /> Unlock Exam</>}
                        </Button>
                    </div>
                ) : (
                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/8 p-4 space-y-4">
                        <div className="flex items-center gap-2 text-blue-400 font-medium text-sm">
                            <Unlock className="h-4 w-4" /> This exam is currently open
                        </div>
                        <p className="text-xs text-blue-300/70">
                            You can freely edit marks. Publishing will lock all entries.
                        </p>
                        <label className="flex items-center gap-2.5 cursor-pointer group">
                            <input
                                type="checkbox"
                                id="notifyParents"
                                className="h-4 w-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500"
                                checked={notifyParents}
                                onChange={e => setNotifyParents(e.target.checked)}
                            />
                            <span className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">
                                Send email notification to parents
                            </span>
                        </label>
                        <Button
                            onClick={handlePublish}
                            disabled={actionLoading}
                            className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 w-full sm:w-auto"
                        >
                            {actionLoading ? 'Processing...' : <><Send className="h-4 w-4 mr-2" /> Publish Results & Lock</>}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
