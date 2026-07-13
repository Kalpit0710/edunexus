'use server'

import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'
import { requirePermission } from '@/lib/auth/permissions'
import {
  isLowStock,
  validateInventorySaleItems,
  validateStockAdjustment,
  type InventoryCartItem,
  type InventoryCategory,
  type StockAdjustmentType,
} from '@/lib/inventory-utils'
import { requireActor } from '@/lib/auth/require-actor'
import { sendEmail } from '@/lib/email'
import { InventoryReceiptEmail } from '@/emails/InventoryReceiptEmail'
import { isOnlinePaymentEnabled } from '@/lib/payments'

type ServerDbClient = Awaited<ReturnType<typeof createServerSupabaseClient>>
type InventoryItemRow = Database['public']['Tables']['inventory_items']['Row']
type InventoryItemUpdate = Database['public']['Tables']['inventory_items']['Update']
type InventorySaleControlDbRow = Database['public']['Tables']['inventory_sale_control_requests']['Row']
type InventorySupplierDbRow = Database['public']['Tables']['inventory_suppliers']['Row']
type InventoryPurchaseOrderDbRow = Database['public']['Tables']['inventory_purchase_orders']['Row']
type InventoryPurchaseOrderItemDbRow = Database['public']['Tables']['inventory_purchase_order_items']['Row']
type InventoryVendorReturnDbRow = Database['public']['Tables']['inventory_vendor_returns']['Row']
type InventoryDamageAdjustmentDbRow = Database['public']['Tables']['inventory_damage_adjustments']['Row']
type ClassRow = Pick<Database['public']['Tables']['classes']['Row'], 'id' | 'name'>
type StudentPosJoinedRow = Pick<Database['public']['Tables']['students']['Row'], 'id' | 'full_name' | 'admission_number' | 'class_id'> & {
  classes: { name: string } | null
  sections: { name: string } | null
}
type ParentEmailRow = Pick<Database['public']['Tables']['parents']['Row'], 'full_name' | 'email'>
type StudentSchoolRow = Pick<Database['public']['Tables']['students']['Row'], 'full_name'> & {
  schools: { name: string } | null
}
interface CreateInventorySaleRpcResult {
  sale_id: string
  bill_number: string
  total_amount: number | string
}

export interface InventoryItemInput {
  name: string
  category: InventoryCategory
  sku?: string
  description?: string
  unitPrice: number
  costPrice?: number | null
  stockQuantity?: number
  lowStockAlert?: number
  classId?: string | null
  createdByProfileId?: string
}

export interface InventorySaleInput {
  studentId?: string | null
  clientReference?: string | null
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
  db: ServerDbClient,
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

  let query = supabase
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

export interface InventoryItemsPageResult {
  items: InventoryItemRow[]
  total: number
  page: number
  pageSize: number
}

export async function getInventoryItemsPage(
  schoolId: string,
  opts?: {
    category?: InventoryCategory
    classId?: string
    search?: string
    activeOnly?: boolean
    page?: number
    pageSize?: number
  },
): Promise<InventoryItemsPageResult> {
  const supabase = await createServerSupabaseClient()

  const page = Math.max(1, opts?.page ?? 1)
  const pageSize = Math.max(10, Math.min(200, opts?.pageSize ?? 50))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('inventory_items')
    .select('*', { count: 'exact' })
    .eq('school_id', schoolId)
    .order('name', { ascending: true })
    .range(from, to)

  if (opts?.activeOnly ?? true) {
    query = query.eq('is_active', true)
  }

  if (opts?.category) {
    query = query.eq('category', opts.category)
  }

  if (opts?.classId === 'general') {
    query = query.is('class_id', null)
  } else if (opts?.classId) {
    query = query.eq('class_id', opts.classId)
  }

  if (opts?.search?.trim()) {
    query = query.or(`name.ilike.%${opts.search.trim()}%,sku.ilike.%${opts.search.trim()}%`)
  }

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  return {
    items: (data ?? []) as InventoryItemRow[],
    total: count ?? 0,
    page,
    pageSize,
  }
}

export async function getInventoryOnlinePaymentEnabled(): Promise<boolean> {
  return isOnlinePaymentEnabled()
}

// ─── Bookstore POS helpers ────────────────────────────────────────────────────

export interface PosClass {
  id: string
  name: string
}

/** Classes for the school, for the POS class/book-set filter. */
export async function getPosClasses(schoolId: string): Promise<PosClass[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('classes')
    .select('id, name')
    .eq('school_id', schoolId)
    .order('display_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as PosClass[]
}

export interface PosStudent {
  id: string
  fullName: string
  admissionNumber: string
  classId: string | null
  className: string
  sectionName: string
}

/**
 * Find a single active student by admission number or name for the POS. Returns
 * the student's class so the cashier can pull that class's book set.
 */
export async function searchStudentForPos(
  schoolId: string,
  query: string,
): Promise<PosStudent | null> {
  const q = query.trim()
  if (!q) return null
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('students')
    .select('id, full_name, admission_number, class_id, classes(name), sections(name)')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .or(`admission_number.ilike.%${q}%,full_name.ilike.%${q}%`)
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const row = data as StudentPosJoinedRow
  return {
    id: row.id,
    fullName: row.full_name,
    admissionNumber: row.admission_number,
    classId: row.class_id ?? null,
    className: row.classes?.name ?? '',
    sectionName: row.sections?.name ?? '',
  }
}

/**
 * Live-search active students by admission number or name for the POS. Returns
 * up to `limit` matches (each with class info) for a typeahead dropdown.
 */
export async function searchStudentsForPos(
  schoolId: string,
  query: string,
  limit = 8,
): Promise<PosStudent[]> {
  const q = query.trim()
  if (!q) return []
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('students')
    .select('id, full_name, admission_number, class_id, classes(name), sections(name)')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .or(`admission_number.ilike.%${q}%,full_name.ilike.%${q}%`)
    .order('full_name', { ascending: true })
    .limit(limit)
  if (error) throw new Error(error.message)
  return ((data ?? []) as StudentPosJoinedRow[]).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    admissionNumber: row.admission_number,
    classId: row.class_id ?? null,
    className: row.classes?.name ?? '',
    sectionName: row.sections?.name ?? '',
  }))
}

