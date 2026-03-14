'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { getExams } from './actions'
import { getClasses } from '../settings/actions'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Plus, Search, Eye, FileText, Lock, Edit } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'
import type { ExamStatus } from '@/lib/exam-utils'

// Mapping for status badge colors
const statusColors: Record<ExamStatus, string> = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    published: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    ongoing: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    locked: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
}

export default function ExamsPage() {
    const { school } = useAuthStore()
    const [exams, setExams] = useState<any[]>([])
    const [classes, setClasses] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Filters
    const [search, setSearch] = useState('')
    const [selectedClassId, setSelectedClassId] = useState<string>('all')
    const [selectedStatus, setSelectedStatus] = useState<string>('all')

    useEffect(() => {
        if (school?.id) {
            fetchInitialData()
        }
    }, [school?.id])

    async function fetchInitialData() {
        if (!school?.id) return
        setLoading(true)
        try {
            const [examsData, classesData] = await Promise.all([
                getExams(school.id),
                getClasses(school.id)
            ])
            setExams(examsData || [])
            setClasses(classesData || [])
        } catch (e: any) {
            toast.error('Failed to load exams data: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    const filteredExams = exams.filter(e => {
        if (selectedClassId !== 'all' && e.class_id !== selectedClassId) return false
        if (selectedStatus !== 'all' && e.status !== selectedStatus) return false

        if (search) {
            const term = search.toLowerCase()
            // Find class name for this exam
            const cls = classes.find(c => c.id === e.class_id)
            return (
                e.name.toLowerCase().includes(term) ||
                (cls && cls.name.toLowerCase().includes(term))
            )
        }
        return true
    })

    // Helper to format dates
    const formatDate = (dateString?: string) => {
        if (!dateString) return '-'
        return new Date(dateString).toLocaleDateString()
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Exams</h2>
                    <p className="text-muted-foreground">Manage school examinations, marks, and publish results.</p>
                </div>
                <div className="flex gap-2">
                    <Link href={"/school-admin/exams/new" as any}>
                        <Button className="shadow-soft hover:scale-105 transition-transform">
                            <Plus className="w-4 h-4 mr-2" /> Create Exam
                        </Button>
                    </Link>
                </div>
            </div>

            <Card className="shadow-soft border-border/50">
                <CardHeader className="pb-3 border-b space-y-3 sm:space-y-0 sm:flex sm:flex-row gap-4">
                    <div className="flex items-center gap-2 max-w-sm flex-1">
                        <Search className="w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search exams..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="h-9 border-0 shadow-none focus-visible:ring-0 px-0 rounded-none bg-transparent"
                        />
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                            <SelectTrigger className="w-[140px] h-9">
                                <SelectValue placeholder="All Classes" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Classes</SelectItem>
                                {classes.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                            <SelectTrigger className="w-[140px] h-9">
                                <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="published">Published</SelectItem>
                                <SelectItem value="ongoing">Ongoing</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="locked">Locked</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-8 text-center text-muted-foreground">Loading exams...</div>
                    ) : filteredExams.length === 0 ? (
                        <div className="p-8 text-center sm:py-16">
                            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                                <FileText className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-medium mb-1">No exams found</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                {exams.length === 0 ? 'Create your first exam to get started.' : 'Try adjusting your search filters.'}
                            </p>
                            {exams.length === 0 && (
                                <Link href={"/school-admin/exams/new" as any}>
                                    <Button variant="outline"><Plus className="w-4 h-4 mr-2" /> Create Exam</Button>
                                </Link>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Exam Name</th>
                                        <th className="px-6 py-3 font-medium">Class</th>
                                        <th className="px-6 py-3 font-medium">Date Range</th>
                                        <th className="px-6 py-3 font-medium">Status</th>
                                        <th className="px-6 py-3 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredExams.map((exam) => {
                                        const cls = classes.find(c => c.id === exam.class_id)
                                        const statusClass = statusColors[exam.status as ExamStatus] || statusColors.draft

                                        return (
                                            <tr key={exam.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="px-6 py-4 font-medium text-foreground">{exam.name}</td>
                                                <td className="px-6 py-4 text-muted-foreground">{cls?.name || 'Unknown Class'}</td>
                                                <td className="px-6 py-4 text-muted-foreground">
                                                    {formatDate(exam.start_date)} - {formatDate(exam.end_date)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${statusClass}`}>
                                                        {exam.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                                                    <Link href={`/school-admin/exams/${exam.id}/marks` as any}>
                                                        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-primary">
                                                            <Edit className="h-4 w-4 mr-2" /> Marks
                                                        </Button>
                                                    </Link>
                                                    <Link href={`/school-admin/exams/${exam.id}/reports` as any}>
                                                        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-primary">
                                                            <FileText className="h-4 w-4 mr-2" /> Reports
                                                        </Button>
                                                    </Link>
                                                    <Link href={`/school-admin/exams/${exam.id}/publish` as any}>
                                                        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-primary">
                                                            {exam.status === 'locked' ? (
                                                                <><Lock className="h-4 w-4 mr-2" /> Locked</>
                                                            ) : (
                                                                <><Eye className="h-4 w-4 mr-2" /> Publish</>
                                                            )}
                                                        </Button>
                                                    </Link>
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
    )
}
