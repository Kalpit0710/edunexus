import { test, expect } from '@playwright/test'

test.describe('Attendance Module (Phase 1.7)', () => {
  test.use({ storageState: 'tests/e2e/.auth/school-admin.json' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/school-admin/dashboard')
    await page.waitForURL(/\/school-admin\/dashboard/, { timeout: 45_000 })
  })

  test('can navigate to the daily attendance page', async ({ page }) => {
    await page.goto('/school-admin/attendance')
    await expect(page).toHaveURL(/\/school-admin\/attendance/)
    await expect(page.getByText(/daily attendance/i)).toBeVisible()
    await expect(page.getByText(/select class & date/i)).toBeVisible()
  })

  test('daily attendance exposes class and section selectors', async ({ page }) => {
    await page.goto('/school-admin/attendance')
    await expect(page.getByText(/select class/i).first()).toBeVisible()
    await expect(page.getByText(/select section/i).first()).toBeVisible()
  })

  test('can navigate to the monthly attendance report', async ({ page }) => {
    await page.goto('/school-admin/attendance/report')
    await expect(page).toHaveURL(/\/school-admin\/attendance\/report/)
    await expect(page.getByText(/monthly attendance report/i)).toBeVisible()
    await expect(page.getByText(/report filters/i)).toBeVisible()
  })
})
