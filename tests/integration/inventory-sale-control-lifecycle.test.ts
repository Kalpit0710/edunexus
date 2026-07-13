import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

function loadEnv(): Record<string, string> {
  try {
    const envPath = resolve(process.cwd(), '.env.local')
    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)
    return Object.fromEntries(
      lines
        .filter((line) => /^\s*[^#]\S+=/.test(line))
        .map((line) => {
          const [key = '', ...value] = line.split('=')
          return [key.trim(), value.join('=').trim()]
        }),
    )
  } catch {
    return {}
  }
}

const env = loadEnv()
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const hasCreds = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY)

const suffix = `${Date.now()}${Math.floor(Math.random() * 100000)}`
const schoolId = crypto.randomUUID()
const adminEmail = `sale.control.${suffix}@e2e.local`
const adminPassword = 'SaleControl@1234'

let admin: SupabaseClient
let anonClient: SupabaseClient
let schoolAdminClient: SupabaseClient
let adminAuthUserId: string | null = null
let profileId = ''
let itemId = ''

async function reviewRequest(
  client: SupabaseClient,
  requestId: string,
  decision: 'approved' | 'rejected',
  reviewedBy: string,
) {
  return (client as unknown as { rpc: Function }).rpc('review_inventory_sale_control_request', {
    p_request_id: requestId,
    p_decision: decision,
    p_reviewed_by: reviewedBy,
  }) as Promise<{ data: unknown; error: { message: string } | null }>
}

async function createSeedSale(
  billNumber: string,
  soldQty: number,
  currentStockBeforeReview: number,
): Promise<{ saleId: string; requestId: string }> {
  const { data: sale, error: saleErr } = await admin
    .from('inventory_sales')
    .insert({
      school_id: schoolId,
      bill_number: billNumber,
      total_amount: 100,
      payment_mode: 'cash',
      sold_by: profileId,
    })
    .select('id')
    .single()

  if (saleErr || !sale) throw new Error(`Seed sale failed: ${saleErr?.message}`)

  const { error: saleItemErr } = await admin.from('inventory_sale_items').insert({
    school_id: schoolId,
    sale_id: sale.id,
    item_id: itemId,
    quantity: soldQty,
    unit_price: 50,
    total_price: soldQty * 50,
  })
  if (saleItemErr) throw new Error(`Seed sale item failed: ${saleItemErr.message}`)

  const { error: stockErr } = await admin
    .from('inventory_items')
    .update({ stock_quantity: currentStockBeforeReview })
    .eq('id', itemId)
    .eq('school_id', schoolId)
  if (stockErr) throw new Error(`Seed stock update failed: ${stockErr.message}`)

  const { data: request, error: reqErr } = await admin
    .from('inventory_sale_control_requests')
    .insert({
      school_id: schoolId,
      sale_id: sale.id,
      request_type: 'void',
      status: 'pending',
      reason: 'Integration test review',
      requested_by: profileId,
    })
    .select('id')
    .single()

  if (reqErr || !request) throw new Error(`Seed control request failed: ${reqErr?.message}`)

  return { saleId: sale.id, requestId: request.id }
}

