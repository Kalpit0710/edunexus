import { test, expect } from '@playwright/test'

test.describe('Analytics & Reports (Phase 2.5)', () => {
  test.describe('School Admin Reports', () => {
    test.use({ storageState: 'tests/e2e/.auth/school-admin.json' })

    test.beforeEach(async ({ page }) => {
      await page.goto('/school-admin/reports')
      await page.waitForURL(/\/school-admin\/reports/, { timeout: 45_000 })
    })

    test('reports page shows analytics sections', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /reports & analytics/i })).toBeVisible()
      await expect(page.getByText(/fee collection \(current academic year\)/i)).toBeVisible()
      await expect(page.getByText(/exam performance analytics/i)).toBeVisible()
      await expect(page.getByText(/advanced insights/i)).toBeVisible()
      await expect(page.getByText(/daily fee collection trend/i)).toBeVisible()
      await expect(page.getByText(/attendance by class/i)).toBeVisible()
    })

    test('exam analytics empty state is reachable', async ({ page }) => {
      await expect(page.getByText(/exam performance analytics/i)).toBeVisible()
      await expect(page.getByText(/no exam analytics available yet|pass-rate trend/i)).toBeVisible()
    })
  })

  test.describe('Manager Analytics Drilldowns', () => {
    test.use({ storageState: 'tests/e2e/.auth/manager.json' })

    test.beforeEach(async ({ page }) => {
      await page.goto('/manager/dashboard')
      await page.waitForURL(/\/manager\/dashboard/, { timeout: 45_000 })
    })

    test('manager dashboard shows analytics drilldowns', async ({ page }) => {
      await expect(page.getByText(/fee collection trend/i)).toBeVisible()
      await expect(page.getByText(/payment mode mix/i)).toBeVisible()
      await expect(page.getByText(/pending fee risk/i)).toBeVisible()
    })
  })
})
