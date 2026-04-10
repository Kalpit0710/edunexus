'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState } from 'react'
import { getManagerDashboardStats, type ManagerDashboardStats } from './actions'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import Link from 'next/link'
import {
  IndianRupee, Receipt, AlertCircle, Package, TrendingUp,
  ShoppingCart, ArrowRight, Users
} from 'lucide-react'

const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: 'Cash', cheque: 'Cheque', upi: 'UPI',
  neft: 'NEFT/RTGS', card: 'Card', online: 'Online',
}

const EMPTY_STATS: ManagerDashboardStats = {
  todayCollection: 0, paymentCount: 0, pendingFeeCount: 0,
  inventoryItemCount: 0, lowStockCount: 0, weeklyTrend: [], paymentModeBreakdown: [], classPendingRisk: [],
}

export default function ManagerDashboardPage() {
  const { user, school } = useAuthStore()
  const [stats, setStats] = useState<ManagerDashboardStats>(EMPTY_STATS)
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().split('T')[0]!

  useEffect(() => {
    if (!school?.id) return
    getManagerDashboardStats(school.id, today)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [school?.id])

  const todayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  const fullName = (user?.user_metadata?.full_name as string) || 'Manager'

  const statCards = [
    {
      label: "Today's Collection",
      value: `₹${stats.todayCollection.toLocaleString('en-IN')}`,
      icon: IndianRupee,
      href: '/manager/dashboard',
      accent: '#10b981',
    },
    {
      label: 'Transactions Today',
      value: stats.paymentCount,
      icon: Receipt,
      href: '/manager/dashboard',
      accent: '#3b82f6',
    },
    {
      label: 'Pending Fee Students',
      value: stats.pendingFeeCount,
      icon: AlertCircle,
      href: '/school-admin/fees/pending',
      accent: stats.pendingFeeCount > 0 ? '#ef4444' : '#6b7280',
    },
    {
      label: 'Inventory Items',
      value: stats.inventoryItemCount,
      icon: Package,
      href: '/manager/inventory',
      accent: '#8b5cf6',
    },
    {
      label: 'Low Stock Alerts',
      value: stats.lowStockCount,
      icon: AlertCircle,
      href: '/manager/inventory',
      accent: stats.lowStockCount > 0 ? '#f59e0b' : '#6b7280',
    },
  ]

  const quickActions = [
    { href: '/school-admin/fees/collect', label: 'Collect Fee', icon: IndianRupee },
    { href: '/manager/inventory/pos', label: 'Inventory POS', icon: ShoppingCart },
    { href: '/school-admin/fees/pending', label: 'Pending Fees', icon: AlertCircle },
    { href: '/manager/inventory', label: 'Inventory', icon: Package },
    { href: '/school-admin/students', label: 'Students', icon: Users },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-emerald-600/10 via-emerald-500/5 to-transparent p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-emerald-600/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-600/10 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-300 uppercase tracking-wider">{todayLabel}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Welcome, {fullName} 👋</h1>
            <p className="text-sm text-zinc-400 mt-1">{school?.name}</p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-600/15">
            <IndianRupee className="h-6 w-6 text-emerald-400" />
          </div>
        </div>
      </div>

      {/* Low stock warning banner */}
      {!loading && stats.lowStockCount > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15">
              <AlertCircle className="h-5 w-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white">Low Stock Alert</p>
              <p className="text-sm text-zinc-400 mt-0.5">
                {stats.lowStockCount} item{stats.lowStockCount > 1 ? 's are' : ' is'} running low on stock.
              </p>
            </div>
            <Link href={'/manager/inventory' as any} className="shrink-0">
              <Button className="rounded-full bg-amber-500 text-[#0a0a0a] hover:bg-amber-400 text-sm font-semibold">
                Review Stock
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl bg-white/5" />)
          : statCards.map(card => (
            <Link key={card.label} href={card.href as any}>
              <div className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200 cursor-pointer hover:-translate-y-0.5">
                <div
                  className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full blur-2xl opacity-20 transition-opacity group-hover:opacity-40"
                  style={{ backgroundColor: card.accent }}
                />
                <div className="relative">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{card.label}</p>
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-xl border"
                      style={{ backgroundColor: `${card.accent}14`, borderColor: `${card.accent}30`, color: card.accent }}
                    >
                      <card.icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-white">{card.value}</p>
                </div>
              </div>
            </Link>
          ))}
      </div>

      {/* Weekly collection trend */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Fee Collection Trend</p>
            <p className="text-xs text-zinc-500">Last 7 days</p>
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-48 w-full rounded-xl bg-white/5" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats.weeklyTrend} margin={{ left: -10, right: 10 }}>
              <defs>
                <linearGradient id="mgCollectionGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: '#71717a' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => v > 0 ? `₹${(v / 1000).toFixed(0)}k` : '₹0'}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '13px',
                }}
                formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Collected']}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#mgCollectionGrad)"
                dot={{ fill: '#10b981', strokeWidth: 0, r: 3 }}
                activeDot={{ fill: '#10b981', r: 4, strokeWidth: 2, stroke: 'rgba(16,185,129,0.3)' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Today's transactions */}
      {!loading && stats.paymentCount > 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Today&apos;s Transactions</p>
            <span className="text-xs text-zinc-500">{stats.paymentCount} payment{stats.paymentCount !== 1 ? 's' : ''}</span>
          </div>
          <p className="text-sm text-zinc-500">
            Total collected today:{' '}
            <span className="font-bold text-emerald-400">₹{stats.todayCollection.toLocaleString('en-IN')}</span>
          </p>
        </div>
      )}

      {/* Financial drilldowns */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
          <p className="text-sm font-semibold text-white mb-4">Payment Mode Mix (Last 7 Days)</p>
          {loading ? (
            <Skeleton className="h-36 w-full rounded-xl bg-white/5" />
          ) : stats.paymentModeBreakdown.length === 0 ? (
            <p className="text-xs text-zinc-500">No payment mix data yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.paymentModeBreakdown.map((item) => (
                <div key={item.mode} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <span className="text-xs uppercase tracking-wider text-zinc-400">{PAYMENT_MODE_LABELS[item.mode] ?? item.mode}</span>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-white">₹{item.amount.toLocaleString('en-IN')}</p>
                    <p className="text-[10px] text-zinc-500">{item.count} txns</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
          <p className="text-sm font-semibold text-white mb-4">Pending Fee Risk by Class</p>
          {loading ? (
            <Skeleton className="h-36 w-full rounded-xl bg-white/5" />
          ) : stats.classPendingRisk.length === 0 ? (
            <p className="text-xs text-zinc-500">No class-level pending fee risk right now.</p>
          ) : (
            <div className="space-y-2">
              {stats.classPendingRisk.map((item) => (
                <div key={item.className} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <span className="text-xs text-zinc-300">{item.className}</span>
                  <span className={`text-xs font-semibold ${item.pendingStudents >= 10 ? 'text-red-400' : 'text-amber-400'}`}>
                    {item.pendingStudents} students
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Quick Actions</p>
        <div className="flex flex-wrap gap-2">
          {quickActions.map(action => (
            <Link key={action.href} href={action.href as any}>
              <Button
                variant="outline"
                className="gap-2 rounded-full border-white/[0.08] bg-white/[0.04] text-zinc-300 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.14] transition-all text-sm"
              >
                <action.icon className="h-3.5 w-3.5 text-emerald-400" />
                {action.label}
                <ArrowRight className="h-3 w-3 opacity-50" />
              </Button>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
