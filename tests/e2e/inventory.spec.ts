import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const E2E_MANAGER_EMAIL = env.E2E_MANAGER_EMAIL || process.env.E2E_MANAGER_EMAIL || 'manager.login@demo.school'
const E2E_SCHOOL_ADMIN_EMAIL = env.E2E_SCHOOL_ADMIN_EMAIL || process.env.E2E_SCHOOL_ADMIN_EMAIL || 'admin.login@demo.school'
const hasServiceCreds = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY)
const runtimeCredentialsPath = resolve(process.cwd(), 'tests/e2e/.auth/runtime-credentials.json')

let admin: SupabaseClient | null = null

async function getAdmin(): Promise<SupabaseClient> {
    if (admin) return admin
    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    })
    return admin
}

async function getProfileByEmail(email: string) {
    const db = await getAdmin()
    const { data, error } = await db
        .from('user_profiles')
        .select('id, school_id, full_name, role')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    if (error || !data) throw new Error(`Unable to resolve profile for ${email}: ${error?.message}`)
    return data
}

function getRuntimeEmail(role: 'schoolAdmin' | 'manager'): string {
    if (existsSync(runtimeCredentialsPath)) {
        try {
            const runtime = JSON.parse(readFileSync(runtimeCredentialsPath, 'utf8')) as {
                schoolAdmin?: { email?: string }
                manager?: { email?: string }
            }
            const runtimeEmail = role === 'schoolAdmin' ? runtime.schoolAdmin?.email : runtime.manager?.email
            if (runtimeEmail) return runtimeEmail
        } catch {
            // fall back to env/default credentials below
        }
    }

    return role === 'schoolAdmin' ? E2E_SCHOOL_ADMIN_EMAIL : E2E_MANAGER_EMAIL
}

