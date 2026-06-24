'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trash2, Plus } from 'lucide-react'
import { getSchoolSettings, updateSchoolSettings } from '../actions'
import {
  getCoScholasticAreas,
  addCoScholasticArea,
  deleteCoScholasticArea,
  type CoScholasticAreaRow,
} from '@/app/(school-admin)/school-admin/report-cards/actions'
import { STANDARD_TERM1_FIELDS, STANDARD_TERM2_FIELDS } from '@/lib/report-card-utils'

// Unique component keys across both terms (periodicTest/notebook/subEnrichment are shared).
const COMPONENT_FIELDS = [
  ...STANDARD_TERM1_FIELDS,
  ...STANDARD_TERM2_FIELDS.filter((f) => !STANDARD_TERM1_FIELDS.some((t) => t.key === f.key)),
]

export function ReportCardTab() {
  const { school } = useAuthStore()
  const sid = school?.id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rule, setRule] = useState<'average' | 'sum'>('average')
  const [labels, setLabels] = useState<Record<string, string>>({})
  const [areas, setAreas] = useState<CoScholasticAreaRow[]>([])
  const [newArea, setNewArea] = useState('')

  const load = useCallback(async () => {
    if (!sid) return
    setLoading(true)
    try {
      const [settings, areaList] = await Promise.all([getSchoolSettings(sid), getCoScholasticAreas(sid)])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = settings as any
      setRule(s?.report_grand_total_rule === 'sum' ? 'sum' : 'average')
      setLabels((s?.scholastic_component_labels ?? {}) as Record<string, string>)
      setAreas(areaList)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [sid])

  useEffect(() => {
    if (sid) load()
  }, [load, sid])

  async function save() {
    if (!sid) return
    setSaving(true)
    try {
      await updateSchoolSettings(sid, {
        report_grand_total_rule: rule,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        scholastic_component_labels: labels as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      toast.success('Report card settings saved')
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function addArea(e: React.FormEvent) {
    e.preventDefault()
    if (!sid || !newArea.trim()) return
    try {
      await addCoScholasticArea(sid, newArea)
      setNewArea('')
      toast.success('Area added')
      load()
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  async function removeArea(id: string) {
    try {
      await deleteCoScholasticArea(id)
      toast.success('Area removed')
      load()
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  if (loading) return <div className="py-8 text-sm text-muted-foreground">Loading report card settings…</div>

  return (
    <div className="space-y-8">
      {/* Grand total rule */}
      <div className="space-y-3">
        <h3 className="text-lg font-medium">Grand Total Rule (Standard Classes)</h3>
        <p className="text-sm text-muted-foreground">
          How each subject&apos;s grand total is computed from the two terms.
        </p>
        <div className="flex gap-3">
          <Button type="button" variant={rule === 'average' ? 'default' : 'outline'} onClick={() => setRule('average')}>
            Average of terms
          </Button>
          <Button type="button" variant={rule === 'sum' ? 'default' : 'outline'} onClick={() => setRule('sum')}>
            Sum of terms
          </Button>
        </div>
      </div>

      {/* Component labels */}
      <div className="space-y-3">
        <h3 className="text-lg font-medium">Scholastic Component Labels</h3>
        <p className="text-sm text-muted-foreground">
          Rename the standard mark components shown on report cards and marks entry. Leave blank for the default.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {COMPONENT_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`lbl-${f.key}`}>{f.label}</Label>
              <Input
                id={`lbl-${f.key}`}
                value={labels[f.key] ?? ''}
                placeholder={f.label}
                onChange={(e) => setLabels((p) => ({ ...p, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </div>

      <Button onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save report card settings'}
      </Button>

      {/* Co-scholastic areas */}
      <div className="space-y-3 border-t pt-6">
        <h3 className="text-lg font-medium">Co-Scholastic Areas</h3>
        <p className="text-sm text-muted-foreground">
          Add custom areas, or leave empty to use the defaults (Health &amp; Physical Education, Art Education, Work
          Education).
        </p>
        <form onSubmit={addArea} className="flex gap-2">
          <Input value={newArea} onChange={(e) => setNewArea(e.target.value)} placeholder="e.g. Discipline" />
          <Button type="submit">
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </form>
        <div className="space-y-2">
          {areas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Using default areas.</p>
          ) : (
            areas.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-sm">{a.name}</span>
                <Button variant="ghost" size="icon" onClick={() => removeArea(a.id)}>
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
