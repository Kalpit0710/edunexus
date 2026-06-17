import { test, expect } from '@playwright/test'

// "Term 1 Examination" from the dev seed (status locked, marks entered). Using a
// real exam id lets us exercise the marks-entry and report pages end-to-end.
const SEEDED_EXAM_ID = '57000000-0000-0000-0000-000000000001'

test.describe('Examination Module (Phase 2.1)', () => {
    test.use({ storageState: 'tests/e2e/.auth/school-admin.json' })

    test.beforeEach(async ({ page }) => {
        await page.goto('/school-admin/dashboard')
        await page.waitForURL(/\/school-admin\/dashboard/, { timeout: 45_000 })
    })

    test('can navigate to exams list', async ({ page }) => {
        await page.goto('/school-admin/exams')
        await expect(page).toHaveURL(/\/school-admin\/exams/)
        await expect(page.getByRole('heading', { name: /^exams$/i })).toBeVisible()
        await expect(page.getByRole('button', { name: /create exam/i })).toBeVisible()
    })

    test('can navigate to create exam page and see validation', async ({ page }) => {
        await page.goto('/school-admin/exams/new')
        await expect(page).toHaveURL(/\/school-admin\/exams\/new/)
        await expect(page.getByText(/create new exam/i)).toBeVisible()

        // Empty submit (Next) on Step 1
        await page.getByRole('button', { name: /next/i }).click()
        await expect(page.getByText(/exam name and class are required/i)).toBeVisible()
    })

    test('marks entry page loads for a seeded exam', async ({ page }) => {
        await page.goto(`/school-admin/exams/${SEEDED_EXAM_ID}/marks`)
        await expect(page.getByRole('heading', { name: /marks entry/i })).toBeVisible({ timeout: 20_000 })
    })

    test('reports page contains tabs for a seeded exam', async ({ page }) => {
        await page.goto(`/school-admin/exams/${SEEDED_EXAM_ID}/reports`)
        await expect(page.getByRole('tab', { name: /class performance/i })).toBeVisible({ timeout: 20_000 })
        await expect(page.getByRole('tab', { name: /rank holders/i })).toBeVisible()
        await expect(page.getByRole('tab', { name: /report cards/i })).toBeVisible()
    })

    test('report cards tab is reachable', async ({ page }) => {
        await page.goto(`/school-admin/exams/${SEEDED_EXAM_ID}/reports`)
        await page.getByRole('tab', { name: /report cards/i }).click()
        await expect(page.getByRole('tabpanel')).toBeVisible({ timeout: 20_000 })
    })
})