export async function getStudentForPosById(
  schoolId: string,
  studentId: string,
): Promise<PosStudent | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('students')
    .select('id, full_name, admission_number, class_id, classes(name), sections(name)')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .eq('id', studentId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as StudentPosJoinedRow
  return {
    id: row.id,
    fullName: row.full_name,
    admissionNumber: row.admission_number,
    classId: row.class_id ?? null,
    className: row.classes?.name ?? '',
    sectionName: row.sections?.name ?? '',
  }
}

/**
 * The active inventory items that make up a class's book set (items tagged with
 * that `class_id`). Returns [] when the class has no items configured yet.
 */
export async function getClassInventorySet(schoolId: string, classId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('school_id', schoolId)
    .eq('class_id', classId)
    .eq('is_active', true)
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

/**
 * POS catalog for a class: the class's own book-set items PLUS general items
 * (`class_id IS NULL`, e.g. stationery/uniforms). The caller pre-fills the cart
 * with only the class-tagged items; general items are shown but not auto-added.
 */
export async function getClassPosCatalog(schoolId: string, classId: string) {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .or(`class_id.eq.${classId},class_id.is.null`)
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createInventoryItem(schoolId: string, input: InventoryItemInput) {
  if (!input.name.trim()) throw new Error('Item name is required.')
  if (input.unitPrice < 0) throw new Error('Unit price cannot be negative.')

  const supabase = await createServerSupabaseClient()
  await requireActor(supabase, ['school_admin', 'manager', 'cashier'])
  await requirePermission(supabase, 'inventory.manage')

  const actorProfileId = await getActorProfileId(supabase, schoolId, input.createdByProfileId)

  const { data, error } = await supabase
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
      class_id: input.classId ?? null,
      created_by: actorProfileId,
      is_active: true,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data
}

export interface InventoryBulkRow {
  name: string
  category: InventoryCategory
  sku?: string | null
  description?: string | null
  unitPrice: number
  costPrice?: number | null
  stockQuantity?: number
  lowStockAlert?: number
  /** A class id in the same school, or null for a general item. */
  classId?: string | null
}

/**
 * Bulk-create inventory items from an imported spreadsheet. Validates each row
 * server-side (name/category/price + that any class belongs to this school) and
 * inserts them in one batch. Throws on the first invalid row.
 */
export async function bulkCreateInventoryItems(
  schoolId: string,
  rows: InventoryBulkRow[],
): Promise<{ inserted: number }> {
  const supabase = await createServerSupabaseClient()
  await requireActor(supabase, ['school_admin', 'manager', 'cashier'])
  await requirePermission(supabase, 'inventory.manage')

  if (!rows.length) throw new Error('No rows to import.')

  const validCategories: InventoryCategory[] = ['book', 'uniform', 'stationery', 'sports', 'lab', 'other']

  const { data: classRows } = await supabase.from('classes').select('id').eq('school_id', schoolId)
  const validClassIds = new Set(((classRows ?? []) as Pick<ClassRow, 'id'>[]).map((c) => c.id))

  const actorProfileId = await getActorProfileId(supabase, schoolId)

  const payload = rows.map((r, i) => {
    const name = (r.name ?? '').trim()
    if (!name) throw new Error(`Row ${i + 1}: item name is required.`)
    if (!validCategories.includes(r.category)) {
      throw new Error(`Row ${i + 1}: invalid category "${r.category}".`)
    }
    const unitPrice = Number(r.unitPrice)
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`Row ${i + 1}: unit price must be a number ≥ 0.`)
    }
    const classId = r.classId && validClassIds.has(r.classId) ? r.classId : null
    return {
      school_id: schoolId,
      name,
      category: r.category,
      sku: r.sku?.trim() || null,
      description: r.description?.trim() || null,
      unit_price: Number(unitPrice.toFixed(2)),
      cost_price: r.costPrice == null ? null : Number(Number(r.costPrice).toFixed(2)),
      stock_quantity: Math.max(0, Math.floor(Number(r.stockQuantity ?? 0)) || 0),
      low_stock_alert: Math.max(0, Math.floor(Number(r.lowStockAlert ?? 10)) || 0),
      class_id: classId,
      created_by: actorProfileId,
      is_active: true,
    }
  })

  const { error } = await supabase.from('inventory_items').insert(payload)
  if (error) throw new Error(error.message)
  return { inserted: payload.length }
}

export async function updateInventoryItem(
  schoolId: string,
  itemId: string,
  updates: Partial<InventoryItemInput>
) {
  const payload: InventoryItemUpdate = {}

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
  if (updates.classId !== undefined) payload.class_id = updates.classId || null

  if ('unit_price' in payload && Number(payload.unit_price) < 0) {
    throw new Error('Unit price cannot be negative.')
  }

  const supabase = await createServerSupabaseClient()
  await requireActor(supabase, ['school_admin', 'manager', 'cashier'])
  await requirePermission(supabase, 'inventory.manage')

  const { data, error } = await supabase
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
  await requireActor(supabase, ['school_admin', 'manager', 'cashier'])
  await requirePermission(supabase, 'inventory.manage')

  const { error } = await supabase
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
  await requireActor(supabase, ['school_admin', 'manager', 'cashier'])
  await requirePermission(supabase, 'inventory.manage')

  const { data: currentItem, error: currentError } = await supabase
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

  const actorProfileId = await getActorProfileId(supabase, schoolId, input.adjustedByProfileId)

  const rpcArgs: {
    p_item_id: string
    p_quantity: number
    p_type: StockAdjustmentType
    p_reason?: string
    p_adjusted_by?: string
  } = {
    p_item_id: input.itemId,
    p_quantity: input.quantity,
    p_type: input.type,
  }
  if (input.reason?.trim()) rpcArgs.p_reason = input.reason.trim()
  if (actorProfileId) rpcArgs.p_adjusted_by = actorProfileId

  const { data, error } = await supabase.rpc('adjust_stock', rpcArgs)

  if (error) throw new Error(error.message)
  return data
}

