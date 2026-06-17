import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['./tests/unit/**/*.test.{ts,tsx}', './tests/integration/**/*.test.{ts,tsx}'],
    exclude: ['./tests/e2e/**', 'node_modules'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules',
        'tests/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/**',
        'src/app/**',
        '.next/**',
      ],
      // Interim floors that reflect current reality (well-covered src/lib,
      // thin UI coverage) and prevent regression. Raise these as server-action
      // and component tests are added — see Documentation/QA_FINDINGS.md P1-4.
      thresholds: {
        global: {
          branches: 60,
          functions: 35,
          lines: 10,
          statements: 10,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
