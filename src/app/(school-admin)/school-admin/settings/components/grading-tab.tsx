'use client'

import { useState, useEffect } from 'react'
import { getGradingRules, createGradingRule, deleteGradingRule } from '../actions'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CardContent } from '@/components/ui/card'
import { Trash2, Plus } from 'lucide-react'

export function GradingRulesTab() {
    const { school } = useAuthStore()
    const [rules, setRules] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const [minMarks, setMinMarks] = useState('')
    const [maxMarks, setMaxMarks] = useState('')
    const [gradeName, setGradeName] = useState('')
    const [gradePoint, setGradePoint] = useState('')

    useEffect(() => {
        if (school?.id) fetchData()
    }, [school?.id])

    async function fetchData() {
        const sid = school?.id
        if (!sid) return
        setLoading(true)
        try {
            const data = await getGradingRules(sid)
            setRules(data || [])
        } catch (e: any) {
            toast.error('Failed to load rules: ' + e.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleAddRule(e: React.FormEvent) {
        e.preventDefault()
        if (!gradeName.trim() || !minMarks || !maxMarks || !school?.id) return
        try {
            await createGradingRule(school.id, Number(minMarks), Number(maxMarks), gradeName, Number(gradePoint) || 0)
            toast.success('Grading rule added')
            setMinMarks('')
            setMaxMarks('')
            setGradeName('')
            setGradePoint('')
            fetchData()
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    async function handleDeleteRule(id: string) {
        if (!confirm('Are you sure?')) return
        try {
            await deleteGradingRule(id)
            toast.success('Rule deleted')
            fetchData()
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    if (loading) return <div className="py-8">Loading grading rules...</div>

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Grading System</h3>
                <p className="text-sm text-muted-foreground mb-4">Define standard percent thresholds and corresponding letter grades / GPA points.</p>
                <form onSubmit={handleAddRule} className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                    <div>
                        <span className="text-xs text-muted-foreground mb-1 block">Min %</span>
                        <Input type="number" placeholder="e.g. 90" value={minMarks} onChange={e => setMinMarks(e.target.value)} />
                    </div>
                    <div>
                        <span className="text-xs text-muted-foreground mb-1 block">Max %</span>
                        <Input type="number" placeholder="e.g. 100" value={maxMarks} onChange={e => setMaxMarks(e.target.value)} />
                    </div>
                    <div>
                        <span className="text-xs text-muted-foreground mb-1 block">Grade Name</span>
                        <Input placeholder="e.g. A+" value={gradeName} onChange={e => setGradeName(e.target.value)} />
                    </div>
                    <div>
                        <span className="text-xs text-muted-foreground mb-1 block">Grade Point</span>
                        <Input type="number" step="0.1" placeholder="e.g. 4.0" value={gradePoint} onChange={e => setGradePoint(e.target.value)} />
                    </div>
                    <Button type="submit" className="w-full"><Plus className="w-4 h-4 mr-2" /> Add</Button>
                </form>
            </div>

            <div className="rounded-md border">
                <div className="grid grid-cols-5 p-3 text-sm font-medium bg-muted/50 border-b">
                    <div className="col-span-1">Range</div>
                    <div className="col-span-1">Grade Name</div>
                    <div className="col-span-1">Grade Point</div>
                    <div className="col-span-2 text-right">Actions</div>
                </div>
                {rules.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">No rules defined.</div>
                ) : (
                    <div className="divide-y">
                        {rules.map(r => (
                            <div key={r.id} className="grid grid-cols-5 p-3 items-center text-sm">
                                <div className="col-span-1 font-medium">{r.min_marks}% - {r.max_marks}%</div>
                                <div className="col-span-1"><span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">{r.grade_name}</span></div>
                                <div className="col-span-1 text-muted-foreground">{r.grade_point}</div>
                                <div className="col-span-2 text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteRule(r.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