export async function createInventorySale(
  schoolId: string,
  input: InventorySaleInput
): Promise<{ saleId: string; billNumber: string; totalAmount: number }> {
  const supabase = await createServerSupabaseClient()
  await requireActor(supabase, ['school_admin', 'manager', 'cashier'])
  await requirePermission(supabase, 'inventory.manage')

  const cartForValidation: InventoryCartItem[] = input.items.map(item => ({
    itemId: item.itemId,
    quantity: item.quantity,
    unitPrice: item.unitPrice ?? 0,
  }))

  const saleItemErrors = validateInventorySaleItems(cartForValidation)
  if (saleItemErrors.length) {
    throw new Error(saleItemErrors.join(' '))
  }

  const actorProfileId = await getActorProfileId(supabase, schoolId, input.soldByProfileId)

  const rpcItems = input.items.map(item => ({
    item_id: item.itemId,
    quantity: item.quantity,
    unit_price: item.unitPrice ?? null,
  }))

  const saleRpcArgs: {
    p_school_id: string
    p_student_id?: string
    p_client_reference?: string
    p_items: Array<{ item_id: string; quantity: number; unit_price: number | null }>
    p_payment_mode: InventorySaleInput['paymentMode']
    p_sold_by?: string
  } = {
    p_school_id: schoolId,
    p_items: rpcItems,
    p_payment_mode: input.paymentMode,
  }
  if (input.studentId) saleRpcArgs.p_student_id = input.studentId
  if (input.clientReference?.trim()) saleRpcArgs.p_client_reference = input.clientReference.trim()
  if (actorProfileId) saleRpcArgs.p_sold_by = actorProfileId

  const { data, error } = await supabase.rpc('create_inventory_sale', saleRpcArgs)

  if (error) throw new Error(error.message)
  const saleResult = data as unknown as CreateInventorySaleRpcResult

  if (input.studentId) {
    // Email dispatch is intentionally fire-and-forget so checkout latency stays low.
    void sendInventoryReceiptEmail(supabase, {
      schoolId,
      studentId: input.studentId,
      billNumber: saleResult.bill_number,
      totalAmount: Number(saleResult.total_amount),
      paymentMode: input.paymentMode,
    })
  }

  return {
    saleId: saleResult.sale_id,
    billNumber: saleResult.bill_number,
    totalAmount: Number(saleResult.total_amount),
  }
}

interface InventoryReceiptEmailArgs {
  schoolId: string
  studentId: string
  billNumber: string
  totalAmount: number
  paymentMode: InventorySaleInput['paymentMode']
}

