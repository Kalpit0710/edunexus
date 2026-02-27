import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('login page loads correctly', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle(/EduNexus/)
    await expect(page.getByText('EduNexus')).toBeVisible()
  })

  test('unauthenticated user redirected to login', async ({ page }) => {
    await page.goto('/school-admin/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })
})
