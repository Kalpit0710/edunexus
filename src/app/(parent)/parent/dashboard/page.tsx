'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState } from 'react'
import {
  getParentChildData,
  getChildAttendanceSummary,
  getChildFeeStatus,
  type ParentChildData,
  type ChildAttendanceSummary,
  type ChildFeeStatus,
} from '../actions'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { GraduationCap, CalendarCheck, IndianRupee, Receipt, AlertCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function ParentDashboardPage() {
  const { user, school, activeChildId } = useAuthStore()
  const now = new Date()

  const [child, setChild] = useState<ParentChildData | null>(null)
  const [attendance, setAttendance] = useState<ChildAttendanceSummary | null>(null)
  const [feeStatus, setFeeStatus] = useState<ChildFeeStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!user?.email || !school?.id) return
    setLoading(true)
    setNotFound(false)
    getParentChildData(user.email, school.id, activeChildId)
      .then(childData => {
        if (!childData) { setNotFound(true); setLoading(false); return }
        setChild(childData)
        return Promise.all([
          getChildAttendanceSummary(childData.id, school.id, now.getMonth() + 1, now.getFullYear()),
          getChildFeeStatus(childData.id, school.id),
        ])
      })
      .then(res => {
        if (res) {
          setAttendance(res[0])
          setFeeStatus(res[1])
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user?.email, school?.id, activeChildId])

  if (loading) {
    return (
      <div className="p-5 space-y-5 animate-fade-in">
        <Skeleton className="h-10 w-48 bg-white/5 rounded-xl" />
        <div className="grid gap-3 grid-cols-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl bg-white/5" />)}
        </div>
      </div>
    )
  }

  if (notFound || !child) {
    return (
      <div className="p-8 flex flex-col items-center gap-4 mt-16 animate-fade-in">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <AlertCircle className="h-8 w-8 text-zinc-500" />
        </div>
        <h2 className="text-xl font-semibold text-white">No Student Linked</h2>
        <p className="text-center max-w-sm text-sm text-zinc-500">
          We couldn&apos;t find a student linked to your account email ({user?.email}).
          Please contact the school administrator.
        </p>
      </div>
    )
  }

  const attendancePct = attendance?.percentage ?? 0

  return (
    <div className="p-5 space-y-5 animate-fade-in">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Parent Portal</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Child info card */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-600/10 via-blue-500/5 to-transparent p-5">
        <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl border border-blue-500/20 bg-blue-600/15 flex items-center justify-center shrink-0">
            <GraduationCap className="h-7 w-7 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{child.fullName}</h2>
            <p className="text-zinc-500 text-xs">Adm: <span className="font-mono font-medium text-zinc-300">{child.admissionNumber}</span></p>
            <div className="flex gap-2 mt-1.5">
              <span className="inline-flex items-center rounded-full border border-blue-500/25 bg-blue-600/10 px-2.5 py-0.5 text-xs font-medium text-blue-300">
                {child.className}
              </span>
              {child.sectionName && (
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
                  {child.sectionName}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid gap-3 grid-cols-2">
        {[
          { label: 'Present Days', value: attendance?.presentDays ?? 0, sub: `of ${attendance?.totalDays ?? 0} days this month`, accent: '#10b981', icon: CalendarCheck },
          { label: 'Absent Days', value: attendance?.absentDays ?? 0, sub: 'this month', accent: (attendance?.absentDays ?? 0) > 3 ? '#ef4444' : '#6b7280', icon: CalendarCheck },
          { label: 'Total Fee', value: `₹${feeStatus?.totalFee.toLocaleString('en-IN') ?? 0}`, sub: 'academic year', accent: '#3b82f6', icon: IndianRupee },
          { label: 'Balance Due', value: `₹${feeStatus?.balance.toLocaleString('en-IN') ?? 0}`, sub: feeStatus?.balance === 0 ? '✓ All paid up!' : 'outstanding', accent: feeStatus && feeStatus.balance > 0 ? '#ef4444' : '#10b981', icon: IndianRupee },
        ].map(card => (
          <div key={card.label} className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
            <div className="pointer-events-none absolute -right-3 -top-3 h-20 w-20 rounded-full blur-2xl opacity-15" style={{ backgroundColor: card.accent }} />
            <div className="relative">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{card.label}</p>
                <div className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ backgroundColor: `${card.accent}14`, color: card.accent }}>
                  <card.icon className="h-3.5 w-3.5" />
                </div>
              </div>
              <p className="text-xl font-bold text-white">{card.value}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Attendance bar */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-blue-500/25 bg-blue-600/10">
              <CalendarCheck className="h-4 w-4 text-blue-400" />
            </div>
            <p className="text-sm font-semibold text-white">Attendance This Month</p>
          </div>
          <Link href="/parent/attendance" className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors">
            View <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-400">Monthly Rate</span>
          <span className={`text-sm font-bold ${attendancePct >= 75 ? 'text-emerald-400' : attendancePct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
            {attendancePct}%
          </span>
        </div>
        {/* Custom dark progress bar */}
        <div className="h-2 w-full rounded-full bg-white/10">
          <div
            className="h-2 rounded-full transition-all duration-500"
            style={{
              width: `${attendancePct}%`,
              background: attendancePct >= 75 ? '#10b981' : attendancePct >= 50 ? '#f59e0b' : '#ef4444',
            }}
          />
        </div>
        {attendancePct < 75 && (
          <p className="text-xs text-red-400 flex items-center gap-1 mt-2">
            <AlertCircle className="h-3.5 w-3.5" />
            Below 75% threshold. Please ensure regular attendance.
          </p>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/parent/results">
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all cursor-pointer">
            <span className="text-2xl">📘</span>
            <div>
              <p className="text-sm font-semibold text-white">Exam Results</p>
              <p className="text-xs text-zinc-500">View marks & grades</p>
            </div>
          </div>
        </Link>
        <Link href="/parent/announcements">
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all cursor-pointer">
            <span className="text-2xl">📢</span>
            <div>
              <p className="text-sm font-semibold text-white">Announcements</p>
              <p className="text-xs text-zinc-500">School notices</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent payments */}
      {feeStatus && feeStatus.recentPayments.length > 0 && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-2">
            <Receipt className="h-3.5 w-3.5 text-emerald-400" /> Recent Payments
          </p>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Receipt</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Date</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                {feeStatus.recentPayments.map(p => (
                  <tr key={p.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-zinc-400">{p.receipt_number}</td>
                    <td className="px-4 py-2.5 text-zinc-500 text-xs">
                      {new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-emerald-400 text-xs">
                      ₹{Number(p.paid_amount).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