async function sendInventoryReceiptEmail(
  supabase: ServerDbClient,
  args: InventoryReceiptEmailArgs,
): Promise<void> {
  try {
    const { data: parent } = await supabase
      .from('parents')
      .select('full_name, email')
      .eq('student_id', args.studentId)
      .eq('is_primary', true)
      .maybeSingle()
    const { data: student } = await supabase
      .from('students')
      .select('full_name, schools(name)')
      .eq('id', args.studentId)
      .single()

    const parentRow = parent as ParentEmailRow | null
    const studentRow = student as StudentSchoolRow | null

    if (!parentRow?.email || !studentRow) return

    await sendEmail({
      to: parentRow.email,
      subject: `Purchase Receipt from ${studentRow.schools?.name || 'EduNexus'}`,
      react: InventoryReceiptEmail({
        customerName: parentRow.full_name,
        schoolName: studentRow.schools?.name || 'EduNexus',
        billNumber: args.billNumber,
        totalAmount: `₹${args.totalAmount.toFixed(2)}`,
        paymentMode: args.paymentMode,
        date: new Date().toLocaleDateString(),
      }),
      schoolId: args.schoolId,
      event: 'inventory_receipt',
    })
  } catch (e) {
    console.error('Failed to send POS receipt email', e)
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

  let query = supabase
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

  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('stock_quantity', { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)

  return ((data ?? []) as InventoryItemRow[]).filter((item) =>
    isLowStock(Number(item.stock_quantity), Number(item.low_stock_alert))
  )
}

export async function getInventorySummary(schoolId: string) {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase.rpc('get_inventory_summary', {
    p_school_id: schoolId,
  })

  if (error) throw new Error(error.message)

  const summary = (Array.isArray(data) ? data[0] : data) as
    | {
        item_count: number | string | null
        low_stock_count: number | string | null
        stock_value: number | string | null
        sales_count: number | string | null
        sales_total: number | string | null
      }
    | null

  return {
    itemCount: Number(summary?.item_count ?? 0),
    lowStockCount: Number(summary?.low_stock_count ?? 0),
    stockValue: Number(Number(summary?.stock_value ?? 0).toFixed(2)),
    salesCount: Number(summary?.sales_count ?? 0),
    salesTotal: Number(Number(summary?.sales_total ?? 0).toFixed(2)),
  }
}

// ─── Procurement lifecycle (PO / GRN / returns / damages) ──────────────────

export interface InventoryPurchaseOrderLineInput {
  itemId: string
  orderedQuantity: number
  unitCost: number
}

export interface InventorySupplierRow {
  id: string
  schoolId: string
  name: string
  contactPerson: string | null
  phone: string | null
  email: string | null
  notes: string | null
  isActive: boolean
  createdBy: string | null
  createdAt: string
}

export interface InventoryPurchaseOrderReceiveLineInput {
  purchaseOrderItemId: string
  quantityReceived: number
}

export interface InventoryPurchaseOrderListRow {
  id: string
  schoolId: string
  supplierId: string | null
  supplierName: string
  poNumber: string
  vendorName: string
  orderDate: string
  expectedDate: string | null
  status: 'draft' | 'pending_approval' | 'approved' | 'partially_received' | 'received' | 'rejected' | 'cancelled'
  notes: string | null
  requestedBy: string | null
  requestedByName: string | null
  approvedBy: string | null
  approvedByName: string | null
  reviewedBy: string | null
  reviewedByName: string | null
  reviewedAt: string | null
  approvalNotes: string | null
  createdAt: string
  items: Array<{
    id: string
    itemId: string
    itemName: string
    orderedQuantity: number
    receivedQuantity: number
    pendingQuantity: number
    unitCost: number
  }>
}

function toPurchaseOrderStatus(value: string): InventoryPurchaseOrderListRow['status'] {
  if (
    value === 'draft' ||
    value === 'pending_approval' ||
    value === 'approved' ||
    value === 'partially_received' ||
    value === 'received' ||
    value === 'rejected' ||
    value === 'cancelled'
  ) {
    return value
  }
  return 'draft'
}

export async function getInventorySuppliers(
  schoolId: string,
  opts?: { activeOnly?: boolean; limit?: number },
): Promise<InventorySupplierRow[]> {
  const supabase = await createServerSupabaseClient()
  await requireActor(supabase, ['school_admin', 'manager', 'cashier'])
  await requirePermission(supabase, 'inventory.manage')

  let query = supabase
    .from('inventory_suppliers')
    .select('*')
    .eq('school_id', schoolId)
    .order('name', { ascending: true })
    .limit(opts?.limit ?? 200)

  if (opts?.activeOnly ?? true) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return ((data ?? []) as InventorySupplierDbRow[]).map((row) => ({
    id: row.id,
    schoolId: row.school_id,
    name: row.name,
    contactPerson: row.contact_person,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }))
}

export async function createInventorySupplier(
  schoolId: string,
  input: {
    name: string
    contactPerson?: string
    phone?: string
    email?: string
    notes?: string
  },
): Promise<InventorySupplierRow> {
  const supabase = await createServerSupabaseClient()
  await requireActor(supabase, ['school_admin', 'manager', 'cashier'])
  await requirePermission(supabase, 'inventory.manage')

  const actorProfileId = await getActorProfileId(supabase, schoolId)
  const name = input.name.trim()
  if (!name) throw new Error('Supplier name is required.')

  const { data, error } = await supabase
    .from('inventory_suppliers')
    .insert({
      school_id: schoolId,
      name,
      contact_person: input.contactPerson?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      notes: input.notes?.trim() || null,
      created_by: actorProfileId,
      is_active: true,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)

  const row = data as InventorySupplierDbRow
  return {
    id: row.id,
    schoolId: row.school_id,
    name: row.name,
    contactPerson: row.contact_person,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

export async function setInventorySupplierActive(
  schoolId: string,
  supplierId: string,
  isActive: boolean,
): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await requireActor(supabase, ['school_admin', 'manager', 'cashier'])
  await requirePermission(supabase, 'inventory.manage')

  const { error } = await supabase
    .from('inventory_suppliers')
    .update({ is_active: isActive })
    .eq('school_id', schoolId)
    .eq('id', supplierId)

  if (error) throw new Error(error.message)
}

export interface InventoryStockReductionLogRow {
  id: string
  itemId: string
  itemName: string
  quantity: number
  reason: string
  date: string
  type: 'vendor_return' | 'damage'
  purchaseOrderId?: string | null
  recordedBy: string | null
  recordedByName: string | null
}

interface CreateInventoryPurchaseOrderRpcResult {
  purchase_order_id: string
  po_number: string
  status?: string
}

interface ReceiveInventoryPurchaseOrderRpcResult {
  goods_receipt_id: string
  grn_number: string
  purchase_order_status: string
}

export interface InventorySaleControlAuditRow {
  requestId: string
  saleId: string
  billNumber: string | null
  requestType: 'void' | 'return'
  status: InventorySaleControlRequestRow['status']
  reason: string
  reversalReason: string | null
  requestedAt: string
  reviewedAt: string | null
  executedAt: string | null
  requestedByName: string | null
  reviewedByName: string | null
  agingHours: number
  reviewTatHours: number | null
  withinSla: boolean
}

export interface InventorySaleControlAuditSummary {
  total: number
  pending: number
  breaches: number
  executed: number
  rejected: number
  avgReviewTatHours: number
}

export async function createInventoryPurchaseOrder(
  schoolId: string,
  input: {
    supplierId: string
    orderDate?: string
    expectedDate?: string
    notes?: string
    items: InventoryPurchaseOrderLineInput[]
  },
): Promise<{ purchaseOrderId: string; poNumber: string }> {
  const supabase = await createServerSupabaseClient()
  await requireActor(supabase, ['school_admin', 'manager', 'cashier'])
  await requirePermission(supabase, 'inventory.manage')

  const actorProfileId = await getActorProfileId(supabase, schoolId)
  if (!input.supplierId) throw new Error('Supplier is required.')
  if (!input.items?.length) throw new Error('At least one PO item is required.')

  const rpcItems = input.items.map((line) => {
    if (!line.itemId) throw new Error('Each PO line requires an inventory item.')
    if (!Number.isFinite(line.orderedQuantity) || line.orderedQuantity <= 0) {
      throw new Error('PO ordered quantity must be greater than zero.')
    }
    if (!Number.isFinite(line.unitCost) || line.unitCost < 0) {
      throw new Error('PO unit cost must be zero or greater.')
    }
    return {
      item_id: line.itemId,
      ordered_quantity: Math.trunc(line.orderedQuantity),
      unit_cost: Number(line.unitCost.toFixed(2)),
    }
  })

  const rpcArgs: {
    p_school_id: string
    p_supplier_id: string
    p_items: Array<{ item_id: string; ordered_quantity: number; unit_cost: number }>
    p_order_date?: string
    p_expected_date?: string
    p_notes?: string
    p_requested_by?: string
  } = {
    p_school_id: schoolId,
    p_supplier_id: input.supplierId,
    p_items: rpcItems,
  }

  if (input.orderDate) rpcArgs.p_order_date = input.orderDate
  if (input.expectedDate) rpcArgs.p_expected_date = input.expectedDate
  if (input.notes?.trim()) rpcArgs.p_notes = input.notes.trim()
  if (actorProfileId) rpcArgs.p_requested_by = actorProfileId

  const { data, error } = await supabase.rpc('create_inventory_purchase_order', rpcArgs)
  if (error) throw new Error(error.message)

  const result = data as unknown as CreateInventoryPurchaseOrderRpcResult
  return {
    purchaseOrderId: result.purchase_order_id,
    poNumber: result.po_number,
  }
}

export async function reviewInventoryPurchaseOrder(
  schoolId: string,
  purchaseOrderId: string,
  decision: 'approved' | 'rejected',
  notes?: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await requireActor(supabase, ['school_admin'])
  await requirePermission(supabase, 'inventory.manage')

  const actorProfileId = await getActorProfileId(supabase, schoolId)

  const rpcArgs: {
    p_purchase_order_id: string
    p_decision: 'approved' | 'rejected'
    p_reviewed_by?: string
    p_review_notes?: string
  } = {
    p_purchase_order_id: purchaseOrderId,
    p_decision: decision,
  }

  if (actorProfileId) rpcArgs.p_reviewed_by = actorProfileId
  if (notes?.trim()) rpcArgs.p_review_notes = notes.trim()

  const { error } = await supabase.rpc('review_inventory_purchase_order', rpcArgs)
  if (error) throw new Error(error.message)
}

export async function receiveInventoryPurchaseOrder(
  schoolId: string,
  input: {
    purchaseOrderId: string
    receivedDate?: string
    notes?: string
    items: InventoryPurchaseOrderReceiveLineInput[]
  },
): Promise<{ goodsReceiptId: string; grnNumber: string; purchaseOrderStatus: string }> {
  const supabase = await createServerSupabaseClient()
  await requireActor(supabase, ['school_admin', 'manager', 'cashier'])
  await requirePermission(supabase, 'inventory.manage')

  const actorProfileId = await getActorProfileId(supabase, schoolId)
  if (!input.purchaseOrderId) throw new Error('Purchase order is required.')
  if (!input.items?.length) throw new Error('At least one receiving line is required.')

  const rpcItems = input.items.map((line) => {
    if (!line.purchaseOrderItemId) throw new Error('Each receiving line requires a PO line id.')
    if (!Number.isFinite(line.quantityReceived) || line.quantityReceived <= 0) {
      throw new Error('Received quantity must be greater than zero.')
    }
    return {
      purchase_order_item_id: line.purchaseOrderItemId,
      quantity_received: Math.trunc(line.quantityReceived),
    }
  })

  const rpcArgs: {
    p_purchase_order_id: string
    p_items: Array<{ purchase_order_item_id: string; quantity_received: number }>
    p_received_date?: string
    p_notes?: string
    p_received_by?: string
  } = {
    p_purchase_order_id: input.purchaseOrderId,
    p_items: rpcItems,
  }

  if (input.receivedDate) rpcArgs.p_received_date = input.receivedDate
  if (input.notes?.trim()) rpcArgs.p_notes = input.notes.trim()
  if (actorProfileId) rpcArgs.p_received_by = actorProfileId

  const { data, error } = await supabase.rpc('receive_inventory_purchase_order', rpcArgs)
  if (error) throw new Error(error.message)

  const result = data as unknown as ReceiveInventoryPurchaseOrderRpcResult
  return {
    goodsReceiptId: result.goods_receipt_id,
    grnNumber: result.grn_number,
    purchaseOrderStatus: result.purchase_order_status,
  }
}

export async function recordInventoryVendorReturn(
  schoolId: string,
  input: {
    itemId: string
    quantity: number
    reason: string
    purchaseOrderId?: string
    returnDate?: string
  },
): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await requireActor(supabase, ['school_admin', 'manager', 'cashier'])
  await requirePermission(supabase, 'inventory.manage')

  if (!input.itemId) throw new Error('Inventory item is required.')
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error('Return quantity must be greater than zero.')
  }
  if (!input.reason.trim()) throw new Error('Return reason is required.')

  const actorProfileId = await getActorProfileId(supabase, schoolId)

  const rpcArgs: {
    p_school_id: string
    p_item_id: string
    p_quantity: number
    p_reason: string
    p_recorded_by?: string
    p_purchase_order_id?: string
    p_return_date?: string
  } = {
    p_school_id: schoolId,
    p_item_id: input.itemId,
    p_quantity: Math.trunc(input.quantity),
    p_reason: input.reason.trim(),
  }

  if (actorProfileId) rpcArgs.p_recorded_by = actorProfileId
  if (input.purchaseOrderId) rpcArgs.p_purchase_order_id = input.purchaseOrderId
  if (input.returnDate) rpcArgs.p_return_date = input.returnDate

  const { error } = await supabase.rpc('record_inventory_vendor_return', rpcArgs)
  if (error) throw new Error(error.message)
}

export async function recordInventoryDamageAdjustment(
  schoolId: string,
  input: {
    itemId: string
    quantity: number
    reason: string
    damageDate?: string
  },
): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await requireActor(supabase, ['school_admin', 'manager', 'cashier'])
  await requirePermission(supabase, 'inventory.manage')

  if (!input.itemId) throw new Error('Inventory item is required.')
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error('Damage quantity must be greater than zero.')
  }
  if (!input.reason.trim()) throw new Error('Damage reason is required.')

  const actorProfileId = await getActorProfileId(supabase, schoolId)

  const rpcArgs: {
    p_school_id: string
    p_item_id: string
    p_quantity: number
    p_reason: string
    p_recorded_by?: string
    p_damage_date?: string
  } = {
    p_school_id: schoolId,
    p_item_id: input.itemId,
    p_quantity: Math.trunc(input.quantity),
    p_reason: input.reason.trim(),
  }

  if (actorProfileId) rpcArgs.p_recorded_by = actorProfileId
  if (input.damageDate) rpcArgs.p_damage_date = input.damageDate

  const { error } = await supabase.rpc('record_inventory_damage_adjustment', rpcArgs)
  if (error) throw new Error(error.message)
}

