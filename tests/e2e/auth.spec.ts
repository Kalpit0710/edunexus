/**
 * Comprehensive E2E tests for EduNexus
 * Covers: login for all roles, role-specific redirects, sidebar nav, and key page access
 */
import { test, expect } from '@playwright/test'

// ── Test credentials ─────────────────────────────────────────────────────────
const SCHOOL_ADMIN = { email: 'admin@demo.school', password: 'Admin@1234' }
const TEACHER = { email: 'teacher@demo.school', password: 'Teacher@1234' }
const MANAGER = { email: 'manager@demo.school', password: 'Manager@1234' }

// ── Helper to log in ─────────────────────────────────────────────────────────
async function login(page: any, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
}

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
  test.beforeEach(async ({ page }) => {
    await login(page, SCHOOL_ADMIN.email, SCHOOL_ADMIN.password)
    // Wait for redirect to dashboard
    await page.waitForURL(/\/school-admin\/dashboard/, { timeout: 45_000 })
  })

  test('redirected to school-admin dashboard after login', async ({ page }) => {
    await expect(page).toHaveURL(/\/school-admin\/dashboard/)
  })

  test('sidebar navigation is visible', async ({ page }) => {
    await expect(page.getByRole('link', { name: /dashboard/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /students/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /teachers/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /attendance/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /fees/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /settings/i })).toBeVisible()
  })

  test('can navigate to Students page', async ({ page }) => {
    await page.getByRole('link', { name: /students/i }).click()
    await expect(page).toHaveURL(/\/school-admin\/students/)
    await expect(page.getByText(/student directory/i)).toBeVisible()
  })

  test('can navigate to Teachers page', async ({ page }) => {
    await page.getByRole('link', { name: /teachers/i }).click()
    await expect(page).toHaveURL(/\/school-admin\/teachers/)
    await expect(page.getByText(/teacher directory/i)).toBeVisible()
  })

  test('can navigate to Attendance page', async ({ page }) => {
    await page.getByRole('link', { name: /attendance/i }).click()
    await expect(page).toHaveURL(/\/school-admin\/attendance/)
    await expect(page.getByText(/daily attendance/i)).toBeVisible()
  })

  test('can navigate to Fees page', async ({ page }) => {
    await page.getByRole('link', { name: /fees/i }).click()
    await expect(page).toHaveURL(/\/school-admin\/fees/)
    await expect(page.getByText(/fee.*billing/i)).toBeVisible()
  })

  test('can navigate to Settings page', async ({ page }) => {
    await page.getByRole('link', { name: /settings/i }).click()
    await expect(page).toHaveURL(/\/school-admin\/settings/)
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

  test('add student form shows class/section dropdowns', async ({ page }) => {
    await page.goto('/school-admin/students/new')
    // Navigate to step 2 (personal info first)
    await page.getByLabel(/first name/i).fill('Test')
    await page.locator('select').first().selectOption({ index: 1 }) // gender
    await page.getByLabel(/date of birth/i).fill('2010-01-01')
    await page.getByRole('button', { name: /next/i }).click()
    // Step 2 should have Class dropdown (a select element)
    await expect(page.locator('select').first()).toBeVisible()
  })
})

// ── Teacher role ─────────────────────────────────────────────────────────────
test.describe('Teacher role', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password)
    await page.waitForURL(/\/teacher\/dashboard/, { timeout: 45_000 })
  })

  test('redirected to teacher dashboard after login', async ({ page }) => {
    await expect(page).toHaveURL(/\/teacher\/dashboard/)
  })

  test('teacher sidebar is visible', async ({ page }) => {
    await expect(page.getByRole('link', { name: /dashboard/i }).first()).toBeVisible()
  })

  test('teacher dashboard shows Teacher Dashboard heading', async ({ page }) => {
    await expect(page.getByText(/teacher dashboard/i)).toBeVisible()
  })
})

// ── Manager role ─────────────────────────────────────────────────────────────
test.describe('Manager role', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, MANAGER.email, MANAGER.password)
    await page.waitForURL(/\/manager\/dashboard/, { timeout: 45_000 })
  })

  test('redirected to manager dashboard after login', async ({ page }) => {
    await expect(page).toHaveURL(/\/manager\/dashboard/)
  })

  test('manager sidebar is visible', async ({ page }) => {
    await expect(page.getByRole('link', { name: /dashboard/i }).first()).toBeVisible()
  })

  test('manager dashboard shows collection report', async ({ page }) => {
    await expect(page.getByText(/manager dashboard/i)).toBeVisible()
    await expect(page.getByText(/total collected/i)).toBeVisible()
  })
})

// ── Sign-out flow ────────────────────────────────────────────────────────────
test.describe('Sign-out', () => {
  test('school admin can sign out and is redirected to login', async ({ page }) => {
    await login(page, SCHOOL_ADMIN.email, SCHOOL_ADMIN.password)
    await page.waitForURL(/\/school-admin\/dashboard/, { timeout: 45_000 })
    // Click logout button (title="Sign out")
    await page.getByTitle('Sign out').click()
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })
})
