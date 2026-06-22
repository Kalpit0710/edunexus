import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  timeout: 90000,
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  // A single local `pnpm dev` server compiles routes on first hit and talks to a
  // remote Supabase, so heavy parallelism starves data-dependent assertions.
  // Cap local workers and give web-first assertions a realistic window.
  workers: process.env.CI ? 1 : 2,
  expect: { timeout: 15_000 },
  reporter: [['html'], ['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // Setup project
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // Desktop Chrome
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    // NOTE: A Mobile Safari (webkit) project can be added back once the webkit
    // browser is provisioned in local + CI environments (`playwright install
    // webkit`). It was removed to avoid declaring a project that never runs.
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