export async function getInventoryPurchaseOrders(
  schoolId: string,
  opts?: { status?: InventoryPurchaseOrderListRow['status']; limit?: number },
): Promise<InventoryPurchaseOrderListRow[]> {
  const supabase = await createServerSupabaseClient()
  await requireActor(supabase, ['school_admin', 'manager', 'cashier'])
  await requirePermission(supabase, 'inventory.manage')

  let poQuery = supabase
    .from('inventory_purchase_orders')
    .select('*')
    .eq('school_id', schoolId)
    .order('order_date', { ascending: false })
    .limit(opts?.limit ?? 100)

  if (opts?.status) {
    poQuery = poQuery.eq('status', opts.status)
  }

  const { data: purchaseOrders, error: poErr } = await poQuery
  if (poErr) throw new Error(poErr.message)

  const poRows = (purchaseOrders ?? []) as InventoryPurchaseOrderDbRow[]
  if (poRows.length === 0) return []

  const purchaseOrderIds = poRows.map((row) => row.id)
  const profileIds = [...new Set(poRows.flatMap((row) => [row.requested_by, row.approved_by, row.reviewed_by].filter(Boolean) as string[]))]
  const supplierIds = [...new Set(poRows.map((row) => row.supplier_id).filter(Boolean) as string[])]

  const [{ data: poItems, error: itemsErr }, { data: items, error: itemErr }, { data: profiles, error: profileErr }, { data: suppliers, error: supplierErr }] = await Promise.all([
    supabase
      .from('inventory_purchase_order_items')
      .select('*')
      .in('purchase_order_id', purchaseOrderIds),
    supabase
      .from('inventory_items')
      .select('id, name')
      .eq('school_id', schoolId),
    profileIds.length
      ? supabase
        .from('user_profiles')
        .select('id, full_name')
        .in('id', profileIds)
      : Promise.resolve({ data: [], error: null }),
    supplierIds.length
      ? supabase
        .from('inventory_suppliers')
        .select('id, name')
        .in('id', supplierIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (itemsErr) throw new Error(itemsErr.message)
  if (itemErr) throw new Error(itemErr.message)
  if (profileErr) throw new Error(profileErr.message)
  if (supplierErr) throw new Error(supplierErr.message)

  const itemsById = new Map((items ?? []).map((row) => [row.id, row.name]))
  const profileById = new Map((profiles ?? []).map((row) => [row.id, row.full_name]))
  const supplierById = new Map((suppliers ?? []).map((row) => [row.id, row.name]))
  const poItemsByPoId = new Map<string, InventoryPurchaseOrderItemDbRow[]>()

  for (const poItem of (poItems ?? []) as InventoryPurchaseOrderItemDbRow[]) {
    const list = poItemsByPoId.get(poItem.purchase_order_id) ?? []
    list.push(poItem)
    poItemsByPoId.set(poItem.purchase_order_id, list)
  }

  return poRows.map((row) => {
    const lines = (poItemsByPoId.get(row.id) ?? []).map((line) => ({
      id: line.id,
      itemId: line.item_id,
      itemName: itemsById.get(line.item_id) ?? 'Unknown item',
      orderedQuantity: Number(line.ordered_quantity),
      receivedQuantity: Number(line.received_quantity),
      pendingQuantity: Math.max(0, Number(line.ordered_quantity) - Number(line.received_quantity)),
      unitCost: Number(line.unit_cost),
    }))

    return {
      id: row.id,
      schoolId: row.school_id,
      supplierId: row.supplier_id,
      supplierName: row.supplier_id ? (supplierById.get(row.supplier_id) ?? row.vendor_name) : row.vendor_name,
      poNumber: row.po_number,
      vendorName: row.vendor_name,
      orderDate: row.order_date,
      expectedDate: row.expected_date,
      status: toPurchaseOrderStatus(row.status),
      notes: row.notes,
      requestedBy: row.requested_by,
      requestedByName: row.requested_by ? (profileById.get(row.requested_by) ?? null) : null,
      approvedBy: row.approved_by,
      approvedByName: row.approved_by ? (profileById.get(row.approved_by) ?? null) : null,
      reviewedBy: row.reviewed_by,
      reviewedByName: row.reviewed_by ? (profileById.get(row.reviewed_by) ?? null) : null,
      reviewedAt: row.reviewed_at,
      approvalNotes: row.approval_notes,
      createdAt: row.created_at,
      items: lines,
    }
  })
}

export async function getInventoryStockReductionLogs(
  schoolId: string,
  opts?: { limit?: number },
): Promise<InventoryStockReductionLogRow[]> {
  const supabase = await createServerSupabaseClient()
  await requireActor(supabase, ['school_admin', 'manager', 'cashier'])
  await requirePermission(supabase, 'inventory.manage')

  const limit = opts?.limit ?? 50

  const [{ data: returns, error: returnErr }, { data: damages, error: damageErr }, { data: items, error: itemErr }, { data: profiles, error: profileErr }] = await Promise.all([
    supabase
      .from('inventory_vendor_returns')
      .select('*')
      .eq('school_id', schoolId)
      .order('return_date', { ascending: false })
      .limit(limit),
    supabase
      .from('inventory_damage_adjustments')
      .select('*')
      .eq('school_id', schoolId)
      .order('damage_date', { ascending: false })
      .limit(limit),
    supabase
      .from('inventory_items')
      .select('id, name')
      .eq('school_id', schoolId),
    supabase
      .from('user_profiles')
      .select('id, full_name')
      .eq('school_id', schoolId),
  ])

  if (returnErr) throw new Error(returnErr.message)
  if (damageErr) throw new Error(damageErr.message)
  if (itemErr) throw new Error(itemErr.message)
  if (profileErr) throw new Error(profileErr.message)

  const itemById = new Map((items ?? []).map((row) => [row.id, row.name]))
  const profileById = new Map((profiles ?? []).map((row) => [row.id, row.full_name]))

  const returnLogs: InventoryStockReductionLogRow[] = ((returns ?? []) as InventoryVendorReturnDbRow[]).map((row) => ({
    id: row.id,
    itemId: row.item_id,
    itemName: itemById.get(row.item_id) ?? 'Unknown item',
    quantity: Number(row.quantity),
    reason: row.reason,
    date: row.return_date,
    type: 'vendor_return',
    purchaseOrderId: row.purchase_order_id,
    recordedBy: row.recorded_by,
    recordedByName: row.recorded_by ? (profileById.get(row.recorded_by) ?? null) : null,
  }))

  const damageLogs: InventoryStockReductionLogRow[] = ((damages ?? []) as InventoryDamageAdjustmentDbRow[]).map((row) => ({
    id: row.id,
    itemId: row.item_id,
    itemName: itemById.get(row.item_id) ?? 'Unknown item',
    quantity: Number(row.quantity),
    reason: row.reason,
    date: row.damage_date,
    type: 'damage',
    recordedBy: row.recorded_by,
    recordedByName: row.recorded_by ? (profileById.get(row.recorded_by) ?? null) : null,
  }))

  return [...returnLogs, ...damageLogs]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit)
}

export async function getInventorySaleControlAuditReport(
  schoolId: string,
  opts?: {
    fromDate?: string
    toDate?: string
    slaHours?: number
  },
): Promise<{ rows: InventorySaleControlAuditRow[]; summary: InventorySaleControlAuditSummary }> {
  const supabase = await createServerSupabaseClient()
  await requireActor(supabase, ['school_admin', 'manager', 'cashier'])
  await requirePermission(supabase, 'inventory.manage')

  const fromDateIso = opts?.fromDate ? `${opts.fromDate}T00:00:00.000Z` : undefined
  const toDateIso = opts?.toDate ? `${opts.toDate}T23:59:59.999Z` : undefined

  const rpcArgs: {
    p_school_id: string
    p_sla_hours?: number
    p_from?: string
    p_to?: string
  } = {
    p_school_id: schoolId,
    p_sla_hours: Math.max(1, opts?.slaHours ?? 24),
  }
  if (fromDateIso) rpcArgs.p_from = fromDateIso
  if (toDateIso) rpcArgs.p_to = toDateIso

  const { data, error } = await supabase.rpc('get_inventory_sale_control_audit', rpcArgs)
  if (error) throw new Error(error.message)

  const rows: InventorySaleControlAuditRow[] = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    requestId: String(row.request_id ?? ''),
    saleId: String(row.sale_id ?? ''),
    billNumber: row.bill_number ? String(row.bill_number) : null,
    requestType: toSaleControlRequestType(String(row.request_type ?? 'void')),
    status: toSaleControlRequestStatus(String(row.status ?? 'pending')),
    reason: String(row.reason ?? ''),
    reversalReason: row.reversal_reason ? String(row.reversal_reason) : null,
    requestedAt: String(row.requested_at ?? ''),
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    executedAt: row.executed_at ? String(row.executed_at) : null,
    requestedByName: row.requested_by_name ? String(row.requested_by_name) : null,
    reviewedByName: row.reviewed_by_name ? String(row.reviewed_by_name) : null,
    agingHours: Number(row.aging_hours ?? 0),
    reviewTatHours: row.review_tat_hours == null ? null : Number(row.review_tat_hours),
    withinSla: Boolean(row.within_sla),
  }))

  const reviewTats = rows
    .map((row) => row.reviewTatHours)
    .filter((val): val is number => typeof val === 'number' && Number.isFinite(val))

  const summary: InventorySaleControlAuditSummary = {
    total: rows.length,
    pending: rows.filter((row) => row.status === 'pending').length,
    breaches: rows.filter((row) => row.status !== 'pending' && row.reviewTatHours != null && !row.withinSla).length,
    executed: rows.filter((row) => row.status === 'executed').length,
    rejected: rows.filter((row) => row.status === 'rejected').length,
    avgReviewTatHours: reviewTats.length
      ? Number((reviewTats.reduce((sum, value) => sum + value, 0) / reviewTats.length).toFixed(2))
      : 0,
  }

  return { rows, summary }
}

