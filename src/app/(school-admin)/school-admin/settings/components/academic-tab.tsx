'use client'

import { useState, useEffect } from 'react'
import { getAcademicYears, createAcademicYear, deleteAcademicYear, updateSchoolSettings, getSchoolSettings } from '../actions'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Trash2, Calendar, CheckSquare } from 'lucide-react'

export function AcademicTab() {
    const { school, setSchool } = useAuthStore()
    const [years, setYears] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const [newName, setNewName] = useState('')
    const [newStartDate, setNewStartDate] = useState('')
    const [newEndDate, setNewEndDate] = useState('')
    const [newIsCurrent, setNewIsCurrent] = useState(true)

    const [startMonth, setStartMonth] = useState(4) // Default April

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
            const data = await getAcademicYears(sid)
            setYears(data || [])
            const settings: any = await getSchoolSettings(sid)
            if (settings?.academic_year_start_month) {
                setStartMonth(settings.academic_year_start_month)
            }
        } catch (e: any) {
            toast.error('Failed to load academic years: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleAddYear(e: React.FormEvent) {
        e.preventDefault()
        if (!newName.trim() || !newStartDate || !newEndDate || !school?.id) return
        try {
            await createAcademicYear(school.id, newName, newStartDate, newEndDate, newIsCurrent)
            toast.success('Academic year added')
            setNewName('')
            setNewStartDate('')
            setNewEndDate('')
            setNewIsCurrent(true)
            fetchData()
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    async function handleDeleteYear(id: string) {
        if (!confirm('Are you sure?')) return
        try {
            await deleteAcademicYear(id)
            toast.success('Academic year deleted')
            fetchData()
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    async function saveStartMonth() {
        if (!school?.id) return
        try {
            await updateSchoolSettings(school.id, { academic_year_start_month: startMonth } as any)
            setSchool({ ...school, academic_year_start_month: startMonth })
            toast.success('Start month updated')
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    if (loading) return <div className="py-8">Loading academic schedule...</div>

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Settings col */}
            <div className="space-y-6 lg:col-span-1 border-r pr-4">
                <div>
                    <h3 className="text-lg font-medium">Default Cycle</h3>
                    <p className="text-sm text-muted-foreground mb-4">Set which month standard academic calculations start from.</p>
                    <div className="space-y-3">
                        <Label>Start Month</Label>
                        <div className="flex gap-2">
                            <select
                                value={startMonth}
                                onChange={e => setStartMonth(Number(e.target.value))}
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                                {[
                                    'January', 'February', 'March', 'April', 'May', 'June',
                                    'July', 'August', 'September', 'October', 'November', 'December'
                                ].map((name, i) => (
                                    <option key={i + 1} value={i + 1}>{name}</option>
                                ))}
                            </select>
                            <Button onClick={saveStartMonth}>Apply</Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Terms Col */}
            <div className="space-y-6 lg:col-span-2">
                <div>
                    <h3 className="text-lg font-medium">Academic Years / Terms</h3>
                    <p className="text-sm text-muted-foreground mb-4">Define terms like "2024-25" or "Spring 2024".</p>
                    <form onSubmit={handleAddYear} className="flex flex-col md:flex-row gap-3 items-end">
                        <div className="w-full">
                            <Label className="text-xs mb-1 block">Term Name</Label>
                            <Input placeholder="e.g. 2025-26" value={newName} onChange={e => setNewName(e.target.value)} />
                        </div>
                        <div className="w-full">
                            <Label className="text-xs mb-1 block">Start Date</Label>
                            <Input type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} />
                        </div>
                        <div className="w-full">
                            <Label className="text-xs mb-1 block">End Date</Label>
                            <Input type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} />
                        </div>
                        <div className="flex items-center gap-2 h-10 bg-gray-50 dark:bg-gray-900 border rounded-md px-3">
                            <input type="checkbox" id="is_cur" checked={newIsCurrent} onChange={e => setNewIsCurrent(e.target.checked)} className="rounded text-primary focus:ring-primary" />
                            <Label htmlFor="is_cur" className="text-sm cursor-pointer whitespace-nowrap">Current Year</Label>
                        </div>
                        <Button type="submit"><Calendar className="w-4 h-4 mr-2" /> Add</Button>
                    </form>
                </div>

                <div className="space-y-3">
                    {years.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No academic years defined.</p>
                    ) : (
                        years.map(y => (
                            <Card key={y.id} className={y.is_current ? 'border-primary' : ''}>
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div>
                                        <div className="font-medium text-lg flex items-center gap-2">
                                            {y.name}
                                            {y.is_current && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded flex items-center"><CheckSquare className="w-3 h-3 mr-1" /> Current</span>}
                                        </div>
                                        <div className="text-sm text-muted-foreground mt-1">
                                            {new Date(y.start_date).toLocaleDateString()} to {new Date(y.end_date).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteYear(y.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
