# EduNexus — Testing Strategy

> **Version:** 1.0.0  
> **Last Updated:** 2026-02-27

---

## Testing Philosophy

> "Test the behavior, not the implementation."

EduNexus uses a **test pyramid** approach:

```
         /\
        /E2E\          ← Few, covers critical user journeys
       /──────\
      /  Integ  \      ← Medium, covers DB + API interactions
     /────────────\
    /   Unit Tests  \  ← Many, covers pure logic and utilities
   /──────────────────\
```

---

## Testing Stack

| Layer | Tool | Use Case |
|-------|------|----------|
| Unit | Vitest | Functions, utilities, Zod schemas, hooks |
| Integration | Vitest + Supabase local | DB queries, RLS, mutations |
| E2E | Playwright | Full user journeys in browser |
| RLS Security | Vitest + multi-client | Cross-school data isolation |
| Performance | Lighthouse CI | Page load, Core Web Vitals |
| Load | k6 | Concurrent user simulation (Phase 3) |

---

## Test Configuration

### Vitest Setup

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
      },
    },
  },
})
```

### Playwright Setup

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
  ],
})
```

---

## Unit Tests

### What to Unit Test
- Zod schema validation logic
- Utility functions (formatting, calculations, date handling)
- Receipt number generation
- Grade calculation logic
- Excel parse/validation functions
- Fee calculation (late fees, discounts, installments)

### Example: Grade Calculation

```typescript
// src/lib/exams/utils.ts
export function calculateGrade(
  marksObtained: number,
  maxMarks: number,
  gradingRules: GradingRule[]
): string {
  const percentage = (marksObtained / maxMarks) * 100
  const rule = gradingRules.find(r => percentage >= r.min_percent && percentage <= r.max_percent)
  return rule?.grade ?? 'F'
}

// tests/unit/exams/grade-calculation.test.ts
import { calculateGrade } from '@/lib/exams/utils'

const RULES = [
  { min_percent: 90, max_percent: 100, grade: 'A+' },
  { min_percent: 75, max_percent: 89.99, grade: 'A' },
  { min_percent: 60, max_percent: 74.99, grade: 'B' },
  { min_percent: 40, max_percent: 59.99, grade: 'C' },
  { min_percent: 0, max_percent: 39.99, grade: 'F' },
]

describe('calculateGrade', () => {
  it('returns A+ for 95%', () => {
    expect(calculateGrade(95, 100, RULES)).toBe('A+')
  })
  it('returns F for 35%', () => {
    expect(calculateGrade(35, 100, RULES)).toBe('F')
  })
  it('returns A for exactly 75%', () => {
    expect(calculateGrade(75, 100, RULES)).toBe('A')
  })
  it('handles 0 marks', () => {
    expect(calculateGrade(0, 100, RULES)).toBe('F')
  })
})
```

### Example: Fee Calculation

```typescript
// tests/unit/fees/fee-calculation.test.ts
describe('calculateNetPayable', () => {
  it('applies late fee correctly', () => {
    const result = calculateNetPayable({
      baseAmount: 5000,
      lateFee: 200,
      discount: 0,
      paidAmount: 0,
    })
    expect(result).toBe(5200)
  })
  
  it('applies discount before late fee', () => {
    const result = calculateNetPayable({
      baseAmount: 5000,
      lateFee: 100,
      discount: 500,
      paidAmount: 0,
    })
    expect(result).toBe(4600)
  })
  
  it('subtracts already paid amount', () => {
    const result = calculateNetPayable({
      baseAmount: 5000,
      lateFee: 0,
      discount: 0,
      paidAmount: 2000,
    })
    expect(result).toBe(3000)
  })
})
```

---

## Integration Tests

### Supabase Local Setup for Tests

