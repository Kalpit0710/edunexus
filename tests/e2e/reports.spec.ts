import { test, expect } from '@playwright/test'

// Covers the Phase 2.5 Advanced Analytics surface on the school-admin reports
// page: fee collection summary, momentum/risk analytics, and enrollment.
test.describe('Reports & Analytics (Phase 2.5)', () => {
  test.use({ storageState: 'tests/e2e/.auth/school-admin.json' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/school-admin/dashboard')
    await page.waitForURL(/\/school-admin\/dashboard/, { timeout: 45_000 })
  })

  test('reports page renders the analytics header and fee summary', async ({ page }) => {
    await page.goto('/school-admin/reports')
    await expect(page).toHaveURL(/\/school-admin\/reports/)
    await expect(page.getByRole('heading', { name: /reports & analytics/i })).toBeVisible()
    await expect(page.getByText(/fee collection \(current academic year\)/i)).toBeVisible()
  })

  test('fee collection cards load with collected and outstanding totals', async ({ page }) => {
    await page.goto('/school-admin/reports')
    await expect(page.getByText('Collected', { exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Outstanding', { exact: true })).toBeVisible()
  })

  test('enrollment summary is present', async ({ page }) => {
    await page.goto('/school-admin/reports')
    await expect(page.getByText(/overall enrollment summary/i)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/total students/i)).toBeVisible()
  })
})
