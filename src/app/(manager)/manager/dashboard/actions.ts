'use server'

import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { isLowStock } from '@/lib/inventory-utils'
import type { Database } from '@/types/database.types'

type FeePaymentRow = Pick<Database['public']['Tables']['fee_payments']['Row'], 'student_id' | 'paid_amount' | 'payment_date' | 'payment_mode'>
type InventoryItemRow = Pick<Database['public']['Tables']['inventory_items']['Row'], 'id' | 'stock_quantity' | 'low_stock_alert'>
type PendingFeeRpcRow = Database['public']['Functions']['get_pending_fees']['Returns'][number]

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

async function getManagerDashboardStatsUncached(
  schoolId: string,
  today: string,
): Promise<ManagerDashboardStats> {
  const supabase = await createServerSupabaseClient()

  // Build last 7 dates (oldest → newest)
  const dates: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().split('T')[0]!)
  }
  const fromDate = dates[0]!

  const [paymentsRes, inventoryRes, pendingRes] = await Promise.all([
    // Today + last 7 days payments (for trend + today stats)
    supabase
      .from('fee_payments')
      .select('student_id, paid_amount, payment_date, payment_mode')
      .eq('school_id', schoolId)
      .gte('payment_date', fromDate)
      .lte('payment_date', today)
      .limit(5000),

    // Inventory items
    supabase
      .from('inventory_items')
      .select('id, stock_quantity, low_stock_alert')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .limit(5000),

    supabase.rpc('get_pending_fees', { p_school_id: schoolId }),
  ])

  const payments = (paymentsRes.data ?? []) as FeePaymentRow[]
  const inventoryItems = (inventoryRes.data ?? []) as InventoryItemRow[]
  if (pendingRes.error) throw new Error(pendingRes.error.message)
  const pendingRows = (pendingRes.data ?? []) as PendingFeeRpcRow[]

  // Today's collection
  const todayPayments = payments.filter((p) => p.payment_date === today)
  const todayCollection = todayPayments.reduce((sum, p) => sum + Number(p.paid_amount ?? 0), 0)
  const paymentCount = todayPayments.length

  // Weekly trend — group by date
  const trendMap: Record<string, number> = {}
  dates.forEach(d => { trendMap[d] = 0 })
  payments.forEach((p) => {
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

  const pendingFeeCount = pendingRows.length
  const classPendingMap: Record<string, number> = {}
  pendingRows.forEach((row) => {
    const className = row.class_name || 'Unknown Class'
    classPendingMap[className] = (classPendingMap[className] ?? 0) + 1
  })

  const classPendingRisk = Object.entries(classPendingMap)
    .map(([className, pendingStudents]) => ({
      className,
      pendingStudents,
    }))
    .sort((a, b) => b.pendingStudents - a.pendingStudents)
    .slice(0, 6)

  // Inventory stats
  const inventoryItemCount = inventoryItems.length
  const lowStockCount = inventoryItems.filter((item) =>
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

export async function getManagerDashboardStats(
  schoolId: string,
  today: string,
): Promise<ManagerDashboardStats> {
  return getManagerDashboardStatsUncached(schoolId, today)
}