```typescript
// tests/setup.ts
import { createClient } from '@supabase/supabase-js'

export const testClient = createClient(
  process.env.SUPABASE_LOCAL_URL!,
  process.env.SUPABASE_LOCAL_ANON_KEY!,
)

// Create test fixtures
export async function createTestSchool() {
  // Use service role to bypass RLS for fixture creation
  const adminClient = createClient(URL, SERVICE_ROLE_KEY)
  const { data } = await adminClient.from('schools').insert({
    name: 'Test School Alpha',
    code: 'TSA',
  }).select().single()
  return data!
}
```

### Example: Student CRUD Integration Test

```typescript
// tests/integration/students/crud.test.ts
describe('Student CRUD', () => {
  let schoolId: string
  let adminClient: SupabaseClient

  beforeAll(async () => {
    const school = await createTestSchool()
    schoolId = school.id
    adminClient = await createAuthenticatedClient('admin@tsa.test')
  })

  it('creates a student with valid data', async () => {
    const { data, error } = await adminClient.from('students').insert({
      school_id: schoolId,
      section_id: TEST_SECTION_ID,
      first_name: 'John',
      last_name: 'Doe',
      admission_number: 'ADM-001',
    }).select().single()

    expect(error).toBeNull()
    expect(data?.first_name).toBe('John')
    expect(data?.school_id).toBe(schoolId)
  })

  it('rejects duplicate admission number', async () => {
    const { error } = await adminClient.from('students').insert({
      school_id: schoolId,
      admission_number: 'ADM-001',  // duplicate
      first_name: 'Jane',
      last_name: 'Smith',
    })
    expect(error?.code).toBe('23505')  // unique constraint violation
  })
})
```

---

## RLS Security Tests

### Critical: Always Run Before Any Deployment

```typescript
// tests/security/rls-students.test.ts
describe('RLS: students table', () => {
  let schoolAId: string
  let schoolBId: string
  let schoolAClient: SupabaseClient
  let schoolBClient: SupabaseClient

  beforeAll(async () => {
    // Create two isolated schools
    schoolAId = (await createTestSchool('School A', 'SCA')).id
    schoolBId = (await createTestSchool('School B', 'SCB')).id
    
    // Seed students in both schools
    await seedStudents(schoolAId, 3)
    await seedStudents(schoolBId, 3)
    
    // Create authenticated clients for each school's admin
    schoolAClient = await createAuthenticatedClient('admin@sca.test')
    schoolBClient = await createAuthenticatedClient('admin@scb.test')
  })

  it('School A admin sees only School A students', async () => {
    const { data } = await schoolAClient.from('students').select('*')
    expect(data?.every(s => s.school_id === schoolAId)).toBe(true)
    expect(data).toHaveLength(3)
  })

  it('School B admin sees only School B students', async () => {
    const { data } = await schoolBClient.from('students').select('*')
    expect(data?.every(s => s.school_id === schoolBId)).toBe(true)
    expect(data).toHaveLength(3)
  })

  it('unauthenticated request returns 0 students', async () => {
    const anonClient = createClient(URL, ANON_KEY)
    const { data } = await anonClient.from('students').select('*')
    expect(data).toHaveLength(0)
  })

  it('School A admin cannot update School B student', async () => {
    const [schoolBStudent] = await getStudentsForSchool(schoolBId)
    const { error } = await schoolAClient
      .from('students')
      .update({ first_name: 'Hacked' })
      .eq('id', schoolBStudent.id)
    
    // Should silently update 0 rows (RLS filters it out)
    expect(error).toBeNull()
    
    // Verify no change in DB via service role
    const unchanged = await getStudentById(schoolBStudent.id)
    expect(unchanged.first_name).not.toBe('Hacked')
  })

  it('parent sees only their own child', async () => {
    const parentClient = await createAuthenticatedClient('parent@sca.test')
    const { data } = await parentClient.from('students').select('*')
    
    // Parent has 1 child
    expect(data).toHaveLength(1)
    expect(data?.[0].school_id).toBe(schoolAId)
  })
})
```

