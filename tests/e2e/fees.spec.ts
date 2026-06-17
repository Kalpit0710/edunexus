import { test, expect } from '@playwright/test'

test.describe('Fee & Billing Module (Phase 1.8)', () => {
  test.use({ storageState: 'tests/e2e/.auth/school-admin.json' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/school-admin/dashboard')
    await page.waitForURL(/\/school-admin\/dashboard/, { timeout: 45_000 })
  })

  test('can navigate to fee structure management', async ({ page }) => {
    await page.goto('/school-admin/fees')
    await expect(page).toHaveURL(/\/school-admin\/fees/)
    await expect(page.getByText(/fee & billing/i)).toBeVisible()
    await expect(page.getByText('Fee Categories', { exact: true })).toBeVisible()
    await expect(page.getByText('Fee Structures', { exact: true })).toBeVisible()
  })

  test('can navigate to the fee collection terminal', async ({ page }) => {
    await page.goto('/school-admin/fees/collect')
    await expect(page).toHaveURL(/\/school-admin\/fees\/collect/)
    await expect(page.getByText(/collect fee/i)).toBeVisible()
    await expect(page.getByPlaceholder(/admission no\. or student name/i)).toBeVisible()
  })

  test('fee collection requires a student search before charging', async ({ page }) => {
    await page.goto('/school-admin/fees/collect')
    await expect(page.getByText(/collect fee/i)).toBeVisible()
    // The search action is disabled until a query is typed.
    await expect(page.getByRole('button', { name: /^search$/i })).toBeDisabled()
  })

  test('can navigate to pending fees view', async ({ page }) => {
    await page.goto('/school-admin/fees/pending')
    await expect(page).toHaveURL(/\/school-admin\/fees\/pending/)
  })
})
