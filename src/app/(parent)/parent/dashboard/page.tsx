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
import { GraduationCap, CalendarCheck, IndianRupee, Receipt, AlertCircle } from 'lucide-react'

export default function ParentDashboardPage() {
  const { user, school } = useAuthStore()
  const now = new Date()

  const [child, setChild] = useState<ParentChildData | null>(null)
  const [attendance, setAttendance] = useState<ChildAttendanceSummary | null>(null)
  const [feeStatus, setFeeStatus] = useState<ChildFeeStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!user?.email || !school?.id) return
    setLoading(true)
    getParentChildData(user.email, school.id)
      .then(childData => {
        if (!childData) { setNotFound(true); return }
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
  }, [user?.email, school?.id])

  if (loading) {
    return (
      <div className="p-8 space-y-6">
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
          Please contact the school administrator to link your child&apos;s account.
        </p>
      </div>
    )
  }

  const attendancePct = attendance?.percentage ?? 0

  return (
    <div className="p-8 space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Parent Portal</h1>
        <p className="text-muted-foreground">
          {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Child info card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{child.fullName}</h2>
              <p className="text-muted-foreground text-sm">Admission No: <span className="font-mono font-medium text-foreground">{child.admissionNumber}</span></p>
              <div className="flex gap-2 mt-2">
                <Badge>{child.className}</Badge>
                {child.sectionName && <Badge variant="secondary">{child.sectionName}</Badge>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Present Days</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attendance?.presentDays ?? 0}</div>
            <p className="text-xs text-muted-foreground">of {attendance?.totalDays ?? 0} school days this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Absent Days</CardTitle>
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(attendance?.absentDays ?? 0) > 3 ? 'text-destructive' : ''}`}>
              {attendance?.absentDays ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Fee</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{feeStatus?.totalFee.toLocaleString('en-IN') ?? 0}</div>
            <p className="text-xs text-muted-foreground">current academic year</p>
          </CardContent>
        </Card>
        <Card className={feeStatus && feeStatus.balance > 0 ? 'border-destructive/30' : 'border-emerald-300/50'}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Balance Due</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
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
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-blue-500" />
            Attendance This Month
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Monthly Attendance Rate</span>
            <Badge variant={attendancePct >= 75 ? 'default' : attendancePct >= 50 ? 'secondary' : 'destructive'}>
              {attendancePct}%
            </Badge>
          </div>
          <Progress value={attendancePct} className="h-3" />
          {attendancePct < 75 && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              Attendance below 75% threshold. Please ensure regular attendance.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent payments */}
      {feeStatus && feeStatus.recentPayments.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-500" />
            Recent Fee Payments
          </h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left font-medium">Receipt No</th>
                      <th className="px-6 py-3 text-left font-medium">Date</th>
                      <th className="px-6 py-3 text-right font-medium">Amount Paid</th>
                      <th className="px-6 py-3 text-left font-medium">Mode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {feeStatus.recentPayments.map(p => (
                      <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3 font-mono text-xs">{p.receipt_number}</td>
                        <td className="px-6 py-3 text-muted-foreground">
                          {new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-3 text-right font-semibold text-emerald-600">
                          ₹{Number(p.paid_amount).toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-3 capitalize text-muted-foreground">{p.payment_mode}</td>
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
