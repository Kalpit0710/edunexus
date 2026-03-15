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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
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
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (notFound || !child) {
    return (
      <div className="p-8 flex flex-col items-center gap-4 text-muted-foreground mt-16">
        <AlertCircle className="h-12 w-12 opacity-40" />
        <h2 className="text-xl font-semibold text-foreground">No Student Linked</h2>
        <p className="text-center max-w-sm text-sm">
          We couldn&apos;t find a student linked to your account email ({user?.email}).
          Please contact the school administrator.
        </p>
      </div>
    )
  }

  const attendancePct = attendance?.percentage ?? 0

  return (
    <div className="p-6 space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Parent Portal</h1>
        <p className="text-sm text-muted-foreground">
          {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Child info card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <GraduationCap className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{child.fullName}</h2>
              <p className="text-muted-foreground text-xs">Adm: <span className="font-mono font-medium text-foreground">{child.admissionNumber}</span></p>
              <div className="flex gap-2 mt-1.5">
                <Badge variant="default" className="text-xs">{child.className}</Badge>
                {child.sectionName && <Badge variant="secondary" className="text-xs">{child.sectionName}</Badge>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat grid */}
      <div className="grid gap-3 grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Present Days</CardTitle>
            <CalendarCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">{attendance?.presentDays ?? 0}</div>
            <p className="text-xs text-muted-foreground">of {attendance?.totalDays ?? 0} days this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Absent Days</CardTitle>
            <CalendarCheck className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className={`text-2xl font-bold ${(attendance?.absentDays ?? 0) > 3 ? 'text-destructive' : ''}`}>
              {attendance?.absentDays ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Fee</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">₹{feeStatus?.totalFee.toLocaleString('en-IN') ?? 0}</div>
            <p className="text-xs text-muted-foreground">academic year</p>
          </CardContent>
        </Card>

        <Card className={feeStatus && feeStatus.balance > 0 ? 'border-destructive/30' : 'border-emerald-300/50'}>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Balance Due</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className={`text-2xl font-bold ${feeStatus && feeStatus.balance > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
              ₹{feeStatus?.balance.toLocaleString('en-IN') ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {feeStatus && feeStatus.balance === 0 ? '✓ All paid up!' : 'outstanding'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance progress */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-blue-500" /> Attendance This Month
            </CardTitle>
            <Link href="/parent/attendance" className="text-xs text-primary flex items-center gap-1 hover:underline">
              View calendar <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Monthly Rate</span>
            <Badge variant={attendancePct >= 75 ? 'default' : attendancePct >= 50 ? 'secondary' : 'destructive'}>
              {attendancePct}%
            </Badge>
          </div>
          <Progress value={attendancePct} className="h-2" />
          {attendancePct < 75 && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              Below 75% threshold. Please ensure regular attendance.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/parent/results">
          <Card className="hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <span className="text-2xl">📘</span>
              <div>
                <p className="text-sm font-semibold">Exam Results</p>
                <p className="text-xs text-muted-foreground">View marks & grades</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/parent/announcements">
          <Card className="hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <span className="text-2xl">📢</span>
              <div>
                <p className="text-sm font-semibold">Announcements</p>
                <p className="text-xs text-muted-foreground">School notices</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent payments */}
      {feeStatus && feeStatus.recentPayments.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-emerald-500" /> Recent Fee Payments
          </h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Receipt No</th>
                      <th className="px-4 py-2 text-left font-medium">Date</th>
                      <th className="px-4 py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {feeStatus.recentPayments.map(p => (
                      <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2 font-mono text-xs">{p.receipt_number}</td>
                        <td className="px-4 py-2 text-muted-foreground text-xs">
                          {new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-emerald-600 text-xs">
                          ₹{Number(p.paid_amount).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  )
}