---

## E2E Tests (Playwright)

### Critical User Journeys to Test

| Journey | File | Priority |
|---------|------|----------|
| School Admin login → dashboard | `e2e/auth/login.spec.ts` | P0 |
| Add student (full form) | `e2e/students/add-student.spec.ts` | P0 |
| Fee collection → receipt download | `e2e/fees/collect-fee.spec.ts` | P0 |
| Mark attendance for class | `e2e/attendance/mark-attendance.spec.ts` | P0 |
| Teacher login → mark attendance | `e2e/teacher/attendance.spec.ts` | P0 |
| Parent login → view child fee | `e2e/parent/fee-view.spec.ts` | P0 |
| Bulk student upload (Excel) | `e2e/students/bulk-upload.spec.ts` | P1 |
| Exam creation → marks entry → publish | `e2e/exams/full-flow.spec.ts` | P1 |

### Example: Fee Collection E2E

```typescript
// tests/e2e/fees/collect-fee.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Fee Collection', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'manager@testschool.com', 'password')
  })

  test('collect full fee and download receipt', async ({ page }) => {
    await page.goto('/manager/fees')
    
    // Search for student
    await page.getByPlaceholder('Search student...').fill('John Doe')
    await page.getByText('John Doe - ADM-001').click()
    
    // Verify fee breakdown is visible
    await expect(page.getByText('Tuition Fee')).toBeVisible()
    await expect(page.getByText('₹5,000')).toBeVisible()
    
    // Select payment mode
    await page.getByLabel('Cash').click()
    
    // Submit
    await page.getByRole('button', { name: 'Collect Payment' }).click()
    
    // Verify success
    await expect(page.getByText('Payment collected successfully')).toBeVisible()
    await expect(page.getByText('REC-')).toBeVisible()
    
    // Download receipt
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download Receipt' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/receipt.*\.pdf/)
  })
})
```

---

## Test Data Management

### Seed Data Strategy

```
supabase/seed/
  ├── 00_schools.sql          ← 2 test schools
  ├── 01_users.sql            ← One of each role per school
  ├── 02_classes_sections.sql ← Grade 1–10, Sections A/B
  ├── 03_subjects.sql         ← Core subjects per class
  ├── 04_students.sql         ← 20 students per section
  ├── 05_parents.sql          ← 2 parents per student
  ├── 06_fee_structures.sql   ← Standard fee setup
  ├── 07_attendance.sql       ← 30 days of attendance
  └── 99_reset.sql            ← Cleanup script
```

### Test Isolation
- Each test suite creates its own school via `createTestSchool()`
- Cleanup in `afterAll`: delete school cascades all data
- Never share fixtures between test files

---

## Continuous Integration

### GitHub Actions Pipeline

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      supabase:
        image: supabase/postgres:15
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: supabase start
      - run: supabase db push
      - run: pnpm test:unit       # Vitest unit tests
      - run: pnpm test:integration # Vitest integration tests
      - run: pnpm test:rls        # RLS security tests
      - run: pnpm build           # Ensure build passes
      - run: pnpm test:e2e        # Playwright E2E
```

### Test Commands

```json
// package.json scripts
{
  "test": "vitest",
  "test:unit": "vitest run tests/unit",
  "test:integration": "vitest run tests/integration",
  "test:rls": "vitest run tests/security",
  "test:e2e": "playwright test",
  "test:coverage": "vitest run --coverage",
  "test:all": "pnpm test:unit && pnpm test:integration && pnpm test:rls && pnpm test:e2e"
}
```

---

## Test Coverage Targets

| Layer | Min Coverage | Target |
|-------|-------------|--------|
| Utility functions | 95% | 100% |
| Data transformation | 90% | 95% |
| React hooks | 80% | 85% |
| API query functions | 80% | 85% |
| RLS policies | 100% | 100% |
| E2E critical paths | 100% | 100% |
