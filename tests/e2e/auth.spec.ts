/**
 * Comprehensive E2E tests for EduNexus
 * Covers: login for all roles, role-specific redirects, sidebar nav, and key page access
 */
import { test, expect } from '@playwright/test'

// ── Authentication ────────────────────────────────────────────────────────────
test.describe('Authentication', () => {
  test('login page loads correctly', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle(/EduNexus/)
    await expect(page.getByText('EduNexus').first()).toBeVisible()
  })

  test('unauthenticated user redirected to login', async ({ page }) => {
    await page.goto('/school-admin/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated teacher route redirected to login', async ({ page }) => {
    await page.goto('/teacher/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated manager route redirected to login', async ({ page }) => {
    await page.goto('/manager/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })
})

// ── School Admin role ─────────────────────────────────────────────────────────
test.describe('School Admin role', () => {
  test.use({ storageState: 'tests/e2e/.auth/school-admin.json' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/school-admin/dashboard')
    await page.waitForURL(/\/school-admin\/dashboard/, { timeout: 45_000 })
  })

  test('redirected to school-admin dashboard after login', async ({ page }) => {
    await expect(page).toHaveURL(/\/school-admin\/dashboard/)
  })

  test('sidebar navigation is visible', async ({ page }) => {
    await expect(page.locator('a[href="/school-admin/dashboard"]').first()).toBeVisible()
    await expect(page.locator('a[href="/school-admin/students"]').first()).toBeVisible()
    await expect(page.locator('a[href="/school-admin/teachers"]').first()).toBeVisible()
    await expect(page.locator('a[href="/school-admin/attendance"]').first()).toBeVisible()
    await expect(page.locator('a[href="/school-admin/fees"]').first()).toBeVisible()
    await expect(page.locator('a[href="/school-admin/settings"]').first()).toBeVisible()
  })

  test('can navigate to Students page', async ({ page }) => {
    await page.goto('/school-admin/students')
    await expect(page).toHaveURL(/\/school-admin\/students/)
    await expect(page.getByText(/student directory/i)).toBeVisible()
  })

  test('can navigate to Teachers page', async ({ page }) => {
    await page.goto('/school-admin/teachers')
    await expect(page).toHaveURL(/\/school-admin\/teachers/)
    await expect(page.getByText(/teacher directory/i)).toBeVisible()
  })

  test('can navigate to Attendance page', async ({ page }) => {
    await page.goto('/school-admin/attendance')
    await expect(page).toHaveURL(/\/school-admin\/attendance/)
    await expect(page.getByText(/daily attendance/i)).toBeVisible()
  })

  test('can navigate to Fees page', async ({ page }) => {
    await page.goto('/school-admin/fees')
    await expect(page).toHaveURL(/\/school-admin\/fees/)
    await expect(page.getByRole('heading', { name: /fee\s*&\s*billing/i })).toBeVisible()
  })

  test('can navigate to Settings page', async ({ page }) => {
    await page.goto('/school-admin/settings')
    await expect(page).toHaveURL(/\/school-admin\/settings/)
    await expect(page.getByText(/school configuration/i)).toBeVisible()
  })

  test('settings academic tab shows proper month names', async ({ page }) => {
    await page.goto('/school-admin/settings')
    // Click academic year tab
    await page.getByRole('tab', { name: /academic/i }).click()
    // Month dropdown should show friendly names
    const monthSelect = page.locator('select').first()
    const optionText = await monthSelect.locator('option').first().textContent()
    // Should be "January" not "Month 1"
    expect(optionText).not.toMatch(/^Month \d/)
  })

  test('add student form renders required wizard fields', async ({ page }) => {
    await page.goto('/school-admin/students/new')
    await expect(page.getByText(/add new student/i)).toBeVisible()
    await expect(page.locator('input').first()).toBeVisible()
    await expect(page.locator('select').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /next/i })).toBeVisible()
  })
})

// ── Teacher role ─────────────────────────────────────────────────────────────
test.describe('Teacher role', () => {
  test.use({ storageState: 'tests/e2e/.auth/teacher.json' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/teacher/dashboard')
    await page.waitForURL(/\/teacher\/dashboard/, { timeout: 45_000 })
  })

  test('redirected to teacher dashboard after login', async ({ page }) => {
    await expect(page).toHaveURL(/\/teacher\/dashboard/)
  })

  test('teacher sidebar is visible', async ({ page }) => {
    await expect(page.locator('a[href="/teacher/dashboard"]').first()).toBeVisible()
  })

  test('teacher dashboard shows key stats', async ({ page }) => {
    await expect(page.getByText(/total assignments/i)).toBeVisible()
    await expect(page.getByText(/pending attendance/i)).toBeVisible()
  })
})

// ── Manager role ─────────────────────────────────────────────────────────────
test.describe('Manager role', () => {
  test.use({ storageState: 'tests/e2e/.auth/manager.json' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/manager/dashboard')
    await page.waitForURL(/\/manager\/dashboard/, { timeout: 45_000 })
  })

  test('redirected to manager dashboard after login', async ({ page }) => {
    await expect(page).toHaveURL(/\/manager\/dashboard/)
  })

  test('manager sidebar is visible', async ({ page }) => {
    await expect(page.locator('a[href="/manager/dashboard"]').first()).toBeVisible()
  })

  test('manager dashboard shows collection insights', async ({ page }) => {
    await expect(page.getByText(/fee collection trend/i)).toBeVisible()
    await expect(page.getByText(/today's collection/i)).toBeVisible()
  })
})

// ── Sign-out flow ────────────────────────────────────────────────────────────
test.describe('Sign-out', () => {
  test.use({ storageState: 'tests/e2e/.auth/school-admin.json' })

  test('cleared session redirects to login', async ({ page }) => {
    await page.goto('/school-admin/dashboard')
    await page.waitForURL(/\/school-admin\/dashboard/, { timeout: 45_000 })
    await page.context().clearCookies()
    await page.goto('/school-admin/dashboard')
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })
})
