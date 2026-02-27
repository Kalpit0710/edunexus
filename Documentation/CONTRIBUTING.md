# EduNexus — Contributing Guide

> **Version:** 1.0.0  
> **Last Updated:** 2026-02-27

---

## Setup Guide

### 1. Prerequisites

```bash
# Required versions
node    >= 20.0.0
pnpm    >= 8.0.0
git     >= 2.40
docker  >= 24.0 (for local Supabase)
```

### 2. Clone & Install

```bash
git clone https://github.com/your-org/edunexus.git
cd edunexus
pnpm install
```

### 3. Start Local Supabase

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase (Docker required)
supabase start

# Output will show:
# API URL: http://localhost:54321
# Anon key: eyJ...
# Service role key: eyJ...
# Studio URL: http://localhost:54323
```

### 4. Configure Environment

```bash
cp .env.example .env.local
```

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start output>
RESEND_API_KEY=re_test_...
```

### 5. Run Migrations & Seed

```bash
# Apply all migrations
supabase db push

# Seed development data
supabase db seed
```

### 6. Start Dev Server

```bash
pnpm dev
# Opens at http://localhost:3000
```

### 7. Open Supabase Studio

```
http://localhost:54323
```

---

## Development Workflow

### Start a New Task

1. Check [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) for the current milestone
2. Create a branch:
   ```bash
   git checkout -b feature/phase1-student-bulk-upload
   ```

3. Develop your feature
4. Write/update tests
5. Run the full test suite locally
6. Push and open a PR

### Branch Naming

```
feature/phase{N}-{short-description}
fix/{short-bug-description}
chore/{maintenance-task}
db/{migration-description}
docs/{doc-section}

Examples:
  feature/phase1-add-student-form
  feature/phase2-exam-marks-entry
  fix/fee-receipt-pdf-broken
  db/add-late-fee-column
  chore/update-supabase-client
```

---

## PR Process

### Before Opening a PR

Run the complete check:

```bash
# Type checking
pnpm tsc --noEmit

# Linting
pnpm lint

# All tests
pnpm test:all

# Build check
pnpm build
```

All must pass with **zero errors**.

### PR Template

```markdown
## Summary
Brief description of what this PR does.

## Type
- [ ] Feature
- [ ] Bug fix
- [ ] Database migration
- [ ] Documentation
- [ ] Chore

## Phase / Milestone
Phase 1 — Milestone 1.5: Student Management

## Changes
- Added `StudentForm` component (4-step wizard)
- Added `addStudent` mutation function
- Added Zod schema for student validation
- Added RLS tests for student table

## Testing
- [ ] Unit tests: `pnpm test:unit` passes
- [ ] Integration tests: `pnpm test:integration` passes
- [ ] RLS tests: `pnpm test:rls` passes
- [ ] E2E tests: `pnpm test:e2e` passes
- [ ] Tested on mobile viewport

## Screenshots
[Screenshot of the UI change if applicable]

## Notes for Reviewer
Any context the reviewer needs — architectural choices, edge cases handled, known limitations.
```

### PR Review Checklist (Reviewer)

- [ ] Code follows conventions in [AI_COLLABORATION_GUIDE.md](./AI_COLLABORATION_GUIDE.md)
- [ ] All new DB tables have `school_id` and RLS enabled
- [ ] No service role key in client code
- [ ] Tests are meaningful (not just added for coverage)
- [ ] Loading, error, and empty states present
- [ ] Mobile responsive
- [ ] No TypeScript `any` types

---

## Code Standards

### Linting & Formatting

```json
// .eslintrc.json (key rules)
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "no-console": ["warn", { "allow": ["error", "warn"] }],
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

```json
// .prettierrc
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2,
  "printWidth": 100
}
```

### Commit Messages

```
Format: <type>: <subject>

Types: feat | fix | docs | style | refactor | test | chore | db

Examples:
  feat: add student bulk Excel upload
  fix: correct late fee calculation for partial payments
  db: add deleted_at column to teachers table
  test: add RLS tests for payments table
  docs: update API_DESIGN with inventory endpoints
```

---

## Database Migration Rules

1. **Never edit a migration file after it has been run on any shared environment**
2. Always create a new migration instead
3. Every migration must be **reversible** where possible (include rollback comment)
4. Name migrations descriptively:
   ```
   20260301000001_create_schools_table.sql
   20260315000001_add_deleted_at_to_students.sql
   ```
5. Test migrations on fresh DB before PR:
   ```bash
   supabase db reset
   supabase db push
   ```

---

## Environment Reference

| Environment | URL | Branch | Auto-Deploy |
|-------------|-----|--------|-------------|
| Local | localhost:3000 | any | Manual |
| Staging | staging.edunexus.app | `develop` | Yes (on push) |
| Production | app.edunexus.app | `main` | Yes (on PR merge) |
