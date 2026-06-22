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
    // The dashboard fans out 5 parallel data calls (attendance summary + 6-month
    // trend, fee status, exam/performance trend) against a remote DB and only
    // leaves its loading skeleton once all settle, so allow a generous window.
    await expect(page.getByRole('heading', { name: /parent portal/i })).toBeVisible({ timeout: 60_000 })
    // RLS-scoped child data flows through to the portal.
    await expect(page.getByRole('heading', { name: /aarav sharma/i })).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText('Present Days')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText('Balance Due')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText('Attendance This Month')).toBeVisible({ timeout: 60_000 })
  })

  test('attendance view renders the calendar', async ({ page }) => {
    await page.goto('/parent/attendance')
    await expect(page.getByRole('heading', { name: /^attendance$/i })).toBeVisible({ timeout: 30_000 })
    // Day-of-week headers are always rendered for the calendar grid.
    await expect(page.getByText('Su', { exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Sa', { exact: true })).toBeVisible({ timeout: 30_000 })
  })

  test('results view renders exam results', async ({ page }) => {
    await page.goto('/parent/results')
    await expect(page.getByRole('heading', { name: /exam results/i })).toBeVisible({ timeout: 30_000 })
  })

  test('fees view renders the fee status summary', async ({ page }) => {
    await page.goto('/parent/fees')
    await expect(page.getByRole('heading', { name: /fee status/i })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Total Fee')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Total Paid')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Balance Due')).toBeVisible({ timeout: 30_000 })
  })

  test('today feed renders the one-glance summary', async ({ page }) => {
    await page.goto('/parent/today')
    await expect(page.getByRole('heading', { name: /^today$/i })).toBeVisible({ timeout: 30_000 })
    // Data-dependent sections of the feed (these labels are <p>, not headings).
    await expect(page.getByText('Fee Balance')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/today.?s homework/i)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Latest Notice')).toBeVisible({ timeout: 30_000 })
  })

  test('announcements view renders', async ({ page }) => {
    await page.goto('/parent/announcements')
    await expect(page.getByRole('heading', { name: /announcements/i })).toBeVisible({ timeout: 30_000 })
  })

  test('bottom navigation moves between portal sections', async ({ page }) => {
    await page.goto('/parent/dashboard')
    await page.getByRole('link', { name: /attendance/i }).click()
    await expect(page).toHaveURL(/\/parent\/attendance/, { timeout: 30_000 })
    await page.getByRole('link', { name: /results/i }).click()
    await expect(page).toHaveURL(/\/parent\/results/, { timeout: 30_000 })
    await page.getByRole('link', { name: /fees/i }).click()
    await expect(page).toHaveURL(/\/parent\/fees/, { timeout: 30_000 })
  })
})
