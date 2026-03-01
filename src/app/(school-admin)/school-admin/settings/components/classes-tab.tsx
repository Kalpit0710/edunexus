'use client'

import { useState, useEffect } from 'react'
import { getClasses, getSections, createClass, deleteClass, createSection, deleteSection } from '../actions'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Trash2, Plus } from 'lucide-react'

export function ClassesTab() {
    const { school } = useAuthStore()
    const [classes, setClasses] = useState<any[]>([])
    const [sections, setSections] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // New Class Form state
    const [newClassName, setNewClassName] = useState('')
    const [newClassOrder, setNewClassOrder] = useState(1)

    // New Section Form state
    const [newSectionName, setNewSectionName] = useState('')
    const [newSectionCapacity, setNewSectionCapacity] = useState(40)
    const [selectedClassId, setSelectedClassId] = useState('')

    useEffect(() => {
        if (school?.id) {
            fetchData()
        }
    }, [school?.id])

    async function fetchData() {
        if (!school?.id) return
        setLoading(true)
        try {
            const [cData, sData] = await Promise.all([
                getClasses(school.id),
                getSections(school.id)
            ])
            setClasses(cData || [])
            setSections(sData || [])
            if (cData && cData.length > 0 && cData[0]) {
                setSelectedClassId((cData[0] as any).id)
            }
        } catch (e: any) {
            toast.error('Failed to load hierarchies: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleAddClass(e: React.FormEvent) {
        e.preventDefault()
        if (!newClassName.trim() || !school?.id) return
        try {
            await createClass(school.id, newClassName, newClassOrder)
            toast.success('Class added')
            setNewClassName('')
            setNewClassOrder(newClassOrder + 1)
            fetchData()
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    async function handleDeleteClass(id: string) {
        if (!confirm('Are you sure? This will delete all related sections.')) return
        try {
            await deleteClass(id)
            toast.success('Class deleted')
            fetchData()
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    async function handleAddSection(e: React.FormEvent) {
        e.preventDefault()
        if (!newSectionName.trim() || !selectedClassId || !school?.id) return
        try {
            await createSection(school.id, selectedClassId, newSectionName, newSectionCapacity)
            toast.success('Section added')
            setNewSectionName('')
            fetchData()
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    async function handleDeleteSection(id: string) {
        try {
            await deleteSection(id)
            toast.success('Section deleted')
            fetchData()
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    if (loading) return <div className="py-8">Loading classes structure...</div>

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Classes Column */}
            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-medium">Classes / Grades</h3>
                    <p className="text-sm text-muted-foreground mb-4">Manage the grade levels in your school.</p>
                    <form onSubmit={handleAddClass} className="flex gap-2">
                        <Input
                            placeholder="e.g. Class 10"
                            value={newClassName}
                            onChange={e => setNewClassName(e.target.value)}
                        />
                        <Input
                            type="number"
                            className="w-20"
                            value={newClassOrder}
                            onChange={e => setNewClassOrder(Number(e.target.value))}
                            title="Display Order"
                        />
                        <Button type="submit"><Plus className="w-4 h-4 mr-2" /> Add</Button>
                    </form>
                </div>

                <div className="space-y-2">
                    {classes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No classes defined yet.</p>
                    ) : (
                        classes.map(c => (
                            <Card key={c.id}>
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="font-medium">{c.name} <span className="text-xs text-muted-foreground ml-2">(Order: {c.display_order})</span></div>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteClass(c.id)} className="text-red-500">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>

            {/* Sections Column */}
            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-medium">Sections</h3>
                    <p className="text-sm text-muted-foreground mb-4">Add sections and assign capacity limits.</p>
                    <form onSubmit={handleAddSection} className="flex flex-col gap-3">
                        <div className="flex gap-2">
                            <select
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={selectedClassId}
                                onChange={e => setSelectedClassId(e.target.value)}
                            >
                                <option value="" disabled>Select Class...</option>
                                {classes.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Section Name (e.g. A)"
                                value={newSectionName}
                                onChange={e => setNewSectionName(e.target.value)}
                            />
                            <Input
                                type="number"
                                className="w-24"
                                placeholder="Capacity"
                                value={newSectionCapacity}
                                onChange={e => setNewSectionCapacity(Number(e.target.value))}
                            />
                            <Button type="submit">Add Section</Button>
                        </div>
                    </form>
                </div>

                <div className="space-y-2">
                    {sections.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No sections defined yet.</p>
                    ) : (
                        sections.map(s => {
                            const className = classes.find(c => c.id === s.class_id)?.name || 'Unknown Class'
                            return (
                                <Card key={s.id}>
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div>
                                            <div className="font-medium">{s.name} <span className="text-sm text-muted-foreground ml-2">in {className}</span></div>
                                            <div className="text-xs text-muted-foreground mt-1">Capacity: {s.capacity} students</div>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteSection(s.id)} className="text-red-500">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </CardContent>
                                </Card>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    )
}
