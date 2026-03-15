'use server'

import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import {
  calculateInventoryCartTotal,
  isLowStock,
  validateInventorySaleItems,
  validateStockAdjustment,
  type InventoryCartItem,
  type InventoryCategory,
  type StockAdjustmentType,
} from '@/lib/inventory-utils'
import { sendEmail } from '@/lib/email'
import { InventoryReceiptEmail } from '@/emails/InventoryReceiptEmail'

export interface InventoryItemInput {
  name: string
  category: InventoryCategory
  sku?: string
  description?: string
  unitPrice: number
  costPrice?: number | null
  stockQuantity?: number
  lowStockAlert?: number
  createdByProfileId?: string
}

export interface InventorySaleInput {
  studentId?: string | null
  paymentMode: 'cash' | 'cheque' | 'upi' | 'neft' | 'card' | 'online'
  soldByProfileId?: string
  items: Array<{
    itemId: string
    quantity: number
    unitPrice?: number
  }>
}

export interface InventoryStockAdjustmentInput {
  itemId: string
  quantity: number
  type: StockAdjustmentType
  reason?: string
  adjustedByProfileId?: string
}

async function getActorProfileId(
  db: any,
  schoolId: string,
  providedProfileId?: string
): Promise<string | null> {
  if (providedProfileId) return providedProfileId

  const { data: userResult, error: userError } = await db.auth.getUser()
  if (userError || !userResult?.user) return null

  const { data: profile } = await db
    .from('user_profiles')
    .select('id')
    .eq('auth_user_id', userResult.user.id)
    .eq('school_id', schoolId)
    .maybeSingle()

  return profile?.id ?? null
}

