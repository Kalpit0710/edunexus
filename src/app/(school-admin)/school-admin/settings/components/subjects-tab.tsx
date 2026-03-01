'use client'

import { useState, useEffect } from 'react'
import { getClasses, getSubjects, createSubject, deleteSubject } from '../actions'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Trash2, BookOpen } from 'lucide-react'

export function SubjectsTab() {
    const { school } = useAuthStore()
    const [classes, setClasses] = useState<any[]>([])
    const [subjects, setSubjects] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const [newSubjectName, setNewSubjectName] = useState('')
    const [newSubjectCode, setNewSubjectCode] = useState('')
    const [selectedClassId, setSelectedClassId] = useState('')

    useEffect(() => {
        if (school?.id) {
            fetchData()
        }
    }, [school?.id])

    async function fetchData() {
        const sid = school?.id
        if (!sid) return
        setLoading(true)
        try {
            const [cData, subData] = await Promise.all([
                getClasses(sid),
                getSubjects(sid)
            ])
            setClasses(cData || [])
            setSubjects(subData || [])
            if (cData && cData.length > 0 && cData[0]) {
                setSelectedClassId((cData[0] as any).id)
            }
        } catch (e: any) {
            toast.error('Failed to load subjects: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleAddSubject(e: React.FormEvent) {
        e.preventDefault()
        if (!newSubjectName.trim() || !selectedClassId || !school?.id) return
        try {
            await createSubject(school.id, selectedClassId, newSubjectName, newSubjectCode)
            toast.success('Subject added')
            setNewSubjectName('')
            setNewSubjectCode('')
            fetchData()
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    async function handleDeleteSubject(id: string) {
        try {
            await deleteSubject(id)
            toast.success('Subject deleted')
            fetchData()
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    if (loading) return <div className="py-8">Loading subjects...</div>

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Curriculum Configuration</h3>
                <p className="text-sm text-muted-foreground mb-4">Assign teaching subjects to respective classes.</p>
                <form onSubmit={handleAddSubject} className="flex flex-col md:flex-row gap-3">
                    <select
                        className="flex h-10 w-full md:w-64 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={selectedClassId}
                        onChange={e => setSelectedClassId(e.target.value)}
                    >
                        <option value="" disabled>Select Class...</option>
                        {classes.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <Input
                        placeholder="Subject Name (e.g. Mathematics)"
                        value={newSubjectName}
                        onChange={e => setNewSubjectName(e.target.value)}
                    />
                    <Input
                        className="w-full md:w-48"
                        placeholder="Subject Code (optional)"
                        value={newSubjectCode}
                        onChange={e => setNewSubjectCode(e.target.value)}
                    />
                    <Button type="submit"><BookOpen className="w-4 h-4 mr-2" /> Add Subject</Button>
                </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground col-span-full">No subjects defined yet.</p>
                ) : (
                    subjects.map(s => {
                        const className = classes.find(c => c.id === s.class_id)?.name || 'Unknown Class'
                        return (
                            <Card key={s.id}>
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div>
                                        <div className="font-medium text-lg">{s.name}</div>
                                        <div className="text-sm text-muted-foreground">{className}</div>
                                        {s.code && <div className="text-xs mt-1 bg-gray-100 px-2 py-0.5 rounded-md inline-block dark:bg-gray-800">{s.code}</div>}
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteSubject(s.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </CardContent>
                            </Card>
                        )
                    })
                )}
            </div>
        </div>
    )
}
