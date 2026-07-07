'use server'

import { unstable_cache } from 'next/cache'
import { createClient as getSupabase } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'

type PaymentAmountRow = Pick<Database['public']['Tables']['fee_payments']['Row'], 'paid_amount'>
type FeeStructureAmountRow = Pick<Database['public']['Tables']['fee_structures']['Row'], 'amount'>

export interface DashboardStats {
  totalStudents: number
  activeTeachers: number
  classCount: number
  todayCollection: number
  totalPendingFees: number
  todayAttendancePct: number
  needsOnboarding: boolean
}

async function getDashboardStatsUncached(
  schoolId: string,
  today: string,
): Promise<DashboardStats> {
  const supabase = await getSupabase()

  const [
    studentsRes,
    teachersRes,
    classesRes,
    collectionRes,
    yearsRes,
    presentRes,
    totalMarkedRes,
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true),
    supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true),
    supabase.from('classes').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase.from('fee_payments').select('paid_amount').eq('school_id', schoolId).eq('payment_date', today),
    supabase.from('academic_years').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase.from('attendance_records').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('date', today).eq('status', 'present'),
    supabase.from('attendance_records').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('date', today),
  ])

  const totalStudents = studentsRes.count ?? 0
  const activeTeachers = teachersRes.count ?? 0
  const classCount = classesRes.count ?? 0
  const todayCollection = (collectionRes.data as PaymentAmountRow[] | null ?? []).reduce(
    (sum, row) => sum + Number(row.paid_amount ?? 0),
    0,
  )
  const needsOnboarding = (classesRes.count ?? 0) === 0 && (yearsRes.count ?? 0) === 0
  const presentCount = presentRes.count ?? 0
  const totalMarked = totalMarkedRes.count ?? 0
  const todayAttendancePct = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 0

  // Pending fees calculation
  const paymentsRes = await supabase.from('fee_payments').select('paid_amount').eq('school_id', schoolId)
  const totalPaid = (paymentsRes.data as PaymentAmountRow[] | null ?? []).reduce(
    (sum, row) => sum + Number(row.paid_amount ?? 0),
    0,
  )
  const yearRes = await supabase.from('academic_years').select('id').eq('school_id', schoolId).eq('is_current', true).single()
  let totalFee = 0
  if (yearRes.data?.id) {
    const structRes = await supabase
      .from('fee_structures')
      .select('amount')
      .eq('school_id', schoolId)
      .eq('academic_year_id', yearRes.data.id)
      .eq('is_active', true)
    totalFee = (structRes.data as FeeStructureAmountRow[] | null ?? []).reduce(
      (sum, row) => sum + Number(row.amount ?? 0),
      0,
    )
  }
  const totalPendingFees = Math.max(0, totalFee - totalPaid)

  return { totalStudents, activeTeachers, classCount, todayCollection, totalPendingFees, todayAttendancePct, needsOnboarding }
}

const getDashboardStatsCached = unstable_cache(getDashboardStatsUncached, ['school-dashboard-stats'], {
  revalidate: 60,
})

export async function getDashboardStats(
  schoolId: string,
  today: string,
): Promise<DashboardStats> {
  return getDashboardStatsCached(schoolId, today)
}

async function getWeeklyCollectionTrendUncached(
  schoolId: string,
): Promise<{ date: string; label: string; amount: number }[]> {
  const supabase = await getSupabase()
  const days: { date: string; label: string; amount: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]!
    const label = d.toLocaleDateString('en-IN', { weekday: 'short' })
    const { data } = await supabase.from('fee_payments').select('paid_amount').eq('school_id', schoolId).eq('payment_date', dateStr)
    const amount = (data as PaymentAmountRow[] | null ?? []).reduce(
      (sum, row) => sum + Number(row.paid_amount ?? 0),
      0,
    )
    days.push({ date: dateStr, label, amount })
  }
  return days
}

const getWeeklyCollectionTrendCached = unstable_cache(getWeeklyCollectionTrendUncached, ['school-dashboard-weekly-trend'], {
  revalidate: 60,
})

export async function getWeeklyCollectionTrend(
  schoolId: string,
): Promise<{ date: string; label: string; amount: number }[]> {
  return getWeeklyCollectionTrendCached(schoolId)
}