// ─── POS sale controls (void / return approval matrix) ─────────────────────

export interface InventorySaleControlRequestRow {
  id: string
  schoolId: string
  saleId: string
  requestType: 'void' | 'return'
  status: 'pending' | 'approved' | 'rejected' | 'executed'
  reason: string
  requestedBy: string
  requestedByName: string
  reviewedBy: string | null
  reviewedByName: string | null
  reviewNotes: string | null
  reviewedAt: string | null
  executedAt: string | null
  createdAt: string
  sale: {
    billNumber: string
    totalAmount: number
    paymentMode: InventorySaleInput['paymentMode']
    saleDate: string
    studentName: string | null
    studentAdmissionNumber: string | null
    isReversed: boolean
    reversalType: string | null
  } | null
}

function toSaleControlRequestType(value: string): 'void' | 'return' {
  return value === 'return' ? 'return' : 'void'
}

function toSaleControlRequestStatus(value: string): InventorySaleControlRequestRow['status'] {
  if (value === 'approved' || value === 'rejected' || value === 'executed') {
    return value
  }
  return 'pending'
}

export async function createInventorySaleControlRequest(
  schoolId: string,
  input: {
    saleId: string
    requestType: 'void' | 'return'
    reason: string
  },
): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await requireActor(supabase, ['school_admin', 'manager', 'cashier'])
  await requirePermission(supabase, 'inventory.manage')

  const actorProfileId = await getActorProfileId(supabase, schoolId)
  if (!actorProfileId) {
    throw new Error('Unable to resolve operator profile for this school.')
  }

  const trimmedReason = input.reason.trim()
  if (!trimmedReason) {
    throw new Error('Reason is required for a void/return request.')
  }

  const { data: sale, error: saleErr } = await supabase
    .from('inventory_sales')
    .select('id, is_reversed')
    .eq('school_id', schoolId)
    .eq('id', input.saleId)
    .maybeSingle()

  if (saleErr) throw new Error(saleErr.message)
  if (!sale) throw new Error('Sale not found for this school.')
  if (sale.is_reversed) throw new Error('Sale already reversed.')

  const { error } = await supabase
    .from('inventory_sale_control_requests')
    .insert({
      school_id: schoolId,
      sale_id: input.saleId,
      request_type: input.requestType,
      reason: trimmedReason,
      requested_by: actorProfileId,
      status: 'pending',
    })

  if (error) throw new Error(error.message)
}

