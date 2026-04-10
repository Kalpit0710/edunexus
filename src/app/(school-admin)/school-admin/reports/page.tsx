'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState } from 'react'
import {
  getAttendanceSummaryByClass,
  getExamAnalyticsSummary,
  getFeeCollectionSummary,
  getFeeMomentumSummary,
  getStudentEnrollmentStats,
  getWeeklyCollectionTrend,
  type ClassAttendanceSummary,
  type ExamAnalyticsSummary,
  type FeeCollectionSummary,
  type FeeMomentumSummary,
  type EnrollmentStat,
} from './actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, LineChart, Line } from 'recharts'
import { Users, CalendarCheck, IndianRupee, TrendingUp, TrendingDown, Activity } from 'lucide-react'

export default function ReportsPage() {
  const { school } = useAuthStore()
  const now = new Date()
  const [month] = useState(now.getMonth() + 1)
  const [year] = useState(now.getFullYear())

  const [attendance, setAttendance] = useState<ClassAttendanceSummary[]>([])
  const [feeSummary, setFeeSummary] = useState<FeeCollectionSummary | null>(null)
  const [feeMomentum, setFeeMomentum] = useState<FeeMomentumSummary | null>(null)
  const [collectionTrend, setCollectionTrend] = useState<{ date: string; amount: number }[]>([])
  const [examAnalytics, setExamAnalytics] = useState<ExamAnalyticsSummary | null>(null)
  const [enrollment, setEnrollment] = useState<EnrollmentStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!school?.id) return
    Promise.all([
      getAttendanceSummaryByClass(school.id, month, year),
      getFeeCollectionSummary(school.id),
      getFeeMomentumSummary(school.id),
      getWeeklyCollectionTrend(school.id),
      getExamAnalyticsSummary(school.id),
      getStudentEnrollmentStats(school.id),
    ])
      .then(([att, fee, momentum, trend, analytics, enr]) => {
        setAttendance(att)
        setFeeSummary(fee)
        setFeeMomentum(momentum)
        setCollectionTrend(trend)
        setExamAnalytics(analytics)
        setEnrollment(enr)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [school?.id])

  const totalStudents = enrollment.reduce((s, e) => s + e.total, 0)
  const totalMale = enrollment.reduce((s, e) => s + e.maleCount, 0)
  const totalFemale = enrollment.reduce((s, e) => s + e.femaleCount, 0)
  const averageAttendance = attendance.length
    ? Math.round(attendance.reduce((sum, row) => sum + row.percentage, 0) / attendance.length)
    : 0
  const lowAttendanceClasses = attendance.filter((row) => row.percentage < 75).length
  const bestAttendanceClass = attendance.length
    ? attendance.reduce((best, row) => (row.percentage > best.percentage ? row : best), attendance[0]!)
    : null
  const trendDirectionUp = (feeMomentum?.growthPercentage ?? 0) >= 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports & Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Overview for {now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* ── Fee Summary ────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <IndianRupee className="h-5 w-5 text-emerald-500" />
          Fee Collection (Current Academic Year)
        </h2>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Fee (Structures)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">₹{feeSummary?.totalFee.toLocaleString('en-IN') ?? 0}</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-200 dark:border-emerald-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Collected</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  ₹{feeSummary?.totalCollected.toLocaleString('en-IN') ?? 0}
                </p>
                <Progress
                  value={feeSummary?.collectionPercentage ?? 0}
                  className="h-1.5 mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">{feeSummary?.collectionPercentage ?? 0}% collected</p>
              </CardContent>
            </Card>
            <Card className="border-destructive/30 dark:border-destructive/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-destructive">Outstanding</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-destructive">
                  ₹{feeSummary?.totalOutstanding.toLocaleString('en-IN') ?? 0}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      {/* ── Exam Analytics (Milestone 2.5 Slice 2) ───────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-cyan-500" />
          Exam Performance Analytics
        </h2>
        {loading ? (
          <div className="grid gap-4 xl:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
          </div>
        ) : !examAnalytics || (
          examAnalytics.passRateTrend.length === 0 &&
          examAnalytics.subjectDifficulty.length === 0 &&
          examAnalytics.classComparison.length === 0
        ) ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No exam analytics available yet. Publish exams and enter marks to unlock insights.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Pass-Rate Trend (Recent Exams)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={examAnalytics?.passRateTrend ?? []}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="examName" tick={{ fontSize: 10 }} interval={0} angle={-15} height={50} textAnchor="end" />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip formatter={(v: number) => [`${v}%`, 'Pass Rate']} />
                    <Line type="monotone" dataKey="passRate" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Subject Difficulty (Lowest Pass Rate)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={examAnalytics?.subjectDifficulty ?? []} layout="vertical" margin={{ left: 18 }}>
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis dataKey="subjectName" type="category" width={95} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => [`${v}%`, 'Pass Rate']} />
                    <Bar dataKey="passRate" fill="#f97316" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Class Comparison (Avg Score %)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={examAnalytics?.classComparison ?? []}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="className" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip formatter={(v: number) => [`${v}%`, 'Average Score']} />
                    <Bar dataKey="averagePercentage" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      {/* ── Advanced Analytics Insights (Milestone 2.5) ───────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Activity className="h-5 w-5 text-amber-500" />
          Advanced Insights
        </h2>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">7-Day Collection Momentum</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {trendDirectionUp ? (
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  <p className={`text-xl font-bold ${trendDirectionUp ? 'text-emerald-500' : 'text-red-500'}`}>
                    {feeMomentum?.growthPercentage ?? 0}%
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Compared to previous 7 days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Daily Collection (7D)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">₹{(feeMomentum?.averageDailyCurrentWeek ?? 0).toLocaleString('en-IN')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Attendance Risk Monitor</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{lowAttendanceClasses}</p>
                <p className="text-xs text-muted-foreground mt-1">Classes below 75% attendance this month</p>
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      {/* ── Collection Trend ─────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <IndianRupee className="h-5 w-5 text-emerald-500" />
          Daily Fee Collection Trend (Last 7 Days)
        </h2>
        {loading ? (
          <Skeleton className="h-72 w-full rounded-xl" />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={collectionTrend} margin={{ left: 8, right: 8, top: 4 }}>
                  <defs>
                    <linearGradient id="collectionFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => new Date(v as string).toLocaleDateString('en-IN', { weekday: 'short' })}
                  />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${Number(v) / 1000}k`} />
                  <Tooltip
                    formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Collected']}
                    labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#10b981" fill="url(#collectionFill)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
              {bestAttendanceClass && (
                <p className="text-xs text-muted-foreground mt-3">
                  Best monthly attendance: <span className="font-medium text-foreground">{bestAttendanceClass.className} - {bestAttendanceClass.sectionName}</span> ({bestAttendanceClass.percentage}%).
                  School-wide monthly average: <span className="font-medium text-foreground">{averageAttendance}%</span>.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── Attendance Summary ────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-blue-500" />
          Attendance by Class ({now.toLocaleDateString('en-IN', { month: 'long' })})
        </h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full rounded-md" />)}
          </div>
        ) : attendance.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No attendance data recorded this month yet.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                    <tr>
                      <th className="px-6 py-3 font-medium text-left">Class / Section</th>
                      <th className="px-6 py-3 font-medium text-right">Students</th>
                      <th className="px-6 py-3 font-medium text-right">Present Days</th>
                      <th className="px-6 py-3 font-medium text-left">Attendance %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {attendance.map((row, i) => (
                      <tr key={i} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-3 font-medium">
                          {row.className}
                          {row.sectionName && <span className="text-muted-foreground ml-1">- {row.sectionName}</span>}
                        </td>
                        <td className="px-6 py-3 text-right text-muted-foreground">{row.totalStudents}</td>
                        <td className="px-6 py-3 text-right text-muted-foreground">{row.presentCount}</td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <Progress value={row.percentage} className="h-2 flex-1 max-w-[120px]" />
                            <Badge
                              variant={row.percentage >= 75 ? 'default' : row.percentage >= 50 ? 'secondary' : 'destructive'}
                              className="text-xs"
                            >
                              {row.percentage}%
                            </Badge>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── Enrollment Stats ──────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Users className="h-5 w-5 text-purple-500" />
          Student Enrollment by Class
        </h2>
        {loading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : enrollment.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No enrolled students found.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Class-wise Enrollment</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={enrollment} margin={{ left: -10 }}>
                    <XAxis dataKey="className" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip formatter={(v: number) => [v, 'Students']} />
                    <Bar dataKey="maleCount" name="Male" fill="#6366f1" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="femaleCount" name="Female" fill="#ec4899" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 justify-center mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" /> Male</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-pink-500 inline-block" /> Female</span>
                </div>
              </CardContent>
            </Card>
            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Overall Enrollment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Total Students</span>
                  <span className="font-bold text-lg">{totalStudents}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Male</span>
                  <span className="font-semibold">{totalMale} ({totalStudents ? Math.round(totalMale / totalStudents * 100) : 0}%)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Female</span>
                  <span className="font-semibold">{totalFemale} ({totalStudents ? Math.round(totalFemale / totalStudents * 100) : 0}%)</span>
                </div>
                <div className="border-t pt-3 space-y-2">
                  {enrollment.map((e, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{e.className}</span>
                      <Badge variant="secondary">{e.total} students</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </section>
    </div>
  )
}
