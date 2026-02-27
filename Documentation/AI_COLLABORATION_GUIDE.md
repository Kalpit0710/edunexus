# EduNexus — AI Collaboration Guide

> **IMPORTANT: If you are an AI assistant (GitHub Copilot, Claude, GPT-4, Gemini, etc.) working on this codebase, read this document first and in full before making any changes.**

> **Version:** 1.0.0  
> **Last Updated:** 2026-02-27

---

## Table of Contents

1. [Project Summary for AI](#project-summary-for-ai)
2. [Technology Stack (Quick Reference)](#technology-stack-quick-reference)
3. [Current Phase](#current-phase)
4. [Architecture Invariants — Never Change Without Discussion](#architecture-invariants--never-change-without-discussion)
5. [Code Conventions](#code-conventions)
6. [Database Conventions](#database-conventions)
7. [File Structure Map](#file-structure-map)
8. [Module Ownership Map](#module-ownership-map)
9. [Common Patterns to Follow](#common-patterns-to-follow)
10. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
11. [How to Handle Ambiguity](#how-to-handle-ambiguity)
12. [Testing Requirements](#testing-requirements)
13. [PR Checklist for AI-Generated Code](#pr-checklist-for-ai-generated-code)
14. [Key Business Rules](#key-business-rules)

---

## Project Summary for AI

**EduNexus** is a multi-tenant SaaS School Management System. One codebase serves many schools. Each school's data is isolated from others using PostgreSQL Row-Level Security (RLS).

**In plain terms:**
- Think of each "school" as a tenant in an apartment building — they share infrastructure but cannot see each other's data
- A teacher from School A cannot see students from School B — even if they use the same login page
- This isolation is enforced at the DATABASE level (RLS), not just the application level
- Every table that holds school-specific data has a `school_id` column

**The platform serves these user types, in descending access:**
1. Super Admin (EduNexus owner) — sees all schools
2. School Admin (principal) — manages one school
3. Manager/Cashier — handles fees and inventory
4. Teacher — handles attendance and marks for their classes
5. Parent — read-only view of their own child

---

## Technology Stack (Quick Reference)

| What | Tool | Version |
|------|------|---------|
| Frontend framework | Next.js (App Router) | 14+ |
| UI library | React | 18+ |
| Styling | Tailwind CSS + shadcn/ui | Latest |
| Backend | Supabase | Latest |
| Database | PostgreSQL | 15+ |
| Auth | Supabase Auth | Latest |
| Language | TypeScript | 5+ (strict mode) |
| Package manager | pnpm | 8+ |
| Testing: unit | Vitest | Latest |
| Testing: E2E | Playwright | Latest |
| Forms | React Hook Form + Zod | Latest |
| Server state | TanStack Query (React Query) | v5 |
| Global state | Zustand | Latest |
| Schema validation | Zod | Latest |
| PDF | Edge Function + HTML template | Deno |
| Email | Resend | Latest |

---

## Current Phase

> Check [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) for the current active phase and milestone.
> Check `PROGRESS.md` (in repo root) for the latest task status.

When you receive a task, always check:
1. Which phase is this task part of?
2. Are all prerequisites for this task done?
3. Does this task have a testing requirement?

---

## Architecture Invariants — Never Change Without Discussion

These are **non-negotiable** architectural rules. If you think any of these should change, surface it as a discussion in the PR description — do NOT just change it.

### 1. Every tenant table MUST have `school_id UUID NOT NULL`
```sql
-- CORRECT
CREATE TABLE new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),  -- ← REQUIRED
  ...
);

-- WRONG — missing school_id
CREATE TABLE new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ...
);
```

### 2. RLS MUST be enabled on every tenant table
```sql
-- After creating any tenant table:
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
-- Then create policies before any data operations
```

### 3. Never disable RLS in production code
```sql
-- BANNED:
ALTER TABLE students DISABLE ROW LEVEL SECURITY;
```

### 4. Never use serial/auto-increment IDs — use UUID
```sql
-- CORRECT
id UUID PRIMARY KEY DEFAULT gen_random_uuid()

-- WRONG
id SERIAL PRIMARY KEY
```

### 5. Never do hard deletes on students, teachers, or payments
```sql
-- CORRECT — soft delete
UPDATE students SET deleted_at = NOW() WHERE id = ?

-- WRONG
DELETE FROM students WHERE id = ?
```

### 6. Never store the Supabase service role key in client-side code
```typescript
// CORRECT — service key only in server/Edge Functions
const supabase = createClient(url, serviceRoleKey)  // ONLY in server contexts

// WRONG — never in browser code or client components
```

### 7. Never fetch all rows — always paginate or limit
```typescript
// CORRECT
.select('*').range(0, 49)  // paginate

// WRONG — could fetch thousands of rows
.select('*')
```

### 8. All business-critical operations use PostgreSQL functions (not application code) for atomicity
```typescript
// CORRECT — fee collection is atomic
await supabase.rpc('collect_fee', { ... })

// WRONG — split across multiple queries (not atomic)
await supabase.from('payments').insert(...)
await supabase.from('fee_installments').update(...)
```

---

## Code Conventions

### TypeScript
- **Strict mode always on** — no `any` types
- **Zod for all external data validation** (form inputs, API responses, Excel data)
- **Type generation** from Supabase schema: `supabase gen types typescript --local > src/types/supabase.ts`

```typescript
// CORRECT — use generated types
import type { Database } from '@/types/supabase'
type Student = Database['public']['Tables']['students']['Row']

// WRONG — manually type a DB entity
interface Student {
  id: string
  name: string
  // ...
}
```

### React / Next.js
- **Server Components** preferred for data-loading pages
- **Client Components** only when interactivity needed (forms, real-time, charts)
- **`'use client'` directive** only at the lowest level component that needs it
- **Loading states** always implemented with `loading.tsx` or Suspense
- **Error states** always implemented with `error.tsx` or try/catch

```typescript
// CORRECT — async Server Component
export default async function StudentsPage() {
  const students = await fetchStudents()
  return <StudentTable data={students} />
}

// CORRECT — Client Component (only when needed)
'use client'
import { useState } from 'react'
export function StudentForm() { ... }
```

### Naming Conventions

| Item | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `StudentTable.tsx` |
| Functions | camelCase | `getStudentById()` |
| Constants | UPPER_SNAKE | `MAX_STUDENTS_PER_CLASS` |
| Database tables | snake_case | `fee_installments` |
| API functions | camelCase | `collectFee()` |
| Types/Interfaces | PascalCase | `FeeInstallment` |
| Files (non-component) | kebab-case | `fee-utils.ts` |
| CSS classes | Tailwind only | `flex items-center` |

### File Organization
```
src/components/modules/{module-name}/
  {ModuleName}Table.tsx      ← list view
  {ModuleName}Form.tsx       ← add/edit form  
  {ModuleName}Detail.tsx     ← single item view
  index.ts                   ← re-exports

src/lib/
  {module-name}/
    queries.ts               ← Supabase query functions
    mutations.ts             ← Supabase mutation functions
    validations.ts           ← Zod schemas
    utils.ts                 ← module utilities
```

---

## Database Conventions

### Migration files
```
supabase/migrations/YYYYMMDDHHMMSS_description.sql
```

### Column naming
```sql
id              UUID        -- always primary key
school_id       UUID        -- always present on tenant tables
created_at      TIMESTAMPTZ -- always present
updated_at      TIMESTAMPTZ -- on mutable tables
created_by      UUID        -- on tables where tracking creator matters
deleted_at      TIMESTAMPTZ -- for soft-delete tables (NULL = not deleted)
is_active       BOOLEAN     -- for togglable entities
```

### Always add update trigger
```sql
-- Add to every mutable table
CREATE OR REPLACE TRIGGER update_{table}_updated_at
  BEFORE UPDATE ON {table}
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## File Structure Map

```
edunexus/
├── src/
│   ├── app/                    → Next.js pages (DO NOT put business logic here)
│   ├── components/
│   │   ├── ui/                 → DO NOT modify (shadcn/ui managed)
│   │   ├── shared/             → Shared across roles
│   │   └── modules/            → Module-specific UI
│   ├── lib/
│   │   ├── supabase/           → Supabase client config
│   │   └── {module}/           → Per-module data logic
│   ├── hooks/                  → Custom React hooks
│   ├── stores/                 → Zustand state stores
│   └── types/                  → TypeScript types
├── supabase/
│   ├── migrations/             → SQL migrations (never edit deployed ones)
│   ├── functions/              → Edge Functions (Deno)
│   └── seed/                   → Development seed data
├── tests/
│   ├── unit/                   → Vitest unit tests
│   ├── integration/            → Supabase integration tests
│   └── e2e/                    → Playwright E2E tests
└── Documentation/              → All project docs (you are here)
```

---

## Module Ownership Map

| Module | Key Files | Phase |
|--------|-----------|-------|
| Auth | `src/app/(auth)/`, `src/lib/supabase/` | Phase 1 |
| School Config | `src/app/(school-admin)/settings/` | Phase 1 |
| Students | `src/components/modules/students/` | Phase 1 |
| Teachers | `src/components/modules/teachers/` | Phase 1 |
| Attendance | `src/components/modules/attendance/` | Phase 1 |
| Fee (Basic) | `src/components/modules/fees/` | Phase 1 |
| Exams | `src/components/modules/exams/` | Phase 2 |
| Inventory | `src/components/modules/inventory/` | Phase 2 |
| Parent Portal | `src/app/(parent)/` | Phase 2 |
| Notifications | `supabase/functions/send-email/` | Phase 2 |
| Analytics | `src/components/modules/analytics/` | Phase 2–3 |
| PWA | `src/app/` (manifest, sw) | Phase 3 |

---

## Common Patterns to Follow

### Pattern 1: Data Fetching with React Query

```typescript
// src/lib/students/queries.ts
export async function getStudents(supabase: SupabaseClient, filters: StudentFilters) {
  const query = supabase
    .from('students')
    .select('*, sections(name, classes(name))')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('first_name')
    .range(filters.offset, filters.offset + filters.limit - 1)

  if (filters.search) {
    query.ilike('first_name', `%${filters.search}%`)
  }

  const { data, error, count } = await query
  if (error) throw error
  return { data, count }
}

// In component:
const { data } = useQuery({
  queryKey: ['students', filters],
  queryFn: () => getStudents(supabase, filters),
})
```

### Pattern 2: Form with Zod Validation

```typescript
// src/lib/students/validations.ts
export const studentSchema = z.object({
  first_name: z.string().min(1, 'Required').max(100),
  last_name: z.string().min(1, 'Required').max(100),
  date_of_birth: z.string().optional(),
  section_id: z.string().uuid('Invalid section'),
})
export type StudentFormData = z.infer<typeof studentSchema>

// In component:
const form = useForm<StudentFormData>({
  resolver: zodResolver(studentSchema),
})
```

### Pattern 3: Supabase Mutation with Toast

```typescript
const addStudentMutation = useMutation({
  mutationFn: (data: StudentFormData) =>
    supabase.from('students').insert({
      ...data,
      school_id: schoolId,  // ALWAYS include school_id
    }),
  onSuccess: () => {
    toast.success('Student added successfully')
    queryClient.invalidateQueries({ queryKey: ['students'] })
  },
  onError: (error) => {
    toast.error(`Failed to add student: ${error.message}`)
  },
})
```

### Pattern 4: Excel Upload

```typescript
// Parse → validate → show preview → confirm → upsert
import * as XLSX from 'xlsx'

export async function parseStudentExcel(file: File): Promise<StudentUploadRow[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet)
  
  // Validate each row with Zod
  const validated = rows.map((row, i) => {
    const result = studentUploadSchema.safeParse(row)
    if (!result.success) {
      return { row: i + 2, errors: result.error.errors, data: null }
    }
    return { row: i + 2, errors: [], data: result.data }
  })
  
  return validated
}
```

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why Bad | Correct Approach |
|-------------|---------|-----------------|
| `.select('*')` without limit | Fetches entire table | Always add `.range()` |
| Business logic in components | Untestable, scattered | Move to `src/lib/{module}/` |
| Direct `fetch()` calls | Bypasses RLS, type-unsafe | Always use Supabase client |
| `any` TypeScript type | Defeats type safety | Use generated Supabase types |
| Multiple queries vs. join | N+1 query problem | Use Supabase `select('*, related(*)')` |
| Storing school_id only in frontend | RLS must see it in DB | Always store `school_id` in every insert |
| Catch + silently ignore errors | Bugs become invisible | Always surface errors to user |
| Inline SQL strings | Injection risk | Use Supabase client query builder or RPC |
| Keeping service key in `.env.local` for client | Security disaster | Service key ONLY in server/Edge Functions |

---

## How to Handle Ambiguity

When requirements are unclear:
1. **Look at similar existing code first** — follow established patterns
2. **Check [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)** for the intended behavior
3. **Check [modules/](./modules/) folder** for module-specific specs
4. **Default to more restrictive** — if unsure about access, deny access (security-first)
5. **If still unclear** — implement the most conservative interpretation and note it in the PR

---

## Testing Requirements

### Every feature MUST have:

1. **Unit tests** for utility functions and data transformation logic
2. **Integration test** for any new database query/mutation
3. **RLS test** for any new table or policy change
4. **E2E test** for any user-facing flow (at minimum the happy path)

### Test file naming:
```
tests/unit/{module}/{function}.test.ts
tests/integration/{module}/{feature}.test.ts
tests/e2e/{module}/{user-journey}.spec.ts
tests/security/rls-{table-name}.test.ts
```

### Minimum test coverage: **80%** for new files

---

## PR Checklist for AI-Generated Code

Before submitting a PR with AI-generated code, verify:

- [ ] TypeScript: `pnpm tsc --noEmit` passes with 0 errors
- [ ] Lint: `pnpm lint` passes with 0 errors
- [ ] Tests: `pnpm test` all pass
- [ ] All new DB tables have `school_id` column
- [ ] All new DB tables have RLS enabled + policies created
- [ ] No service role key in client-side code
- [ ] All queries have `.range()` or `.limit()`
- [ ] All forms use React Hook Form + Zod
- [ ] Loading/error/empty states exist for all data-displaying components
- [ ] Mobile responsive layout tested
- [ ] No hardcoded school IDs or user IDs in code
- [ ] Excel upload includes validation and error state

---

## Key Business Rules

These are business rules that affect implementation decisions:

1. **One student can have multiple parents** (father + mother both listed)
2. **One teacher can be assigned to multiple sections** (but only one class teacher per section)
3. **Fee structure is per class, per academic year** — when a new year starts, fee structures are re-created
4. **Installments are auto-generated** when a student is enrolled into a fee structure
5. **Payments are never deleted** — refunds create a new record with negative amount / status='refunded'
6. **Results are locked** after publishing — requires admin to explicitly unlock for edits
7. **Attendance is one record per student per day** — upsert, not insert
8. **Parent access to results is configurable** — if `result_visible = false` on exam or fee unpaid (configurable), parent cannot see
9. **Academic year is school-specific** — not globally fixed
10. **PDF receipt number format:** `{SCHOOL_CODE}-{YYYY}-{NNNNN}` (e.g., `GVS-2025-00042`)
