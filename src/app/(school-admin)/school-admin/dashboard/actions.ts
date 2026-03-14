'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database.types'

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(list: { name: string; value: string; options: CookieOptions }[]) {
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch { }
        },
      },
    }
  )
}

export interface DashboardStats {
  totalStudents: number
  activeTeachers: number
  classCount: number
  todayCollection: number
  totalPendingFees: number
  todayAttendancePct: number
  needsOnboarding: boolean
}

export async function getDashboardStats(
  schoolId: string,
  today: string,
): Promise<DashboardStats> {
  const supabase = await getSupabase()
  const db = supabase as any

  const [
    studentsRes,
    teachersRes,
    classesRes,
    collectionRes,
    yearsRes,
    presentRes,
    totalMarkedRes,
  ] = await Promise.all([
    db.from('students').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true),
    db.from('teachers').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true),
    db.from('classes').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
    db.from('fee_payments').select('paid_amount').eq('school_id', schoolId).eq('payment_date', today),
    db.from('academic_years').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
    db.from('attendance').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('date', today).eq('status', 'present'),
    db.from('attendance').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('date', today),
  ])

  const totalStudents = studentsRes.count ?? 0
  const activeTeachers = teachersRes.count ?? 0
  const classCount = classesRes.count ?? 0
  const todayCollection = ((collectionRes.data ?? []) as any[]).reduce(
    (s: number, r: any) => s + Number(r.paid_amount ?? 0), 0
  )
  const needsOnboarding = (classesRes.count ?? 0) === 0 && (yearsRes.count ?? 0) === 0
  const presentCount = presentRes.count ?? 0
  const totalMarked = totalMarkedRes.count ?? 0
  const todayAttendancePct = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 0

  // Pending fees calculation
  const paymentsRes = await db.from('fee_payments').select('paid_amount').eq('school_id', schoolId)
  const totalPaid = ((paymentsRes.data ?? []) as any[]).reduce((s: number, r: any) => s + Number(r.paid_amount ?? 0), 0)
  const yearRes = await db.from('academic_years').select('id').eq('school_id', schoolId).eq('is_current', true).single()
  let totalFee = 0
  if (yearRes.data?.id) {
    const structRes = await db.from('fee_structures').select('amount').eq('school_id', schoolId).eq('academic_year_id', yearRes.data.id).eq('is_active', true)
    totalFee = ((structRes.data ?? []) as any[]).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0)
  }
  const totalPendingFees = Math.max(0, totalFee - totalPaid)

  return { totalStudents, activeTeachers, classCount, todayCollection, totalPendingFees, todayAttendancePct, needsOnboarding }
}

export async function getWeeklyCollectionTrend(
  schoolId: string,
): Promise<{ date: string; label: string; amount: number }[]> {
  const supabase = await getSupabase()
  const db = supabase as any
  const days: { date: string; label: string; amount: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]!
    const label = d.toLocaleDateString('en-IN', { weekday: 'short' })
    const { data } = await db.from('fee_payments').select('paid_amount').eq('school_id', schoolId).eq('payment_date', dateStr)
    const amount = ((data ?? []) as any[]).reduce((s: number, r: any) => s + Number(r.paid_amount), 0)
    days.push({ date: dateStr, label, amount })
  }
  return days
}
