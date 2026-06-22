import { test, expect } from '@playwright/test'

test.describe('Student Management (Phase 1.5)', () => {
  test.use({ storageState: 'tests/e2e/.auth/school-admin.json' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/school-admin/dashboard')
    await page.waitForURL(/\/school-admin\/dashboard/, { timeout: 45_000 })
  })

  test('can navigate to the student directory', async ({ page }) => {
    await page.goto('/school-admin/students')
    await expect(page).toHaveURL(/\/school-admin\/students/)
    await expect(page.getByRole('heading', { name: 'Student Directory' })).toBeVisible()
    await expect(page.getByPlaceholder(/search by name, adm no/i)).toBeVisible()
  })

  test('can open the add-student wizard', async ({ page }) => {
    await page.goto('/school-admin/students/new')
    await expect(page).toHaveURL(/\/school-admin\/students\/new/)
    await expect(page.getByText(/add new student/i)).toBeVisible()
    await expect(page.getByText(/personal details/i)).toBeVisible()
  })

  test('add-student wizard validates required step-1 fields', async ({ page }) => {
    await page.goto('/school-admin/students/new')
    await expect(page.getByText(/add new student/i)).toBeVisible()

    // Advance with an empty Step 1 — should surface a validation toast.
    await page.getByRole('button', { name: /next/i }).click()
    await expect(page.getByText(/required personal details/i)).toBeVisible()
  })
})