export async function getInventoryItems(
  schoolId: string,
  opts?: {
    category?: InventoryCategory
    search?: string
    activeOnly?: boolean
    limit?: number
  }
) {
  const supabase = await createServerSupabaseClient()
  const db = supabase as any

  let query = db
    .from('inventory_items')
    .select('*')
    .eq('school_id', schoolId)
    .order('name', { ascending: true })
    .limit(opts?.limit ?? 200)

  if (opts?.activeOnly ?? true) {
    query = query.eq('is_active', true)
  }

  if (opts?.category) {
    query = query.eq('category', opts.category)
  }

  if (opts?.search?.trim()) {
    query = query.or(`name.ilike.%${opts.search.trim()}%,sku.ilike.%${opts.search.trim()}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createInventoryItem(schoolId: string, input: InventoryItemInput) {
  if (!input.name.trim()) throw new Error('Item name is required.')
  if (input.unitPrice < 0) throw new Error('Unit price cannot be negative.')

  const supabase = await createServerSupabaseClient()
  const db = supabase as any

  const actorProfileId = await getActorProfileId(db, schoolId, input.createdByProfileId)

  const { data, error } = await db
    .from('inventory_items')
    .insert({
      school_id: schoolId,
      name: input.name.trim(),
      category: input.category,
      sku: input.sku?.trim() || null,
      description: input.description?.trim() || null,
      unit_price: Number(input.unitPrice.toFixed(2)),
      cost_price: input.costPrice == null ? null : Number(input.costPrice.toFixed(2)),
      stock_quantity: input.stockQuantity ?? 0,
      low_stock_alert: input.lowStockAlert ?? 10,
      created_by: actorProfileId,
      is_active: true,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateInventoryItem(
  schoolId: string,
  itemId: string,
  updates: Partial<InventoryItemInput>
) {
  const payload: Record<string, unknown> = {}

  if (updates.name !== undefined) payload.name = updates.name.trim()
  if (updates.category !== undefined) payload.category = updates.category
  if (updates.sku !== undefined) payload.sku = updates.sku?.trim() || null
  if (updates.description !== undefined) payload.description = updates.description?.trim() || null
  if (updates.unitPrice !== undefined) payload.unit_price = Number(updates.unitPrice.toFixed(2))
  if (updates.costPrice !== undefined) {
    payload.cost_price = updates.costPrice == null ? null : Number(updates.costPrice.toFixed(2))
  }
  if (updates.lowStockAlert !== undefined) payload.low_stock_alert = updates.lowStockAlert
  if (updates.stockQuantity !== undefined) payload.stock_quantity = updates.stockQuantity

  if ('unit_price' in payload && Number(payload.unit_price) < 0) {
    throw new Error('Unit price cannot be negative.')
  }

  const supabase = await createServerSupabaseClient()
  const db = supabase as any

  const { data, error } = await db
    .from('inventory_items')
    .update(payload)
    .eq('school_id', schoolId)
    .eq('id', itemId)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function setInventoryItemActive(
  schoolId: string,
  itemId: string,
  isActive: boolean
): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const db = supabase as any

  const { error } = await db
    .from('inventory_items')
    .update({ is_active: isActive })
    .eq('school_id', schoolId)
    .eq('id', itemId)

  if (error) throw new Error(error.message)
}

export async function adjustInventoryStock(
  schoolId: string,
  input: InventoryStockAdjustmentInput
) {
  const supabase = await createServerSupabaseClient()
  const db = supabase as any

  const { data: currentItem, error: currentError } = await db
    .from('inventory_items')
    .select('stock_quantity')
    .eq('school_id', schoolId)
    .eq('id', input.itemId)
    .single()

  if (currentError) throw new Error(currentError.message)

  const validationErrors = validateStockAdjustment(
    input.type,
    input.quantity,
    Number(currentItem.stock_quantity)
  )
  if (validationErrors.length) {
    throw new Error(validationErrors.join(' '))
  }

  const actorProfileId = await getActorProfileId(db, schoolId, input.adjustedByProfileId)

  const { data, error } = await db.rpc('adjust_stock', {
    p_item_id: input.itemId,
    p_quantity: input.quantity,
    p_type: input.type,
    p_reason: input.reason ?? null,
    p_adjusted_by: actorProfileId,
  })

  if (error) throw new Error(error.message)
  return data
}

export async function createInventorySale(
  schoolId: string,
  input: InventorySaleInput
): Promise<{ saleId: string; billNumber: string; totalAmount: number }> {
  const supabase = await createServerSupabaseClient()
  const db = supabase as any

  const cartForValidation: InventoryCartItem[] = input.items.map(item => ({
    itemId: item.itemId,
    quantity: item.quantity,
    unitPrice: item.unitPrice ?? 0,
  }))

  const saleItemErrors = validateInventorySaleItems(cartForValidation)
  if (saleItemErrors.length) {
    throw new Error(saleItemErrors.join(' '))
  }

  const actorProfileId = await getActorProfileId(db, schoolId, input.soldByProfileId)

  const rpcItems = input.items.map(item => ({
    item_id: item.itemId,
    quantity: item.quantity,
    unit_price: item.unitPrice ?? null,
  }))

  const { data, error } = await db.rpc('create_inventory_sale', {
    p_school_id: schoolId,
    p_student_id: input.studentId ?? null,
    p_items: rpcItems,
    p_payment_mode: input.paymentMode,
    p_sold_by: actorProfileId,
  })

  if (error) throw new Error(error.message)

  if (input.studentId) {
    try {
      const { data: parent } = await db.from('parents').select('first_name, email').eq('student_id', input.studentId).eq('is_primary', true).maybeSingle()
      const { data: student } = await db.from('students').select('full_name, schools(name)').eq('id', input.studentId).single()
      
      if (parent?.email && student) {
        await sendEmail({
          to: parent.email,
          subject: `Purchase Receipt from ${student.schools?.name || 'EduNexus'}`,
          react: InventoryReceiptEmail({
            customerName: parent.first_name,
            schoolName: student.schools?.name || 'EduNexus',
            billNumber: data.bill_number,
            totalAmount: `₹${Number(data.total_amount).toFixed(2)}`,
            paymentMode: input.paymentMode,
            date: new Date().toLocaleDateString()
          }),
          schoolId,
          event: 'inventory_receipt'
        })
      }
    } catch (e) {
      console.error('Failed to send POS receipt email', e)
    }
  }

  return {
    saleId: data.sale_id,
    billNumber: data.bill_number,
    totalAmount: Number(data.total_amount),
  }
}

export async function getInventorySales(
  schoolId: string,
  opts?: {
    fromDate?: string
    toDate?: string
    limit?: number
  }
) {
  const supabase = await createServerSupabaseClient()
  const db = supabase as any

  let query = db
    .from('inventory_sales')
    .select('*, students(full_name, admission_number), inventory_sale_items(quantity, unit_price, total_price)')
    .eq('school_id', schoolId)
    .order('sale_date', { ascending: false })
    .limit(opts?.limit ?? 200)

  if (opts?.fromDate) query = query.gte('sale_date', `${opts.fromDate}T00:00:00.000Z`)
  if (opts?.toDate) query = query.lte('sale_date', `${opts.toDate}T23:59:59.999Z`)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getLowStockItems(schoolId: string, limit = 50) {
  const supabase = await createServerSupabaseClient()
  const db = supabase as any

  const { data, error } = await db
    .from('inventory_items')
    .select('*')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('stock_quantity', { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)

  return (data ?? []).filter((item: any) =>
    isLowStock(Number(item.stock_quantity), Number(item.low_stock_alert))
  )
}

export async function getInventorySummary(schoolId: string) {
  const supabase = await createServerSupabaseClient()
  const db = supabase as any

  const [itemsResult, salesResult] = await Promise.all([
    db
      .from('inventory_items')
      .select('stock_quantity, unit_price, low_stock_alert')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .limit(5000),
    db
      .from('inventory_sales')
      .select('id, total_amount')
      .eq('school_id', schoolId)
      .limit(5000),
  ])

  if (itemsResult.error) throw new Error(itemsResult.error.message)
  if (salesResult.error) throw new Error(salesResult.error.message)

  const items = itemsResult.data ?? []
  const sales = salesResult.data ?? []

  const stockValue = items.reduce(
    (sum: number, item: any) => sum + Number(item.stock_quantity) * Number(item.unit_price),
    0
  )

  const lowStockCount = items.filter((item: any) =>
    isLowStock(Number(item.stock_quantity), Number(item.low_stock_alert))
  ).length

  const salesTotal = calculateInventoryCartTotal(
    sales.map((sale: any) => ({
      itemId: sale.id,
      quantity: 1,
      unitPrice: Number(sale.total_amount),
    }))
  )

  return {
    itemCount: items.length,
    lowStockCount,
    stockValue: Number(stockValue.toFixed(2)),
    salesCount: sales.length,
    salesTotal,
  }
}
