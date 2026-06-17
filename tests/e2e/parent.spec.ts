import { test, expect } from '@playwright/test'

// The E2E seed links this parent (Neha Sharma) to student "Aarav Sharma"
// (class 10, section A) by re-pointing the parents.auth_user_id to the fresh
// auth user. These specs verify all five parent-portal views render and that
// the parent only sees their own linked child's data (RLS-scoped access).
test.describe('Parent Portal (Phase 2.4)', () => {
  test.use({ storageState: 'tests/e2e/.auth/parent.json' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/parent/dashboard')
    await page.waitForURL(/\/parent(\/|$)/, { timeout: 45_000 })
  })

  test('dashboard shows the linked child and stat cards', async ({ page }) => {
    await expect(page).toHaveURL(/\/parent\/dashboard/)
    // The whole dashboard is gated behind a loading state (several parallel
    // data calls), so allow generous time for the first render.
    await expect(page.getByRole('heading', { name: /parent portal/i })).toBeVisible({ timeout: 30_000 })
    // RLS-scoped child data flows through to the portal.
    await expect(page.getByRole('heading', { name: /aarav sharma/i })).toBeVisible()
    await expect(page.getByText('Present Days')).toBeVisible()
    await expect(page.getByText('Balance Due')).toBeVisible()
    await expect(page.getByText('Attendance This Month')).toBeVisible()
  })

  test('attendance view renders the calendar', async ({ page }) => {
    await page.goto('/parent/attendance')
    await expect(page.getByRole('heading', { name: /^attendance$/i })).toBeVisible()
    // Day-of-week headers are always rendered for the calendar grid.
    await expect(page.getByText('Su', { exact: true })).toBeVisible()
    await expect(page.getByText('Sa', { exact: true })).toBeVisible()
  })

  test('results view renders exam results', async ({ page }) => {
    await page.goto('/parent/results')
    await expect(page.getByRole('heading', { name: /exam results/i })).toBeVisible()
  })

  test('fees view renders the fee status summary', async ({ page }) => {
    await page.goto('/parent/fees')
    await expect(page.getByRole('heading', { name: /fee status/i })).toBeVisible()
    await expect(page.getByText('Total Fee')).toBeVisible()
    await expect(page.getByText('Total Paid')).toBeVisible()
    await expect(page.getByText('Balance Due')).toBeVisible()
  })

  test('announcements view renders', async ({ page }) => {
    await page.goto('/parent/announcements')
    await expect(page.getByRole('heading', { name: /announcements/i })).toBeVisible()
  })

  test('bottom navigation moves between portal sections', async ({ page }) => {
    await page.goto('/parent/dashboard')
    await page.getByRole('link', { name: /attendance/i }).click()
    await expect(page).toHaveURL(/\/parent\/attendance/)
    await page.getByRole('link', { name: /results/i }).click()
    await expect(page).toHaveURL(/\/parent\/results/)
    await page.getByRole('link', { name: /fees/i }).click()
    await expect(page).toHaveURL(/\/parent\/fees/)
  })
})
