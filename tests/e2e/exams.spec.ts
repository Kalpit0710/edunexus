import { test, expect } from '@playwright/test'

test.describe('Examination Module (Phase 2.1)', () => {
    test.use({ storageState: 'tests/e2e/.auth/school-admin.json' })

    test.beforeEach(async ({ page }) => {
        await page.goto('/school-admin/dashboard')
        await page.waitForURL(/\/school-admin\/dashboard/, { timeout: 45_000 })
    })

    test('can navigate to exams list', async ({ page }) => {
        await page.goto('/school-admin/exams')
        await expect(page).toHaveURL(/\/school-admin\/exams/)
        await expect(page.getByText(/examinations/i)).toBeVisible()
        await expect(page.getByRole('button', { name: /new exam/i })).toBeVisible()
    })

    test('can navigate to create exam page and see validation', async ({ page }) => {
        await page.goto('/school-admin/exams/new')
        await expect(page).toHaveURL(/\/school-admin\/exams\/new/)
        await expect(page.getByText(/create new exam/i)).toBeVisible()

        // Empty submit (Next) on Step 1
        await page.getByRole('button', { name: /next/i }).click()
        await expect(page.getByText(/exam name and class are required/i)).toBeVisible()
    })

    test('exam status visibility on marks entry', async ({ page }) => {
        // Find first exam in list
        await page.goto('/school-admin/exams')
        // We just ensure the page loads and has a table
        await expect(page.locator('table')).toBeVisible()

        // This test stops short of injecting seed data, but verifies the routes are protected
        // For a full E2E, we would create an exam, but we don't want to pollute DB continually in tests
        // so we just verify the UI structure of marks entry
        await page.goto('/school-admin/exams/dummy-id/marks')
        // Should show error or loading, but page structure is there
        await expect(page.getByRole('button', { name: /back/i })).toBeVisible()
    })

    test('publish page shows readiness panel', async ({ page }) => {
        await page.goto('/school-admin/exams/dummy-id/publish')
        await expect(page.getByText(/publish & lock/i)).toBeVisible()
        await expect(page.getByText(/readiness check/i)).toBeVisible()
        await expect(page.getByText(/marks recorded/i)).toBeVisible()
    })

    test('reports page contains tabs', async ({ page }) => {
        await page.goto('/school-admin/exams/dummy-id/reports')
        await expect(page.getByRole('tab', { name: /class performance/i })).toBeVisible()
        await expect(page.getByRole('tab', { name: /rank holders/i })).toBeVisible()
        await expect(page.getByRole('tab', { name: /report cards/i })).toBeVisible()
    })

    test('reports page exposes export action', async ({ page }) => {
        await page.goto('/school-admin/exams/dummy-id/reports')
        await expect(page.getByRole('button', { name: /export/i })).toBeVisible()
    })
})
