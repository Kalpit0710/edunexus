import { test as setup, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const authFileByRole = {
  schoolAdmin: 'tests/e2e/.auth/school-admin.json',
  teacher: 'tests/e2e/.auth/teacher.json',
  manager: 'tests/e2e/.auth/manager.json',
}

const runtimeCredentialsPath = 'tests/e2e/.auth/runtime-credentials.json'

const credentialCandidates = {
  schoolAdmin: [
    {
      email: process.env.E2E_SCHOOL_ADMIN_EMAIL ?? 'admin.login@demo.school',
      password: process.env.E2E_SCHOOL_ADMIN_PASSWORD ?? 'Admin@1234',
      dashboardPath: /\/school-admin(\/|$)/,
    },
    {
      email: 'admin@demo.school',
      password: 'Admin@1234',
      dashboardPath: /\/school-admin(\/|$)/,
    },
  ],
  teacher: [
    {
      email: process.env.E2E_TEACHER_EMAIL ?? 'teacher1.login@demo.school',
      password: process.env.E2E_TEACHER_PASSWORD ?? 'Teacher@1234',
      dashboardPath: /\/teacher\/dashboard/,
    },
    {
      email: 'teacher@demo.school',
      password: 'Teacher@1234',
      dashboardPath: /\/teacher\/dashboard/,
    },
  ],
  manager: [
    {
      email: process.env.E2E_MANAGER_EMAIL ?? 'manager.login@demo.school',
      password: process.env.E2E_MANAGER_PASSWORD ?? 'Manager@1234',
      dashboardPath: /\/manager(\/|$)/,
    },
    {
      email: 'manager@demo.school',
      password: 'Manager@1234',
      dashboardPath: /\/manager(\/|$)/,
    },
  ],
}

async function loginAndSaveState(
  browser: any,
  candidates: Array<{ email: string; password: string; dashboardPath: RegExp }>,
  storageStatePath: string
) {
  let lastError: Error | null = null

  for (const candidate of candidates) {
    const context = await browser.newContext()
    const page = await context.newPage()

    try {
      await page.goto('/login')
      await page.getByLabel('Email').fill(candidate.email)
      await page.getByLabel('Password').fill(candidate.password)
      await page.getByRole('button', { name: /sign in/i }).click()
      await page.waitForURL(candidate.dashboardPath, { timeout: 25_000 })
      await expect(page).toHaveURL(candidate.dashboardPath)
      await context.storageState({ path: storageStatePath })
      try {
        await context.close()
      } catch {
        // no-op
      }
      return
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error))
      try {
        await context.close()
      } catch {
        // no-op
      }
    }
  }

  throw new Error(`All login candidates failed for ${storageStatePath}: ${lastError?.message ?? 'unknown error'}`)
}

function loadRuntimeCredentials(): {
  schoolAdmin?: { email: string; password: string }
  teacher?: { email: string; password: string }
  manager?: { email: string; password: string }
} {
  if (!existsSync(runtimeCredentialsPath)) return {}
  return JSON.parse(readFileSync(runtimeCredentialsPath, 'utf8'))
}

setup('prepare auth storage states', async ({ browser }) => {
  try {
    execFileSync('node', ['scripts/seed-e2e-auth.mjs'], {
      stdio: 'inherit',
      env: process.env,
    })
  } catch {
    try {
      execFileSync('node', ['scripts/repair-seeded-auth.mjs'], {
        stdio: 'inherit',
        env: process.env,
      })
    } catch {
      execFileSync('node', ['scripts/create-dev-user.mjs'], {
        stdio: 'inherit',
        env: process.env,
      })
    }
  }

  const runtimeCredentials = loadRuntimeCredentials()

  const schoolAdminCandidates = runtimeCredentials.schoolAdmin
    ? [
        {
          email: runtimeCredentials.schoolAdmin.email,
          password: runtimeCredentials.schoolAdmin.password,
          dashboardPath: /\/school-admin(\/|$)/,
        },
        ...credentialCandidates.schoolAdmin,
      ]
    : credentialCandidates.schoolAdmin

  const teacherCandidates = runtimeCredentials.teacher
    ? [
        {
          email: runtimeCredentials.teacher.email,
          password: runtimeCredentials.teacher.password,
          dashboardPath: /\/teacher(\/|$)/,
        },
        ...credentialCandidates.teacher,
      ]
    : credentialCandidates.teacher

  const managerCandidates = runtimeCredentials.manager
    ? [
        {
          email: runtimeCredentials.manager.email,
          password: runtimeCredentials.manager.password,
          dashboardPath: /\/manager(\/|$)/,
        },
        ...credentialCandidates.manager,
      ]
    : credentialCandidates.manager

  await loginAndSaveState(browser, schoolAdminCandidates, authFileByRole.schoolAdmin)
  await loginAndSaveState(browser, teacherCandidates, authFileByRole.teacher)
  await loginAndSaveState(browser, managerCandidates, authFileByRole.manager)
})
