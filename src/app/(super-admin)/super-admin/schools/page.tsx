'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Plus, Building2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { TableSkeleton } from '@/components/loaders/page-loaders'
import { getSchools, getPlanPricing, type SchoolRow } from '../actions'
import { PLAN_LABEL, STATUS_LABEL, DEFAULT_PLAN_PRICE, monthlyRevenueForSchool, type PlanPriceMap } from '@/lib/subscription'
import { getErrorMessage } from '@/lib/utils'
import { toast } from 'sonner'
import * as xlsx from 'xlsx'

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-500/15 text-green-400 border-green-500/20',
  trial: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  suspended: 'bg-red-500/15 text-red-400 border-red-500/20',
}

export default function SchoolsPage() {
  const [schools, setSchools] = useState<SchoolRow[]>([])
  const [prices, setPrices] = useState<PlanPriceMap>(DEFAULT_PLAN_PRICE)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([getSchools(), getPlanPricing()])
      .then(([s, p]) => {
        setSchools(s)
        setPrices(p)
      })
      .catch((e) => toast.error('Failed to load schools: ' + getErrorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!search) return schools
    const term = search.toLowerCase()
    return schools.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.code.toLowerCase().includes(term) ||
        (s.email ?? '').toLowerCase().includes(term) ||
        (s.city ?? '').toLowerCase().includes(term)
    )
  }, [schools, search])

  function handleExport() {
    if (schools.length === 0) {
      toast.error('No schools to export.')
      return
    }
    const rows = schools.map((s) => ({
      Name: s.name,
      Code: s.code,
      Plan: PLAN_LABEL[s.subscription_plan],
      Status: STATUS_LABEL[s.subscription_status],
      'Monthly Revenue (INR)': monthlyRevenueForSchool(s.subscription_plan, s.subscription_status, prices),
      'List Price (INR)': prices[s.subscription_plan],
      Email: s.email ?? '',
      Phone: s.phone ?? '',
      City: s.city ?? '',
      State: s.state ?? '',
      'Created': new Date(s.created_at).toLocaleDateString('en-IN'),
    }))
    const ws = xlsx.utils.json_to_sheet(rows)
    const wb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(wb, ws, 'Schools')
    xlsx.writeFile(wb, `edunexus_schools_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Schools</h2>
          <p className="text-muted-foreground">All tenants on the EduNexus platform.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={loading || schools.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Link href="/super-admin/schools/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add School
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b pb-3">
          <div className="flex max-w-sm items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              placeholder="Search by name, code, email, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton rows={6} columns={5} aria-label="Loading schools" />
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">{search ? 'No schools match your search.' : 'No schools yet.'}</h3>
              {!search && (
                <p className="mt-1 text-sm text-muted-foreground">Onboard your first school to get started.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-medium">School</th>
                    <th className="px-6 py-3 font-medium">Code</th>
                    <th className="px-6 py-3 font-medium">Plan</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((s) => (
                    <tr key={s.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-6 py-4">
                        <Link href={`/super-admin/schools/${s.id}` as never} className="font-medium text-blue-400 hover:underline">
                          {s.name}
                        </Link>
                        {s.email && <p className="text-xs text-muted-foreground">{s.email}</p>}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{s.code}</td>
                      <td className="px-6 py-4">{PLAN_LABEL[s.subscription_plan]}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_BADGE[s.subscription_status]}`}>
                          {STATUS_LABEL[s.subscription_status]}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {[s.city, s.state].filter(Boolean).join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
