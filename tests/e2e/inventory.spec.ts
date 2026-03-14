import { test, expect } from '@playwright/test'

const MANAGER = { email: 'manager@demo.school', password: 'Manager@1234' }

async function login(page: any, email: string, password: string) {
    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL(/\/manager\/dashboard/, { timeout: 45_000 })
}

test.describe('Inventory & POS Module (Phase 2.2)', () => {
    test.beforeEach(async ({ page }) => {
        await login(page, MANAGER.email, MANAGER.password)
    })

    test('can navigate to inventory list', async ({ page }) => {
        await page.goto('/manager/inventory')
        await expect(page).toHaveURL(/\/manager\/inventory/)
        await expect(page.getByText(/inventory management/i)).toBeVisible()
        await expect(page.getByRole('button', { name: /add item/i })).toBeVisible()
    })

    test('can navigate to add inventory form and see validation', async ({ page }) => {
        await page.goto('/manager/inventory/new')
        await expect(page).toHaveURL(/\/manager\/inventory\/new/)

        // Try to save empty form
        await page.getByRole('button', { name: /save item/i }).click()
        await expect(page.getByText(/item name is required/i)).toBeVisible()
    })

    test('stock adjustment page layout', async ({ page }) => {
        await page.goto('/manager/inventory/stock')
        await expect(page.getByText(/adjust stock/i)).toBeVisible()

        // Check adjustment types buttons are present
        await expect(page.getByRole('button', { name: /add stock/i })).toBeVisible()
        await expect(page.getByRole('button', { name: /remove stock/i })).toBeVisible()
        await expect(page.getByRole('button', { name: /set exact count/i })).toBeVisible()
    })

    test('pos interface structure', async ({ page }) => {
        await page.goto('/manager/inventory/pos')
        await expect(page.getByText(/point of sale/i)).toBeVisible()

        // Check empty cart state
        await expect(page.getByText(/cart is empty|scan or select items/i)).toBeVisible()

        // Check checkout button is disabled on empty cart
        const chargeBtn = page.getByRole('button', { name: /charge & print bill/i })
        await expect(chargeBtn).toBeDisabled()
    })

    test('inventory reports dashboard structure', async ({ page }) => {
        await page.goto('/manager/inventory/reports')
        await expect(page.getByText(/inventory reports/i)).toBeVisible()

        // Check for key cards
        await expect(page.getByText(/total assets value/i)).toBeVisible()
        await expect(page.getByText(/low stock alerts/i)).toBeVisible()
        await expect(page.getByText(/sales ledger/i)).toBeVisible()
    })
})