export async function getInventorySaleControlRequests(
  schoolId: string,
  opts?: { status?: InventorySaleControlRequestRow['status']; limit?: number },
): Promise<InventorySaleControlRequestRow[]> {
  const supabase = await createServerSupabaseClient()
  await requireActor(supabase, ['school_admin', 'manager', 'cashier'])
  await requirePermission(supabase, 'inventory.manage')

  let requestQuery = supabase
    .from('inventory_sale_control_requests')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 100)

  if (opts?.status) {
    requestQuery = requestQuery.eq('status', opts.status)
  }

  const { data: requests, error: requestError } = await requestQuery
  if (requestError) throw new Error(requestError.message)

  const requestRows = (requests ?? []) as InventorySaleControlDbRow[]
  if (requestRows.length === 0) return []

  const saleIds = [...new Set(requestRows.map((row) => row.sale_id))]
  const profileIds = [...new Set(requestRows.flatMap((row) => [row.requested_by, row.reviewed_by].filter(Boolean) as string[]))]

  const [{ data: sales, error: salesErr }, { data: profiles, error: profileErr }] = await Promise.all([
    supabase
      .from('inventory_sales')
      .select('id, bill_number, total_amount, payment_mode, sale_date, student_id, is_reversed, reversal_type')
      .in('id', saleIds),
    supabase
      .from('user_profiles')
      .select('id, full_name')
      .in('id', profileIds),
  ])

  if (salesErr) throw new Error(salesErr.message)
  if (profileErr) throw new Error(profileErr.message)

  const studentIds = [...new Set((sales ?? []).map((sale) => sale.student_id).filter(Boolean) as string[])]
  const { data: students, error: studentsErr } = studentIds.length
    ? await supabase
      .from('students')
      .select('id, full_name, admission_number')
      .in('id', studentIds)
    : { data: [], error: null }

  if (studentsErr) throw new Error(studentsErr.message)

  const salesById = new Map((sales ?? []).map((sale) => [sale.id, sale]))
  const studentById = new Map((students ?? []).map((student) => [student.id, student]))
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]))

  return requestRows.map((row) => {
    const sale = salesById.get(row.sale_id)
    const student = sale?.student_id ? studentById.get(sale.student_id) : null
    return {
      id: row.id,
      schoolId: row.school_id,
      saleId: row.sale_id,
      requestType: toSaleControlRequestType(row.request_type),
      status: toSaleControlRequestStatus(row.status),
      reason: row.reason,
      requestedBy: row.requested_by,
      requestedByName: profileById.get(row.requested_by) ?? 'Unknown',
      reviewedBy: row.reviewed_by,
      reviewedByName: row.reviewed_by ? (profileById.get(row.reviewed_by) ?? null) : null,
      reviewNotes: row.review_notes,
      reviewedAt: row.reviewed_at,
      executedAt: row.executed_at,
      createdAt: row.created_at,
      sale: sale ? {
        billNumber: sale.bill_number,
        totalAmount: Number(sale.total_amount),
        paymentMode: sale.payment_mode,
        saleDate: sale.sale_date,
        studentName: student?.full_name ?? null,
        studentAdmissionNumber: student?.admission_number ?? null,
        isReversed: sale.is_reversed,
        reversalType: sale.reversal_type,
      } : null,
    }
  })
}