describe.skipIf(!hasCreds)('inventory sale control lifecycle', () => {
  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { error: schoolErr } = await admin
      .from('schools')
      .insert({ id: schoolId, name: `Sale Control School ${suffix}`, code: `SCS${suffix}`, is_active: true })
    if (schoolErr) throw new Error(`Seed school failed: ${schoolErr.message}`)

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      app_metadata: { role: 'school_admin' },
    })
    if (createErr || !created.user) throw new Error(`Create auth user failed: ${createErr?.message}`)
    adminAuthUserId = created.user.id

    const { data: profile, error: profileErr } = await admin
      .from('user_profiles')
      .insert({
        auth_user_id: adminAuthUserId,
        school_id: schoolId,
        full_name: 'Sale Control Admin',
        email: adminEmail,
        role: 'school_admin',
        is_active: true,
      })
      .select('id')
      .single()
    if (profileErr || !profile) throw new Error(`Create profile failed: ${profileErr?.message}`)
    profileId = profile.id

    const { data: item, error: itemErr } = await admin
      .from('inventory_items')
      .insert({
        school_id: schoolId,
        name: `Integration Item ${suffix}`,
        category: 'book',
        unit_price: 50,
        stock_quantity: 10,
        low_stock_alert: 2,
        created_by: profileId,
      })
      .select('id')
      .single()
    if (itemErr || !item) throw new Error(`Create inventory item failed: ${itemErr?.message}`)
    itemId = item.id

    const { data: session, error: signInErr } = await anonClient.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    })
    if (signInErr || !session.session) throw new Error(`Sign in failed: ${signInErr?.message}`)

    schoolAdminClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${session.session.access_token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }, 60000)

  afterAll(async () => {
    if (!hasCreds || !admin) return
    await admin.from('schools').delete().eq('id', schoolId)
    if (adminAuthUserId) await admin.auth.admin.deleteUser(adminAuthUserId)
  }, 60000)

  it('approves and executes a control request, restoring stock and marking sale reversed', async () => {
    const { saleId, requestId } = await createSeedSale(`INV-SC-APP-${suffix}`, 3, 7)

    const { error: reviewErr } = await reviewRequest(schoolAdminClient, requestId, 'approved', profileId)
    expect(reviewErr).toBeNull()

    const { data: request } = await admin
      .from('inventory_sale_control_requests')
      .select('status, executed_at, reviewed_at, reviewed_by')
      .eq('id', requestId)
      .single()

    expect(request?.status).toBe('executed')
    expect(request?.executed_at).toBeTruthy()
    expect(request?.reviewed_at).toBeTruthy()
    expect(request?.reviewed_by).toBe(profileId)

    const { data: sale } = await admin
      .from('inventory_sales')
      .select('is_reversed, reversal_type, reversed_request_id')
      .eq('id', saleId)
      .single()

    expect(sale?.is_reversed).toBe(true)
    expect(sale?.reversal_type).toBe('void')
    expect(sale?.reversed_request_id).toBe(requestId)

    const { data: item } = await admin
      .from('inventory_items')
      .select('stock_quantity')
      .eq('id', itemId)
      .single()
    expect(Number(item?.stock_quantity)).toBe(10)

    const { data: adjustments } = await admin
      .from('stock_adjustments')
      .select('type, quantity, reason')
      .eq('school_id', schoolId)
      .eq('item_id', itemId)
      .ilike('reason', '%POS void reversal%')

    expect((adjustments ?? []).some((row) => row.type === 'adjustment' && Number(row.quantity) === 3)).toBe(true)
  }, 20000)

  it('rejects a pending control request without reversing the sale or changing stock', async () => {
    const { saleId, requestId } = await createSeedSale(`INV-SC-REJ-${suffix}`, 2, 6)

    const { error: reviewErr } = await reviewRequest(schoolAdminClient, requestId, 'rejected', profileId)
    expect(reviewErr).toBeNull()

    const { data: request } = await admin
      .from('inventory_sale_control_requests')
      .select('status, executed_at')
      .eq('id', requestId)
      .single()

    expect(request?.status).toBe('rejected')
    expect(request?.executed_at).toBeNull()

    const { data: sale } = await admin
      .from('inventory_sales')
      .select('is_reversed')
      .eq('id', saleId)
      .single()
    expect(sale?.is_reversed).toBe(false)

    const { data: item } = await admin
      .from('inventory_items')
      .select('stock_quantity')
      .eq('id', itemId)
      .single()
    expect(Number(item?.stock_quantity)).toBe(6)
  }, 20000)

  it('prevents reviewing the same request twice', async () => {
    const { requestId } = await createSeedSale(`INV-SC-2X-${suffix}`, 1, 5)

    const first = await reviewRequest(schoolAdminClient, requestId, 'approved', profileId)
    expect(first.error).toBeNull()

    const second = await reviewRequest(schoolAdminClient, requestId, 'approved', profileId)
    expect(second.error).not.toBeNull()
    expect(second.error?.message ?? '').toMatch(/pending/i)
  }, 20000)
})
