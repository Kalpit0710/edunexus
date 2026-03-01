'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState } from 'react'
import {
  getFeeCategories,
  getFeeStructures,
  createFeeCategory,
  createFeeStructure,
  deleteFeeStructure,
  getAcademicYearsForFees,
  toggleCategoryStatus,
  type FeeCategoryRow,
  type FeeStructureRow,
  type AcademicYearRow,
} from './actions'
import { getClasses } from '../settings/actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Plus, Trash2, Power, CircleDollarSign } from 'lucide-react'
import Link from 'next/link'

export default function FeesPage() {
  const { school } = useAuthStore()
  const [categories, setCategories] = useState<FeeCategoryRow[]>([])
  const [structures, setStructures] = useState<FeeStructureRow[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYearRow[]>([])
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [loading, setLoading] = useState(true)

  // New category form
  const [newCatName, setNewCatName] = useState('')
  const [newCatDesc, setNewCatDesc] = useState('')
  const [addingCat, setAddingCat] = useState(false)

  // New structure form
  const [newClassId, setNewClassId] = useState('')
  const [newCatId, setNewCatId] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [addingStruct, setAddingStruct] = useState(false)

  const load = async (yearId?: string) => {
    if (!school?.id) return
    setLoading(true)
    try {
      const [cats, structs, years, cls] = await Promise.all([
        getFeeCategories(school.id),
        getFeeStructures(school.id, yearId || selectedYear || undefined),
        getAcademicYearsForFees(school.id),
        getClasses(school.id),
      ])
      setCategories(cats)
      setStructures(structs)
      setAcademicYears(years)
      setClasses(cls as any)
      if (!selectedYear && years.length) {
        const current = years.find(y => y.is_current) ?? years[0]
        if (current) setSelectedYear(current.id)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [school?.id])

  const handleAddCategory = async () => {
    if (!school?.id || !newCatName.trim()) return
    setAddingCat(true)
    try {
      await createFeeCategory(school.id, newCatName, newCatDesc)
      toast.success('Category added')
      setNewCatName(''); setNewCatDesc('')
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setAddingCat(false)
    }
  }

  const handleToggleCat = async (cat: FeeCategoryRow) => {
    try {
      await toggleCategoryStatus(cat.id, !cat.is_active)
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const handleAddStructure = async () => {
    if (!school?.id || !newClassId || !newCatId || !newAmount || !selectedYear) {
      toast.error('Fill in all required fields')
      return
    }
    setAddingStruct(true)
    try {
      await createFeeStructure(school.id, newClassId, newCatId, selectedYear, Number(newAmount), newDueDate || undefined)
      toast.success('Fee structure added')
      setNewClassId(''); setNewCatId(''); setNewAmount(''); setNewDueDate('')
      load(selectedYear)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setAddingStruct(false)
    }
  }

  const handleDeleteStructure = async (id: string) => {
    try {
      await deleteFeeStructure(id)
      toast.success('Row deleted')
      load(selectedYear)
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fee &amp; Billing</h1>
          <p className="text-muted-foreground text-sm">Manage fee categories and class-wise fee structures</p>
        </div>
        <Link href={"/school-admin/fees/collect" as any}>
          <Button>
            <CircleDollarSign className="mr-2 h-4 w-4" />
            Collect Fee
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Fee Categories ─────────────────────────── */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Fee Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add form */}
            <div className="space-y-2 border rounded p-3 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground">New Category</p>
              <Input
                placeholder="Name (e.g. Tuition)"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
              />
              <Input
                placeholder="Description (optional)"
                value={newCatDesc}
                onChange={e => setNewCatDesc(e.target.value)}
              />
              <Button
                size="sm"
                className="w-full"
                onClick={handleAddCategory}
                disabled={addingCat || !newCatName.trim()}
              >
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>

            <Separator />

            {/* List */}
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categories yet.</p>
            ) : (
              <ul className="space-y-2">
                {categories.map(cat => (
                  <li key={cat.id} className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{cat.name}</p>
                      {cat.description && <p className="text-xs text-muted-foreground">{cat.description}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={cat.is_active ? 'default' : 'secondary'} className="text-xs">
                        {cat.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={cat.is_active ? 'Deactivate' : 'Activate'}
                        onClick={() => handleToggleCat(cat)}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ── Right: Fee Structures ─────────────────────────── */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Fee Structures</CardTitle>
            <Select
              value={selectedYear}
              onValueChange={val => { setSelectedYear(val); load(val) }}
            >
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue placeholder="Academic Year" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map(y => (
                  <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add structure row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border rounded p-3 bg-muted/30">
              <Select value={newClassId} onValueChange={setNewClassId}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Class" /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={newCatId} onValueChange={setNewCatId}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  {categories.filter(c => c.is_active).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="Amount (₹)"
                className="h-8 text-sm"
                value={newAmount}
                onChange={e => setNewAmount(e.target.value)}
              />
              <Input
                type="date"
                className="h-8 text-sm"
                value={newDueDate}
                onChange={e => setNewDueDate(e.target.value)}
              />
              <div className="col-span-2 sm:col-span-4">
                <Button
                  size="sm"
                  onClick={handleAddStructure}
                  disabled={addingStruct || !newClassId || !newCatId || !newAmount}
                >
                  <Plus className="mr-1 h-4 w-4" /> Add Structure
                </Button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Class</th>
                    <th className="text-left py-2 pr-4 font-medium">Category</th>
                    <th className="text-right py-2 pr-4 font-medium">Amount</th>
                    <th className="text-left py-2 pr-4 font-medium">Due Date</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
                  ) : structures.length === 0 ? (
                    <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No structures found for this year.</td></tr>
                  ) : (
                    structures.map(s => (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-2 pr-4 font-medium">{s.class_name}</td>
                        <td className="py-2 pr-4">{s.category_name}</td>
                        <td className="py-2 pr-4 text-right">
                          ₹{Number(s.amount).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {s.due_date ? new Date(s.due_date).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td className="py-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteStructure(s.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