export async function reviewInventorySaleControlRequest(
  schoolId: string,
  requestId: string,
  decision: 'approved' | 'rejected',
  notes?: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await requireActor(supabase, ['school_admin'])
  await requirePermission(supabase, 'inventory.manage')

  const actorProfileId = await getActorProfileId(supabase, schoolId)

  const { data: request, error: readErr } = await supabase
    .from('inventory_sale_control_requests')
    .select('id, school_id, status')
    .eq('id', requestId)
    .maybeSingle()

  if (readErr) throw new Error(readErr.message)
  if (!request || request.school_id !== schoolId) {
    throw new Error('Sale control request not found for this school.')
  }

  if (decision === 'rejected') {
    const { error } = await supabase
      .from('inventory_sale_control_requests')
      .update({
        status: 'rejected',
        reviewed_by: actorProfileId ?? null,
        reviewed_at: new Date().toISOString(),
        review_notes: notes?.trim() || null,
      })
      .eq('id', requestId)

    if (error) throw new Error(error.message)
    return
  }

  const rpcArgs: {
    p_request_id: string
    p_decision: 'approved' | 'rejected'
    p_review_notes?: string
    p_reviewed_by?: string
  } = {
    p_request_id: requestId,
    p_decision: 'approved',
  }
  if (notes?.trim()) rpcArgs.p_review_notes = notes.trim()
  if (actorProfileId) rpcArgs.p_reviewed_by = actorProfileId

  const { error } = await supabase.rpc('review_inventory_sale_control_request', rpcArgs)
  if (error) throw new Error(error.message)
}
