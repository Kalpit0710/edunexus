'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useAuthStore } from '@/stores/auth.store'
import { getParentFamilyStatement, type ParentFamilyStatement } from '../actions'
import { DataLoadError } from '@/components/shared/DataLoadError'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/utils'
import { ArrowRight, IndianRupee, Users } from 'lucide-react'

function formatCurrency(amount: number, symbol: string) {
  return `${symbol}${amount.toLocaleString('en-IN')}`
}

export default function ParentFamilyPage() {
  const { school } = useAuthStore()
  const [statement, setStatement] = useState<ParentFamilyStatement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const currencySymbol = school?.currency_symbol || '₹'

  const loadStatement = useCallback(async () => {
    if (!school?.id) return
    setLoading(true)
    setError(null)
    try {
      const data = await getParentFamilyStatement(school.id)
      setStatement(data)
    } catch (err) {
      setError(getErrorMessage(err))
      toast.error('Unable to load the family statement right now.')
    } finally {
      setLoading(false)
    }
  }, [school?.id])

  useEffect(() => {
    loadStatement()
  }, [loadStatement])

  if (loading) {
    return (
      <div className="space-y-5 p-5">
        <Skeleton className="h-10 w-56 rounded-xl bg-white/5" />
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl bg-white/5" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl bg-white/5" />
      </div>
    )
  }

  if (error) {
    return <DataLoadError title="Couldn’t load the family statement" message={error} onRetry={() => loadStatement()} retrying={loading} />
  }

  if (!statement) {
    return (
      <div className="mt-16 flex flex-col items-center gap-4 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <Users className="h-8 w-8 text-zinc-500" />
        </div>
        <h2 className="text-xl font-semibold text-white">No linked children found</h2>
        <p className="max-w-sm text-sm text-zinc-500">
          Once the school links your children to this account, your combined family fee summary will appear here.
        </p>
      </div>
    )
  }

  const summaryCards = [
    { label: 'Family Total Fee', value: formatCurrency(statement.totalFee, currencySymbol), accent: 'text-blue-300' },
    { label: 'Total Paid', value: formatCurrency(statement.totalPaid, currencySymbol), accent: 'text-emerald-300' },
    { label: 'Outstanding Balance', value: formatCurrency(statement.totalBalance, currencySymbol), accent: statement.totalBalance > 0 ? 'text-amber-300' : 'text-emerald-300' },
  ]

  return (
    <div className="space-y-5 p-5 animate-fade-in">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Family Statement</h1>
          <p className="text-sm text-zinc-500">Combined fee visibility for every linked child in this school.</p>
        </div>
        <p className="text-xs text-zinc-500">Updated {new Date(statement.generatedAt).toLocaleString('en-IN')}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{card.label}</p>
            <p className={`mt-3 text-2xl font-bold ${card.accent}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <Card className="border-white/[0.07] bg-white/[0.03] text-white">
        <CardHeader>
          <CardTitle className="text-lg">Child-wise breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {statement.children.map((child) => (
            <div key={child.studentId} className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white">{child.studentName}</p>
                    {child.balance > 0 ? <Badge variant="secondary">Due</Badge> : <Badge className="bg-emerald-600/20 text-emerald-300">Clear</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {child.className}
                    {child.sectionName ? ` · ${child.sectionName}` : ''}
                  </p>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-3 sm:text-right">
                  <div>
                    <p className="text-zinc-500">Total</p>
                    <p className="font-semibold text-zinc-200">{formatCurrency(child.totalFee, currencySymbol)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Paid</p>
                    <p className="font-semibold text-emerald-300">{formatCurrency(child.totalPaid, currencySymbol)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Balance</p>
                    <p className={`font-semibold ${child.balance > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                      {formatCurrency(child.balance, currencySymbol)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Link href={'/parent/fees' as Route}>
                  <Button variant="outline" className="gap-2 border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 hover:text-white">
                    View child fee details <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="rounded-2xl border border-blue-500/20 bg-blue-600/8 p-4 text-sm text-zinc-300">
        <div className="flex items-start gap-3">
          <IndianRupee className="mt-0.5 h-4 w-4 text-blue-300" />
          <p>
            This view rolls up arrears across all linked children so parents no longer need to switch child context to understand the full family balance.
          </p>
        </div>
      </div>
    </div>
  )
}