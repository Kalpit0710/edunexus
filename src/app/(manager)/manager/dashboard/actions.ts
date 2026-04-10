'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { isLowStock } from '@/lib/inventory-utils'

export interface ManagerDashboardStats {
  todayCollection: number
  paymentCount: number
  pendingFeeCount: number
  inventoryItemCount: number
  lowStockCount: number
  weeklyTrend: { date: string; label: string; amount: number }[]
  paymentModeBreakdown: { mode: string; amount: number; count: number }[]
  classPendingRisk: { className: string; pendingStudents: number }[]
}

export async function getManagerDashboardStats(
  schoolId: string,
  today: string,
): Promise<ManagerDashboardStats> {
  const supabase = await createServerSupabaseClient()
  const db = supabase as any

  // Build last 7 dates (oldest → newest)
  const dates: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().split('T')[0]!)
  }
  const fromDate = dates[0]!

  const [paymentsRes, studentsRes, structuresRes, inventoryRes, pendingPayRes, classesRes] = await Promise.all([
    // Today + last 7 days payments (for trend + today stats)
    db
      .from('fee_payments')
      .select('student_id, paid_amount, payment_date, payment_mode')
      .eq('school_id', schoolId)
      .gte('payment_date', fromDate)
      .lte('payment_date', today)
      .limit(5000),

    // Active students
    db
      .from('students')
      .select('id, class_id')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .limit(5000),

    // Fee structures for current academic year
    db
      .from('fee_structures')
      .select('class_id, amount, academic_year_id')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .limit(5000),

    // Inventory items
    db
      .from('inventory_items')
      .select('id, stock_quantity, low_stock_alert')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .limit(5000),

    // All-time payments for pending fee calc
    db
      .from('fee_payments')
      .select('student_id, paid_amount')
      .eq('school_id', schoolId)
      .limit(10000),

    db
      .from('classes')
      .select('id, name')
      .eq('school_id', schoolId)
      .limit(500),
  ])

  const payments: any[] = paymentsRes.data ?? []
  const students: any[] = studentsRes.data ?? []
  const structures: any[] = structuresRes.data ?? []
  const inventoryItems: any[] = inventoryRes.data ?? []
  const allPayments: any[] = pendingPayRes.data ?? []
  const classes: any[] = classesRes.data ?? []

  // Today's collection
  const todayPayments = payments.filter((p: any) => p.payment_date === today)
  const todayCollection = todayPayments.reduce((s: number, p: any) => s + Number(p.paid_amount), 0)
  const paymentCount = todayPayments.length

  // Weekly trend — group by date
  const trendMap: Record<string, number> = {}
  dates.forEach(d => { trendMap[d] = 0 })
  payments.forEach((p: any) => {
    if (trendMap[p.payment_date] !== undefined) {
      trendMap[p.payment_date]! += Number(p.paid_amount)
    }
  })
  const weeklyTrend = dates.map(d => {
    const dt = new Date(d)
    const label = dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })
    return { date: d, label, amount: Math.round(trendMap[d]!) }
  })

  // Payment mode split (last 7 days)
  const modeMap: Record<string, { amount: number; count: number }> = {}
  for (const p of payments) {
    const mode = String(p.payment_mode ?? 'unknown').toLowerCase()
    modeMap[mode] = modeMap[mode] ?? { amount: 0, count: 0 }
    modeMap[mode]!.amount += Number(p.paid_amount ?? 0)
    modeMap[mode]!.count += 1
  }
  const paymentModeBreakdown = Object.entries(modeMap)
    .map(([mode, v]) => ({ mode, amount: Math.round(v.amount), count: v.count }))
    .sort((a, b) => b.amount - a.amount)

  // Pending fee count — students with balance > 0
  // Get current academic year first
  const { data: yearData } = await db
    .from('academic_years')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .single()

  let pendingFeeCount = 0
  let classFeeMap: Record<string, number> = {}
  let paidMap: Record<string, number> = {}
  if (yearData) {
    const yearId = yearData.id as string
    const yearStructures = structures.filter((s: any) => s.academic_year_id === yearId)
    classFeeMap = {}
    yearStructures.forEach((s: any) => {
      classFeeMap[s.class_id] = (classFeeMap[s.class_id] ?? 0) + Number(s.amount)
    })
    paidMap = {}
    allPayments.forEach((p: any) => {
      paidMap[p.student_id] = (paidMap[p.student_id] ?? 0) + Number(p.paid_amount)
    })
    pendingFeeCount = students.filter((s: any) => {
      const totalFee = classFeeMap[s.class_id] ?? 0
      const totalPaid = paidMap[s.id] ?? 0
      return totalFee > 0 && (totalFee - totalPaid) > 0
    }).length
  }

  const classNameMap: Record<string, string> = {}
  classes.forEach((c: any) => {
    classNameMap[c.id] = c.name
  })

  const classPendingMap: Record<string, number> = {}
  students.forEach((s: any) => {
    const totalFee = classFeeMap[s.class_id] ?? 0
    const totalPaid = paidMap[s.id] ?? 0

    if (totalFee > 0 && totalFee - totalPaid > 0) {
      classPendingMap[s.class_id] = (classPendingMap[s.class_id] ?? 0) + 1
    }
  })

  const classPendingRisk = Object.entries(classPendingMap)
    .map(([classId, pendingStudents]) => ({
      className: classNameMap[classId] ?? 'Unknown Class',
      pendingStudents,
    }))
    .sort((a, b) => b.pendingStudents - a.pendingStudents)
    .slice(0, 6)

  // Inventory stats
  const inventoryItemCount = inventoryItems.length
  const lowStockCount = inventoryItems.filter((item: any) =>
    isLowStock(Number(item.stock_quantity), Number(item.low_stock_alert))
  ).length

  return {
    todayCollection,
    paymentCount,
    pendingFeeCount,
    inventoryItemCount,
    lowStockCount,
    weeklyTrend,
    paymentModeBreakdown,
    classPendingRisk,
  }
}