async function seedInventoryItem(schoolId: string, createdBy: string, namePrefix: string) {
    const db = await getAdmin()
    const { data, error } = await db
        .from('inventory_items')
        .insert({
            school_id: schoolId,
            name: `${namePrefix} ${Date.now()}`,
            category: 'book',
            sku: `SKU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
            unit_price: 125,
            stock_quantity: 20,
            low_stock_alert: 5,
            created_by: createdBy,
            is_active: true,
        })
        .select('id, name')
        .single()
    if (error || !data) throw new Error(`Failed to seed inventory item: ${error?.message}`)
    return data
}

async function seedSupplier(schoolId: string, createdBy: string, namePrefix: string) {
    const db = await getAdmin()
    const { data, error } = await db
        .from('inventory_suppliers')
        .insert({
            school_id: schoolId,
            name: `${namePrefix} ${Date.now()}`,
            contact_person: 'E2E Contact',
            phone: '9999999999',
            email: 'supplier@example.com',
            created_by: createdBy,
            is_active: true,
        })
        .select('id, name')
        .single()
    if (error || !data) throw new Error(`Failed to seed supplier: ${error?.message}`)
    return data
}

async function seedPendingPurchaseOrder(schoolId: string, supplierId: string, requestedBy: string, itemId: string) {
    const db = await getAdmin()
    const poNumber = `E2E-PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const { data: po, error: poErr } = await db
        .from('inventory_purchase_orders')
        .insert({
            school_id: schoolId,
            supplier_id: supplierId,
            po_number: poNumber,
            vendor_name: 'E2E Supplier',
            order_date: new Date().toISOString().slice(0, 10),
            status: 'pending_approval',
            requested_by: requestedBy,
        })
        .select('id, po_number')
        .single()
    if (poErr || !po) throw new Error(`Failed to seed PO: ${poErr?.message}`)

    const { error: lineErr } = await db
        .from('inventory_purchase_order_items')
        .insert({
            school_id: schoolId,
            purchase_order_id: po.id,
            item_id: itemId,
            ordered_quantity: 4,
            unit_cost: 90,
            received_quantity: 0,
        })
    if (lineErr) throw new Error(`Failed to seed PO line: ${lineErr.message}`)

    return po
}

async function seedPendingSaleControlRequest(schoolId: string, requestedBy: string, itemId: string) {
    const db = await getAdmin()
    const billNumber = `E2E-SC-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const { data: sale, error: saleErr } = await db
        .from('inventory_sales')
        .insert({
            school_id: schoolId,
            bill_number: billNumber,
            total_amount: 250,
            payment_mode: 'cash',
            sold_by: requestedBy,
        })
        .select('id')
        .single()
    if (saleErr || !sale) throw new Error(`Failed to seed sale: ${saleErr?.message}`)

    const { error: saleItemErr } = await db
        .from('inventory_sale_items')
        .insert({
            school_id: schoolId,
            sale_id: sale.id,
            item_id: itemId,
            quantity: 2,
            unit_price: 125,
            total_price: 250,
        })
    if (saleItemErr) throw new Error(`Failed to seed sale item: ${saleItemErr.message}`)

    const { data: request, error: requestErr } = await db
        .from('inventory_sale_control_requests')
        .insert({
            school_id: schoolId,
            sale_id: sale.id,
            request_type: 'void',
            status: 'pending',
            reason: 'E2E approval flow',
            requested_by: requestedBy,
        })
        .select('id')
        .single()
    if (requestErr || !request) throw new Error(`Failed to seed sale control request: ${requestErr?.message}`)

    return { billNumber, requestId: request.id }
}

async function gotoStableRoute(
    page: import('@playwright/test').Page,
    url: string,
    ready: () => Promise<void>,
    attempts = 3,
) {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        await page.goto(url)
        try {
            await ready()
            return
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))
            const isNotFound = await page.getByText(/this page could not be found\./i).isVisible().catch(() => false)
            if (!isNotFound) {
                throw lastError
            }
        }
    }

    throw lastError ?? new Error(`Route ${url} did not stabilize`)
}

test.describe('Inventory & POS Module (Phase 2.2)', () => {
    test.use({ storageState: 'tests/e2e/.auth/manager.json' })

    test('can navigate to inventory list', async ({ page }) => {
        await page.goto('/manager/inventory')
        await page.waitForURL(/\/manager\/inventory/, { timeout: 30_000 })
        await expect(page).toHaveURL(/\/manager\/inventory/)
        await expect(page.getByText(/inventory management/i)).toBeVisible()
        await expect(page.getByRole('button', { name: /add item/i })).toBeVisible()
    })

    test('can navigate to add inventory form and see validation', async ({ page }) => {
        await page.goto('/manager/inventory/new')
        await page.waitForURL(/\/manager\/inventory\/new/, { timeout: 30_000 })
        await expect(page).toHaveURL(/\/manager\/inventory\/new/)
        await page.getByRole('button', { name: /save item/i }).click()
        await expect(page.getByText(/item name is required/i)).toBeVisible()
    })

    test('stock adjustment page layout', async ({ page }) => {
        await page.goto('/manager/inventory/stock')
        await page.waitForURL(/\/manager\/inventory\/stock/, { timeout: 30_000 })
        await expect(page.getByText(/adjust stock/i)).toBeVisible()
        await expect(page.getByRole('button', { name: /add stock/i })).toBeVisible()
        await expect(page.getByRole('button', { name: /remove stock/i })).toBeVisible()
        await expect(page.getByRole('button', { name: /set exact count/i })).toBeVisible()
    })

    test('pos interface structure', async ({ page }) => {
        await gotoStableRoute(page, '/manager/inventory/pos', async () => {
            await expect(page.getByRole('heading', { name: 'Point of Sale' })).toBeVisible({ timeout: 45_000 })
        })
        // Verify cart is empty on initial load
        const cartEmpty = page.getByText(/cart is empty|tap items|scan.*items/i)
        await expect(cartEmpty).toBeVisible()
        const chargeBtn = page.getByRole('button', { name: /charge & print bill/i })
        await expect(chargeBtn).toBeVisible({ timeout: 10_000 })
        await expect(chargeBtn).toBeDisabled()
    })

    test('inventory reports dashboard structure', async ({ page }) => {
        await gotoStableRoute(page, '/manager/inventory/reports', async () => {
            await expect(page.getByRole('heading', { name: /inventory reports/i })).toBeVisible({ timeout: 45_000 })
        })
        await expect(page.getByText('Total Assets Value', { exact: true })).toBeVisible()
        await expect(page.getByText('Low Stock Alerts', { exact: true })).toBeVisible()
        await expect(page.getByText(/sales ledger/i)).toBeVisible()
        await expect(page.getByText(/sale control audit/i)).toBeVisible()
    })

    test('manager can create supplier and submit a PO for approval', async ({ page }) => {
        test.skip(!hasServiceCreds, 'Supabase service-role creds required for inventory e2e seeding')

        const managerProfile = await getProfileByEmail(getRuntimeEmail('manager'))
        const item = await seedInventoryItem(managerProfile.school_id, managerProfile.id, 'E2E PO Item')
        const supplierName = `E2E Supplier ${Date.now()}`

        await gotoStableRoute(page, '/manager/inventory/procurement', async () => {
            await expect(page.getByRole('heading', { name: /procurement lifecycle/i })).toBeVisible({ timeout: 45_000 })
        })

        // Verify procurement form is ready before filling
        await expect(page.getByLabel(/supplier name/i)).toBeVisible({ timeout: 10_000 })
        await page.getByLabel(/supplier name/i).fill(supplierName)
        await page.getByLabel(/contact person/i).fill('Procurement Bot')
        await page.getByRole('button', { name: /create supplier/i }).click()
        await expect(page.getByText(new RegExp(supplierName, 'i'))).toBeVisible({ timeout: 15_000 })

        // Select supplier from dropdown with proper waits
        const supplierCombo = page.locator('[role="combobox"]').first()
        await supplierCombo.click()
        await page.getByRole('option', { name: new RegExp(supplierName, 'i') }).first().click()
        await page.waitForTimeout(500) // Brief wait for selection to register

        // Select item from dropdown
        const itemCombo = page.locator('[role="combobox"]').nth(1)
        await itemCombo.click()
        await page.getByRole('option', { name: new RegExp(item.name, 'i') }).first().click()
        await page.waitForTimeout(500) // Brief wait for selection to register

        // Fill quantity and unit cost with specific labels
        await page.getByLabel(/quantity|ordered amount/i).fill('3')
        await page.getByLabel(/unit cost|cost per unit/i).fill('95')

        await page.getByRole('button', { name: /^create po$/i }).click()

        await expect(page.getByText(/pending approval/i)).toBeVisible({ timeout: 15_000 })
        await expect(page.getByText(new RegExp(supplierName, 'i'))).toBeVisible()
    })
})

test.describe('Inventory Approval Flows', () => {
    test.describe('PO approval', () => {
        test.use({ storageState: 'tests/e2e/.auth/school-admin.json' })

        test('school admin can approve a pending PO and unlock receiving', async ({ page }) => {
            test.skip(!hasServiceCreds, 'Supabase service-role creds required for inventory e2e seeding')

            const adminProfile = await getProfileByEmail(getRuntimeEmail('schoolAdmin'))
            const managerProfile = await getProfileByEmail(getRuntimeEmail('manager'))
            const supplier = await seedSupplier(adminProfile.school_id, managerProfile.id, 'E2E Approval Supplier')
            const item = await seedInventoryItem(adminProfile.school_id, managerProfile.id, 'E2E Approval Item')
            const po = await seedPendingPurchaseOrder(adminProfile.school_id, supplier.id, managerProfile.id, item.id)

            await gotoStableRoute(page, '/manager/inventory/procurement', async () => {
                await expect(page.getByRole('heading', { name: /procurement lifecycle/i })).toBeVisible({ timeout: 45_000 })
            })
            await expect(page.getByText(new RegExp(po.po_number, 'i'))).toBeVisible({ timeout: 20_000 })
            // Wait for approve button to be enabled before clicking
            await expect(page.getByRole('button', { name: /^approve$/i }).first()).toBeEnabled({ timeout: 10_000 })
            await page.getByRole('button', { name: /^approve$/i }).first().click()

            await expect(page.getByText(/receive pending/i)).toBeVisible({ timeout: 15_000 })
            await expect(page.getByText(/approved/i)).toBeVisible()
        })
    })

    test.describe('Sale-control approval', () => {
        test.use({ storageState: 'tests/e2e/.auth/school-admin.json' })

        test('school admin can approve and execute a pending sale-control request', async ({ page }) => {
            test.skip(!hasServiceCreds, 'Supabase service-role creds required for inventory e2e seeding')

            const adminProfile = await getProfileByEmail(getRuntimeEmail('schoolAdmin'))
            const managerProfile = await getProfileByEmail(getRuntimeEmail('manager'))
            const item = await seedInventoryItem(adminProfile.school_id, managerProfile.id, 'E2E Sale Control Item')
            const seeded = await seedPendingSaleControlRequest(adminProfile.school_id, managerProfile.id, item.id)

            await gotoStableRoute(page, '/manager/inventory/sale-controls', async () => {
                await expect(page.getByRole('heading', { name: /pos sale controls/i })).toBeVisible({ timeout: 45_000 })
            })
            await expect(page.getByText(new RegExp(seeded.billNumber, 'i'))).toBeVisible({ timeout: 20_000 })
            // Wait for approve button to be enabled before clicking
            await expect(page.getByRole('button', { name: /approve & execute/i }).first()).toBeEnabled({ timeout: 10_000 })
            await page.getByRole('button', { name: /approve & execute/i }).first().click()

            await expect(page.getByText(/executed/i)).toBeVisible({ timeout: 15_000 })
        })
    })
})
