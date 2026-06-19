'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InlineLoader } from '@/components/loaders/page-loaders'
import { DataLoadError } from '@/components/shared/DataLoadError'
import { GraduationCap, ArrowUp, AlertTriangle } from 'lucide-react'
import {
  getPromotionData,
  promoteStudents,
  type PromotionClassRow,
  type PromotionAcademicYear,
} from './actions'
import {
  computeDefaultPromotionMapping,
  type PromotionMapping,
} from '@/lib/promotion-utils'

const GRADUATE = '__graduate__'

export default function PromotionPage() {
  const { school } = useAuthStore()
  const [classes, setClasses] = useState<PromotionClassRow[]>([])
  const [years, setYears] = useState<PromotionAcademicYear[]>([])
  const [targets, setTargets] = useState<Record<string, string>>({}) // classId -> targetClassId | GRADUATE
  const [targetYearId, setTargetYearId] = useState<string>('')
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!school?.id) return
    setLoading(true)
    setError(null)
    try {
      const data = await getPromotionData(school.id)
      setClasses(data.classes)
      setYears(data.academicYears)

      // Seed the default mapping (next class up; top class graduates).
      const def = computeDefaultPromotionMapping(data.classes)
      const seeded: Record<string, string> = {}
      for (const m of def) seeded[m.fromClassId] = m.toClassId ?? GRADUATE
      setTargets(seeded)

      // Default target year = the first non-current year, if any.
      const nonCurrent = data.academicYears.find((y) => !y.is_current)
      setTargetYearId(nonCurrent?.id ?? '')
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [school?.id])

  useEffect(() => {
    if (school?.id) load()
  }, [load, school?.id])

  const totals = useMemo(() => {
    let promote = 0
    let graduate = 0
    for (const c of classes) {
      if (targets[c.id] === GRADUATE) graduate += c.activeStudents
      else promote += c.activeStudents
    }
    return { promote, graduate }
  }, [classes, targets])

  const canSubmit = confirmText === 'PROMOTE' && classes.length > 0 && !submitting

  async function handleSubmit() {
    if (!school?.id) return
    const mappings: PromotionMapping[] = classes.map((c) => ({
      fromClassId: c.id,
      toClassId: targets[c.id] === GRADUATE ? null : (targets[c.id] ?? null),
    }))
    setSubmitting(true)
    try {
      const res = await promoteStudents({
        schoolId: school.id,
        targetYearId: targetYearId || null,
        mappings,
        confirm: 'PROMOTE',
      })
      toast.success(`Promoted ${res.promoted} students · graduated ${res.graduated}.`)
      setConfirmText('')
      await load()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <InlineLoader label="Loading promotion setup..." />
  if (error) return <DataLoadError message={error} onRetry={load} />

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <GraduationCap className="h-6 w-6 text-blue-500" /> Year-End Promotion
        </h2>
        <p className="text-muted-foreground">
          Move every class up a grade for the new academic year. The final class graduates
          (its students are marked inactive). Sections are cleared so you can re-assign them after.
        </p>
      </div>

      {classes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No classes found. Add classes in Settings first.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Class promotion mapping</CardTitle>
              <CardDescription>
                Each class moves to the selected target. Choose “Graduate” for leaving students.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {classes.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm"
                >
                  <div className="min-w-[8rem] font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.activeStudents} student{c.activeStudents === 1 ? '' : 's'}
                  </div>
                  <ArrowUp className="h-4 w-4 text-muted-foreground" />
                  <select
                    aria-label={`Promote ${c.name} to`}
                    className="h-9 flex-1 min-w-[10rem] rounded-md border border-input bg-background px-3 text-sm"
                    value={targets[c.id] ?? GRADUATE}
                    onChange={(e) => setTargets((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  >
                    {classes
                      .filter((t) => t.id !== c.id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          → {t.name}
                        </option>
                      ))}
                    <option value={GRADUATE}>🎓 Graduate (mark inactive)</option>
                  </select>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">New current academic year</CardTitle>
              <CardDescription>
                Optionally make a different academic year current as part of the roll-over.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="promotion-year">Set current year to</Label>
                <select
                  id="promotion-year"
                  className="h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm"
                  value={targetYearId}
                  onChange={(e) => setTargetYearId(e.target.value)}
                >
                  <option value="">Leave unchanged</option>
                  {years.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                      {y.is_current ? ' (current)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-500/30 bg-amber-500/[0.03]">
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-start gap-3 text-sm">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div>
                  <p className="font-medium">
                    This will promote {totals.promote} and graduate {totals.graduate} student
                    {totals.promote + totals.graduate === 1 ? '' : 's'}.
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Promotions clear each student’s section (re-assign in Students afterwards).
                    Graduated students become inactive but are not deleted. This action runs in a
                    single transaction.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="promotion-confirm">
                  Type <span className="font-mono font-semibold">PROMOTE</span> to confirm
                </Label>
                <Input
                  id="promotion-confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="PROMOTE"
                  className="max-w-xs"
                  autoComplete="off"
                />
              </div>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {submitting ? 'Promoting…' : 'Run promotion'}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
