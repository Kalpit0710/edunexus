# EduNexus — Development Progress Tracker

> **This file is the source of truth for current development status.**  
> Update this file as tasks are completed. AI assistants should check this file first to understand what has been done and what is next.

---

## Current Phase: Phase 2 — Advanced Academic + POS (Complete)

**Overall Phase 1 Progress:** ✅ Complete — features (1.1-1.9) plus testing gate 1.10 (exit gate signed off 2026-06-16)  
**Overall Phase 2 Progress:** ✅ Complete — all modules feature-complete with end-to-end coverage (exit gate signed off 2026-06-16)  
**Active Sprint:** Phase 2 closed; ready to scope Phase 3 (scalability)

---

## Milestone Status

| Milestone | Status | Notes |
|-----------|--------|-------|
| 1.1 Project Setup | ✅ Completed | Next.js 15, Supabase CLI, pnpm, ESLint, Tailwind, shadcn/ui |
| 1.2 Database Foundation | ✅ Completed | Schema pushed, RLS policies, types generated |
| 1.3 Auth & Role Routing | ✅ Completed | Zustand store, login, forgot-password, middleware role routing |
| 1.4 School Configuration | ✅ Completed | Settings, classes/sections/subjects, onboarding wizard, grading rules |
| 1.5 Student Management | ✅ Completed | DataTable, multi-step add wizard, bulk Excel import/export, photo upload |
| 1.6 Teacher Management | ✅ Completed | Teacher list, add/edit, class-section assignment UI, activate/deactivate |
| 1.7 Attendance Module | ✅ Completed | Daily mark, bulk mark, edit prior records, monthly report, Excel import/export |
| 1.8 Fee Module Basic | ✅ Completed | Fee structure, POS collection, receipt email, payment history, pending fees, daily report |
| 1.9 Role Dashboards | ✅ Completed | All 4 role dashboards with stat cards, charts, attendance %, quick actions |
| 1.10 Testing Sprint | ✅ Completed | TypeScript clean (0 errors); ESLint errors 0; full Vitest suite 183 passing (176 unit + 7 integration); RLS tenant-isolation integration suite (7 tests, live DB); E2E flow coverage broadened beyond auth to student/attendance/fee flows (10 specs passing on chromium) — Phase 1 exit gate signed off 2026-06-16 |
| 2.1 Examination Module | ✅ Completed | Exam list, marks entry, reports (class performance / rank holders / report cards), publish/lock; report-card PDF + batch export via Edge Function; E2E coverage on real seeded exam |
| 2.2 Inventory & POS | ✅ Completed (Backend + UI) | Inventory CRUD, stock adjust, POS billing, low-stock alerts, receipt emails; E2E coverage for list/add/stock/POS/reports |
| 2.3 Email Notifications | ✅ Completed | Resend integration, fee receipt email, inventory receipt email, exam publish notification |
| 2.4 Parent Portal | ✅ Completed | Dashboard, attendance calendar, exam results (fee-locked), fee status, announcements; E2E coverage across all 5 views with RLS-scoped child data |
| 2.5 Advanced Analytics | ✅ Completed | School-admin, parent, and manager analytics (fee momentum, exam trends, attendance/performance trends, manager drilldowns); reports E2E coverage |
| 2.6 Phase 2 Testing | ✅ Completed | Full chromium E2E suite green (auth + students + attendance + fees + exams + inventory + parent + reports); parent role added to E2E seed/auth setup |

---

## Completed Tasks

### 2026-06-18 — Production Hardening — Part 5 Chunk 5.2 (✅ DONE — root cause fixed: Supabase upgrade + types regen)
- Status: ✅ Completed
- What was done: Resolved Chunk 5.2 by fixing the root cause of the project-wide Supabase `never`-typing bug rather than working around it.
  - **Diagnosis:** Isolated type-tests proved the bug was **`@supabase/ssr@0.5.2`** (its `createServerClient<Database>`/`createBrowserClient<Database>` typings were too old) — the base `@supabase/supabase-js@2.98` typed client compiled fine. The generated `src/types/database.types.ts` was **also severely stale**, missing ~12 tables (`exams`, `exam_subjects`, `marks`, `plan_prices`, `inventory_*`, `fee_payments`, `audit_logs`, …) — the old loose typing hid this.
  - **Fix:** Upgraded `@supabase/ssr` `^0.5.2 → ^0.12.0` and `@supabase/supabase-js` `^2.47 → ^2.108` (peer requirement); regenerated types via `pnpm db:types` against the live EduNexus project (CLI authed) — now 26 tables + RPC functions.
  - **Cleanup:** Removed all **21 write-side `@ts-expect-error`** (now-unused) across settings/onboarding/teachers/students/students-new and typed their payloads against the generated `Insert`/`Update` types. Burned down read-side `as any`: `app-initializer.tsx` (15), `login/page.tsx` (3 — plus a surfaced real schema-drift fix: `subscription_plan/status` are DB `string` but app unions → explicit typed cast, not `any`), the shared `student-parent-sync.ts` helper (`db: any` → `SupabaseClient<Database>`, dropping 5 `as any` call-site casts), 2 student read helpers, and `email.ts`. Only **1** `@ts-expect-error` remains — a **non-write** dynamic-index on local React state in `onboarding/page.tsx` — so **"no `@ts-expect-error` on writes" is met**.
- Tests: `pnpm type-check` → 0 errors; `pnpm lint` → 0 errors (`no-explicit-any` **358 → 321**, `@ts-expect-error` **22 → 1**); full Vitest suite → **217 passed**; `pnpm build` → success (incl. SSR middleware). **Manual auth smoke recommended** (login + impersonation) since the upgrade touches `@supabase/ssr` cookie/session handling — automated tests don't fully cover runtime auth.
- Notes: `database.types.ts` regenerated (canonical `pnpm db:types`). Discovered `fee_installments` table does **not** exist in the DB — the fee-reminders cron queries a non-existent table (latent dead code, left under `as any`). Remaining `no-explicit-any` (teacher-dashboard nested-relation selects, reports/fees data-shape casts, `parent/actions.ts` `db: any`, Next typed-routes `href as any`) is incremental follow-up. **Process lesson:** `get_errors` (IDE) did not surface the `never` errors — only `pnpm type-check` did. (Recorded in repo memory.)

### 2026-06-18 — Production Hardening — Part 5 Chunk 5.3 (De-duplicate `getSupabase()`)
- Status: ✅ Completed
- What was done: Executed Chunk 5.3 of `Documentation/QA_AUDIT_AND_HARDENING_PLAN.md` — removed the duplicated cookie-aware Supabase server-client helper that had been copy-pasted into 9 server-action files (teacher dashboard, school-admin dashboard, super-admin, onboarding, attendance, teachers, students, students/new, settings). Each local `getSupabase()` was byte-for-byte equivalent to the `createClient()` already exported from `src/lib/supabase/server.ts`.
  - The 8 helper-only files now `import { createClient as getSupabase } from '@/lib/supabase/server'`, so every `await getSupabase()` call site and `Awaited<ReturnType<typeof getSupabase>>` type keeps working with zero call-site churn against the single shared helper.
  - `settings/actions.ts` already imported the shared client as `createServerSupabaseClient`; it keeps that import and adds `const getSupabase = createServerSupabaseClient` so its existing call sites resolve to the same helper.
  - Removed the now-unused `@supabase/ssr` (`createServerClient`/`CookieOptions`), `next/headers` `cookies`, and (where applicable) `Database` imports. `super-admin/actions.ts` keeps its `cookies` import because it writes impersonation cookies directly. Side benefit: the super-admin session client is now typed `<Database>` (its local copy had been untyped) with no usage breakage.
- Tests: `pnpm type-check` → 0 errors; `pnpm lint` → 0 errors (warnings only); full Vitest suite → **217 passed** (no behaviour change — pure refactor).
- Notes: Within **Part 5**, 5.1 (a11y) and 5.3 are done; **5.2** (`any` burn-down vs generated DB types) remains. Next: Chunk 5.2.

### 2026-06-18 — Production Hardening — Part 1 (Data Integrity & Audit)
- Status: ✅ Completed
- What was done: Executed Part 1 of `Documentation/QA_AUDIT_AND_HARDENING_PLAN.md` (P0 data-integrity track) in three chunks, each shipping a migration (where needed) + integration tests + doc/context refresh.
  - **1.1 Atomic attendance:** Migration `20260618000001_attendance_atomic_save.sql` moves the mark-attendance write into a single transactional RPC so a partial failure can no longer leave a day half-saved. 4 integration tests.
  - **1.2 Consistent soft-delete + restore:** Migration `20260618000002_soft_delete_config_entities.sql` adds `deleted_at` to all 6 config/template tables (classes, sections, subjects, academic_years, grading_rules, fee_structures), replaces the hard `UNIQUE(...)` constraints with **partial unique indexes** (`WHERE deleted_at IS NULL`, so a deleted name is reusable), and updates RLS so soft-deleted rows are hidden from every session-client read (staff-read **and** FOR-ALL manage USING; manage WITH CHECK still allows live-row writes). `academic_years` (RLS-enabled but **policy-less → default-deny**) gained the standard staff-read + admin-manage policies. Delete actions in `settings/actions.ts` + `fees/actions.ts` now soft-delete; new `restore*` actions clear `deleted_at` — both via the **service-role client explicitly scoped to the caller's `school_id`** (resolved through `requireActor`) and each writes an audit row. Added `getDeletedConfigEntities()` to back a future restore/trash UI. 4 integration tests (`tests/integration/soft-delete-config.test.ts`).
  - **1.3 Audit-log wiring:** `logAudit()` added to the high-value school-admin writes — fee collection, exam publish/unlock, student admission, teacher onboarding + activate/deactivate. The two teacher actions also gained the previously-missing `requireActor(['school_admin'])` auth gate. Destructive-delete audits ride along with 1.2 (`*.deleted` / `*.restored`).
- Tests: `pnpm type-check` → 0 errors; `pnpm lint` → 0 errors (warnings only); full Vitest suite → **193 passed** (189 prior + 4 soft-delete). Both migrations applied to the remote project and verified via `information_schema` / `pg_policies` / `pg_indexes` introspection.
- Notes: Migrations are applied with `node scripts/apply-migration.mjs <path>` (the repo isn't `supabase link`-ed locally). Confirmed **no false positives** acted on: students/teachers/schools have no user-facing hard delete (super-admin `.delete()` calls are rollback cleanup inside `createSchool`; schools suspend via `is_active`); super-admin actions were already audited; `audit_logs` already existed. Next: **Part 2 — Validation & Security Boundary** (Zod on server actions, fee-payment guards, destructive-action confirmation UI).

### 2026-06-18 — Production Hardening — Part 2 (Validation & Security Boundary)
- Status: ✅ Completed
- What was done: Executed Part 2 of `Documentation/QA_AUDIT_AND_HARDENING_PLAN.md` (P0/P1 validation track) in three chunks.
  - **2.1 Zod on server actions:** Completed input validation on the two under-validated mutating actions. **Student create** (`students/new/actions.ts`) gained optional-field validators that tolerate empty string **and** null/undefined (the form submits `''` for skipped fields, plus extra keys → `.passthrough()` retained): parent email format, phone length, gender enum (lowercased via `preprocess`), `YYYY-MM-DD` DOB, and `class_id`/`section_id` uuid; switched from `.parse()` to `safeParse` surfacing `issues[0].message`. **Teacher create** (`teachers/actions.ts`) now calls the pure, unit-tested `validateTeacherCreateFields` (full_name, email format, password ≥ 8, join_date) **before** any auth-user creation, plus an optional phone length check. Rules deliberately match the client `validateStep` exactly → zero client/server divergence.
  - **2.2 Fee payment guards:** Added `collectFeeInputSchema` + `validateCollectFeeInput` to `src/lib/fee-utils.ts`, wired at the top of `collectFeePayment`. Guards: uuid for `studentId`/`categoryId`/`collectedById`; non-empty items; a `feeMoney` money validator (finite, non-negative, ≤ `MAX_FEE_TRANSACTION_AMOUNT` = ₹1 crore); `paidAmount` > 0; `paymentMode` validated against the **app-level** union (`cash,cheque,upi,neft,card,online`); `discountAmount` ≤ items total. **Cash overpayment is intentionally allowed** (the POS change-due flow) — documented in code and asserted by a test. +11 unit tests (33 total in fee-utils).
  - **2.3 Destructive-action confirmation:** Audit found **no user-facing hard delete** (students soft-delete post-1.2; school suspend is reversible). The highest-impact destructive op — **school suspension** (blocks an entire tenant) — was upgraded from a single `window.confirm` to a **typed-confirmation Dialog**: the operator must type the exact school name to enable the destructive Suspend button, and `setSchoolSuspended(id, suspended, expectedName?)` re-checks the typed name **server-side** (admin client) and throws on mismatch. Reactivation stays single-click (non-destructive). Implemented inline (single use).
- Tests: `pnpm type-check` → 0 errors; `pnpm lint` → 0 errors (warnings only); full Vitest suite → **204 passed** (193 prior + 11 fee-utils).
- Notes: Two payment-mode vocabularies exist (DB enum vs app `PaymentMode` type) — validated against the app-level union the UI/type uses to avoid rejecting legitimate inputs. The pre-existing `validateFeePayload` (rejects overpayment, not wired to the action) was left untouched; the new `validateCollectFeeInput` matches the action's `CollectFeeInput` shape. Next: **Part 3 — Error Handling & UX Consistency** (surface fetch failures, no silent empty states).

### 2026-06-18 — Production Hardening — Part 3 (Error Handling & UX Consistency)
- Status: ✅ Chunk 3.1 completed
- What was done: Executed Chunk 3.1 of `Documentation/QA_AUDIT_AND_HARDENING_PLAN.md` — eliminated silently-swallowed fetch failures across client data views so every state is user-friendly.
  - Added a shared `DataLoadError` component (`src/components/shared/DataLoadError.tsx`): friendly headline + optional detail + a **Try Again** retry button (spinner while retrying).
  - Replaced `.catch(console.error)` (and one un-handled promise that left an infinite spinner) in **6 data views** — parent dashboard, parent results, teacher dashboard, school-admin dashboard, manager dashboard, and reports. Each now converts its fetch into a `useCallback` loader with an `error` state, surfaces a `toast.error` with a user-friendly message, and renders `DataLoadError` (with retry) instead of a blank/empty screen. The school-admin dashboard's two parallel fetches use `Promise.allSettled` so a trend-chart failure no longer blocks the primary stats.
  - Student-profile secondary payment-history fetch: swapped raw `console.error` for a `toast.error('Could not load payment history.')`.
  - Left intentional **server-action** best-effort email logging (`console.error` in fees/teachers/attendance/inventory/onboarding) untouched — those are background logs, not user-facing states. The inventory edit page already toasted + redirected on load failure (no change needed).
- Tests: `pnpm type-check` → 0 errors; `pnpm lint` → 0 errors (warnings only); full Vitest suite → **204 passed** (no test changes — UI-only). 
- Notes: Chose a shared component (justified — repeated 6×) over per-page duplication. Next within Part 3: **Chunk 3.2** — inline (as-you-type) form validation feedback via react-hook-form + Zod resolver.
### 2026-06-18 — Production Hardening — Part 3 Chunk 3.2 (Inline Form Validation)
- Status: ✅ Completed (Part 3 now complete)
- What was done: Executed Chunk 3.2 of `Documentation/QA_AUDIT_AND_HARDENING_PLAN.md` — replaced submit-time `toast.error` validation on the parent **create-account** form with inline, field-level feedback.
  - Converted Step 2 (parent email / phone / password / confirm password) to `react-hook-form` + `@hookform/resolvers/zod` with `mode: 'onTouched'`, using the shadcn `Form`/`FormField`/`FormControl`/`FormLabel`/`FormMessage` primitives (the same pattern already used by login + reset-password).
  - The client `parentSchema` mirrors the server `registerSchema` (`/api/auth/parent-register`) exactly — email format, phone trimmed length 6–30, password min 8 + uppercase/lowercase/digit regex, confirm-equality refine — so inline validation never rejects input the server would accept. Removed the four imperative `toast.error` guard blocks; `createParentAccount` now takes the validated `ParentFormValues`. Step 1 (student lookup) stays controlled (it's a lookup, not field validation).
- Tests: `pnpm type-check` → 0 errors; `pnpm lint` → 0 errors (warnings only); full Vitest suite → **204 passed** (UI-only, no test changes).
- Notes: react-hook-form, @hookform/resolvers, and zod were already dependencies. **Part 3 is now complete** (3.1 + 3.2). Next: **Part 4 — Performance & Scale** (4.1 teacher dashboard query fan-out → single grouped query/RPC; 4.2 pagination on unbounded reads; 4.3 harden `exhaustive-deps` suppressions).

### 2026-06-18 — Production Hardening — Part 4 Chunk 4.1 (Teacher Dashboard Query Fan-out)
- Status: ✅ Completed
- What was done: Executed Chunk 4.1 of `Documentation/QA_AUDIT_AND_HARDENING_PLAN.md` — removed the per-section query fan-out in the teacher dashboard's pending-attendance check.
  - Replaced the `classTeacherSections.map(async … count …)` block (one `attendance_records` count query **per** class-teacher section) with a **single** grouped lookup (`.select('section_id').in('section_id', classTchrSectionIds).eq('date', today)`). The returned section IDs are deduped into a `Set` and diffed against the class-teacher sections.
  - Extracted the comparison into a pure, tested helper `computePendingAttendanceSections(classTeacherSections, markedSectionIds)` in `src/lib/teacher-utils.ts` (kept out of the `'use server'` actions file). Query count for this check is now constant (1) regardless of section count.
- Tests: `pnpm type-check` → 0 errors; `pnpm lint` → 0 errors (warnings only); full Vitest suite → **211 passed** (204 prior + 7 new helper tests: none/all marked, duplicate grouped-query rows, foreign IDs, empty sections, `Set` input).
- Notes: No migration needed — the fix is a single query + JS dedupe (a class teacher owns very few sections, so the returned rows are tiny and bounded). The parallel student-count and attendance-percentage queries were left unchanged. Next within Part 4: **Chunk 4.2** — pagination on unbounded fee reads (`getPendingFees`, `getStudentPaymentHistory`).

### 2026-06-18 — Production Hardening — Part 4 Chunks 4.2 & 4.3 (Performance & Scale)
- Status: ✅ Completed (Part 4 now complete)
- What was done:
  - **4.2 Pagination on unbounded reads:** Added migration `20260618000003_pending_fees_aggregation.sql` — a `get_pending_fees(p_school_id)` `SECURITY DEFINER` RPC (with the `is_super_admin() OR get_my_school_id()` tenant guard, matching `save_attendance_atomic`) that aggregates fee structures + payments **in SQL** and returns only students with a positive balance, sorted by balance. `getPendingFees()` now calls the RPC instead of pulling every student + every payment into Node and joining in memory. `getPaymentsByStudent`/`getStudentPaymentHistory` gained a bounded `limit` (default 200). Behaviour mirrors the old JS exactly. Migration applied to remote DB and verified. +4 integration tests (`tests/integration/pending-fees-aggregation.test.ts`): correct totals, excludes fully-paid + inactive students, tenant isolation enforced.
  - **4.3 Harden exhaustive-deps:** Eliminated **all 24** `react-hooks/exhaustive-deps` warnings (→ 0) across ~23 files by converting page/tab loaders to `useCallback` with honest dep arrays. Key pattern: depend on the **stable primitive `school?.id`** (not the `school` object) with internal `if (!school?.id) return` self-guards — so deps never loop even when a store/mocks return fresh objects (this also fixed a real render-loop the object-dep version caused in the inventory UI test). Fragile cases handled without behaviour change: parent layout reads `activeChildId` via `useAuthStore.getState()`; fees list/history keep filter values in refs (filters applied via explicit buttons); inventory reports uses a date-range ref + mount ref to preserve the mount-load-then-date-reload split; the exam-marks nested loader was reordered into two `useCallback`s. Also stabilised an unrealistic `useRouter()`/store mock in the inventory UI test.
- Tests: `pnpm type-check` → 0 errors; `pnpm lint` → 0 errors + **0 exhaustive-deps warnings** (down from 24); full Vitest suite → **215 passed** (211 prior + 4 pending-fees integration).
- Notes: **Part 4 is now complete** (4.1 + 4.2 + 4.3). Next: **Part 5 — Accessibility & Code Quality** (5.1 a11y pass, 5.2 `any` burn-down, 5.3 de-dupe `getSupabase()` helper).

- Status: ✅ Completed
- What was done:
  - **Demo login repair:** Made `scripts/repair-seeded-auth.mjs` idempotent — it now reuses an existing `*.login@` account (via a targeted `signInWithPassword`) instead of failing on email collisions, and verifies/prints the actually-created login emails. Ran it: all seven demo logins are recreated, relinked to their profiles, and verified end-to-end (e.g. `admin.login@demo.school / Admin@1234`, `parent.login@demo.school / Parent@1234`). The parent's `parents` link row is re-pointed too.
  - **Lint burndown:** Reduced ESLint warnings from **427 → 338** (0 errors throughout). Eliminated every finite low-risk category — 7 `no-unused-vars`, 8 `no-console` (file-level disable on the intentional mailer logger), 1 `no-img-element`, 1 `consistent-type-imports` — and converted all **72 `catch (e: any)`** blocks to typed `catch (e)` using a new `getErrorMessage(error: unknown)` helper in `src/lib/utils.ts`.
- Tests: `tsc --noEmit` → 0 errors; `next lint` → 0 errors / 338 warnings; full Vitest suite → 183 passed.
- Notes: Remaining 338 warnings are **311 `@typescript-eslint/no-explicit-any`** (data-shape types / Supabase result casts — need per-case typing against the generated DB types) and **27 `react-hooks/exhaustive-deps`** (left intentionally — auto-adding deps risks refetch loops). Both are non-blocking and best done incrementally.

### 2026-06-16 — Infrastructure — CI/CD Pipeline (GitHub Actions)
- Status: ✅ Completed
- What was done: Added the first CI/CD pipeline at `.github/workflows/ci.yml` (previously absent despite the 1.1 claim). A `quality` job runs on every push/PR to `main` and on manual dispatch: pnpm 9 + Node 20 with pnpm cache, `pnpm install --frozen-lockfile`, then `type-check` → `lint` → `test` → `build`. The build step uses Supabase secrets when configured and harmless placeholders otherwise (clients are created lazily, so the build never hits the network). A separate opt-in `e2e` job (manual `workflow_dispatch` only) writes `.env.local` from secrets, installs the Playwright chromium browser, runs the chromium E2E suite, and uploads the HTML report — kept opt-in because it seeds/mutates the shared Supabase project.
- Tests: Validated each CI step locally — `tsc --noEmit` 0 errors; `next lint` 0 errors; Vitest green (integration suite self-skips without secrets); `next build` compiled all routes successfully with placeholder env.
- Notes: Continuous **deployment** (deploy job) is intentionally deferred until a hosting target + credentials exist. Required repo secrets for the E2E job: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

### 2026-06-16 — Milestones 2.1 / 2.5 / 2.6 — Phase 2 Exit Gate: Full E2E Coverage
- Status: ✅ Completed
- What was done: Closed out Phase 2 by bringing the whole module suite under end-to-end coverage and signing off the exit gate.
  - **Parent portal (2.4/2.6):** Added `tests/e2e/parent.spec.ts` covering all five views (dashboard, attendance calendar, results, fee status, announcements) plus bottom-nav routing. Extended the E2E auth seed (`scripts/seed-e2e-auth.mjs`) and Playwright setup (`tests/e2e/auth.setup.ts`) to provision a **parent** role and storage state, re-pointing the seeded `parents` link row (`51000000-…-001` → student "Aarav Sharma") to each run's fresh auth user so RLS-scoped child data flows through.
  - **Analytics (2.5):** Added `tests/e2e/reports.spec.ts` exercising the school-admin Reports & Analytics surface (fee collection summary, collected/outstanding cards, enrollment summary).
  - **Exams (2.1):** Reworked `tests/e2e/exams.spec.ts` to drive the real seeded exam (`57000000-…-001` "Term 1 Examination") through the marks-entry page and the reports page (class performance / rank holders / report cards tabs incl. the report-card PDF tab), replacing the brittle dummy-id structural checks. Fixed list-page selectors (heading "Exams", button "Create Exam").
  - **Inventory (2.2):** Fixed strict-mode selector collisions in `tests/e2e/inventory.spec.ts` (scoped "Point of Sale" to the page heading vs. the new sidebar link; exact-matched "Low Stock Alerts" vs. the page subtitle).
- Tests: Full chromium Playwright suite green — setup + auth + students + attendance + fees + exams + inventory + parent + reports (single-worker run for deterministic cold-compile behavior). New specs validated in isolation: parent (6) + reports (3) = 9 passed; exams + inventory = 10 passed.
- Notes: Full mutating flows (creating a brand-new exam/sale that writes to the shared remote DB) are intentionally avoided; coverage drives the real seeded fixtures instead. Non-blocking debt unchanged (lint `any` warnings; corrupted dev-seed `auth.users` rows).

### 2026-06-16 — Milestone 1.10 — Phase 1 Exit Gate COMPLETE: E2E Flow Coverage
- Status: ✅ Completed
- What was done: Broadened E2E coverage beyond auth by adding three storage-state-driven Playwright specs exercising the core Phase 1 school-admin journeys — `tests/e2e/students.spec.ts` (student directory + add-student wizard + validation), `tests/e2e/attendance.spec.ts` (daily attendance, class/section selectors, monthly report), and `tests/e2e/fees.spec.ts` (fee structure, collect terminal, pending fees, search states). Fixed a strict-mode selector collision in the fees spec by switching `/fee categories/i` and `/fee structures/i` to exact-text matches. This closes the final 1.10 item and formally signs off the Phase 1 exit gate.
- Tests: `playwright test students.spec.ts attendance.spec.ts fees.spec.ts --project=chromium --no-deps --workers=1` → 10 passed. (Parallel 4-worker runs occasionally hit transient `ERR_ABORTED` cold-compile flakiness against the dev server; single-worker run is green and deterministic.)
- Notes: Optional remaining debt (non-blocking): 427 lint warnings (mostly `@typescript-eslint/no-explicit-any`) and corrupted dev-seed `auth.users` rows. Phase 1 is now feature- and test-complete.

### 2026-06-16 — Milestone 1.10 — Phase 1 Exit Gate: Lint + RLS Tenant-Isolation Tests
- Status: ✅ Completed
- What was done: Fixed the lone ESLint error (`prefer-const` on `resolvedMarkedBy` in school-admin attendance actions) and auto-fixed trivially fixable warnings — ESLint errors now 0 (427 `any`/exhaustive-deps warnings remain as non-blocking debt). Added the first integration test suite: `tests/integration/rls-tenant-isolation.test.ts`, which provisions two isolated schools against the live Supabase project, signs in as a School A admin, and asserts RLS blocks all cross-tenant reads (schools/classes/students), blocks cross-tenant INSERT (WITH CHECK), and returns nothing to an unauthenticated client. The suite self-skips without Supabase creds and cleans up every row + auth user it creates.
- Tests: `tsc --noEmit` → 0 errors; full Vitest suite → 183 passed (176 unit + 7 integration).
- Notes: Superseded by the E2E flow coverage entry above, which closed the final 1.10 item.

### 2026-02-28 — Milestones 1.1–1.5 — Project Foundation & Core CRM
- Status: ✅ Completed
- What was done: Initialized Next.js 15 + Supabase + pnpm monorepo. Zustand auth store, role-based middleware routing. Supabase schema with RLS. School configuration (classes, sections, subjects, grading). Student management with multi-step wizard, bulk Excel import/export, photo upload via Supabase Storage, admission number generation.
- Tests: `pnpm type-check` passed. Unit tests passing.

### 2026-03-01 — Milestone 1.7 — Attendance Module
- Status: ✅ Completed
- What was done: Daily attendance mark UI (class/section/date), bulk mark-all present, edit prior records, monthly per-student summary, date-wise class view, Excel import/export for attendance.

### 2026-03-13 — Milestones 1.6 & 1.8 — Teacher Management & Fee Module
- Status: ✅ Completed
- What was done: Teacher list/add/edit with auth user creation, class-section assignment UI, activate/deactivate. Fee structure, POS collection terminal, payment receipt email (Resend), payment history, pending fees view, daily collection report for managers.

### 2026-03-14 — Milestones 2.1 & 2.2 Backend — Exam & Inventory Schema
- Status: ✅ Completed (Backend only)
- What was done: Phase 2 migration with `exams`, `exam_subjects`, `marks`, `inventory_items`, `inventory_sales`, RLS policies, RPC functions (`publish_exam_results`, `unlock_exam_results`, `adjust_stock`, `create_inventory_sale`). Backend action modules for exams and inventory.
- Tests: `pnpm type-check` passed; Vitest: `exam-utils.test.ts` and `inventory-utils.test.ts` passing.

### 2026-03-14 — Phase 2 Backend Hardening
- Status: ✅ Completed
- What was done: Replaced placeholder Edge Functions with working `generate-pdf` and `send-email`. Updated attendance reads to `attendance_records` across parent summary, school-admin dashboard, reporting. Inventory POS UI, stock adjustment, low-stock alerts.
- Tests: `pnpm type-check` passed; 89 unit tests passing.

### 2026-03-15 — Dark UI Redesign
- Status: ✅ Completed
- What was done: Global dark theme (`#0a0a0a` base), dark sidebars for all roles (school-admin, teacher, manager, parent), glassmorphism stat cards, login page redesign, school-admin dashboard with Recharts weekly collection chart.

### 2026-03-15 — Milestone 2.4 — Parent Portal
- Status: ✅ Completed
- What was done: Parent dashboard (child info card, stat grid, attendance progress bar, fee summary, recent payments), attendance calendar view, exam results page (fee-locked toggle, subject breakdown, grade display), fee status page, announcements page. Multi-child switcher support via `activeChildId`.

### 2026-03-31 — P0 TypeScript Fix — Exam Module + students/new
- Status: ✅ Completed
- What was done: Fixed 11 TypeScript errors — `marks/page.tsx` (variable shadowing, `class_id` on `never`), `reports/page.tsx` (`class_id` on `never`), `new/page.tsx` (`ExamSubjectInput` type mismatch, for-loop index undefined inference), `students/new/actions.ts` (`gendehir` typo).
- Tests: `pnpm type-check` → 0 errors.

### 2026-03-31 — Milestone 1.9 — Role Dashboards (Enriched)
- Status: ✅ Completed
- What was done: Teacher dashboard expanded to 5 stat cards (Total Assignments, Class Teacher Of, Students Taught, Today's Attendance %, Pending Attendance) with quick-actions bar. Manager dashboard fully restyled to dark glassmorphism — new `actions.ts` batching all stats, 5 stat cards (Today's Collection, Transactions, Pending Fee Students, Inventory Items, Low Stock Alerts), weekly fee trend Recharts chart, low-stock warning banner, quick-actions bar.
- Tests: `pnpm type-check` → 0 errors.

### 2026-03-31 — P2 Dark Restyle — Remaining Light-Mode Pages
- Status: ✅ Completed
- What was done: Restyled `parent/results/page.tsx` (SVG progress rings, dark accordion), `parent/announcements/page.tsx` (left accent bars, audience badges), `exams/publish/page.tsx` (status pills, readiness panel, skeleton loading). All pages now match dark glassmorphism design system.
- Tests: `pnpm type-check` → 0 errors.

### 2026-04-07 — Milestone 2.1 — Report Card PDF Download Wiring
- Status: ✅ Completed
- What was done: Connected exam report-card UI download action to `generate-pdf` Edge Function using authenticated access token flow, and added loading/error UX for PDF generation in reports page.
- Tests: Local file diagnostics passed for updated page (`No errors found`).

### 2026-04-07 — Milestone 1.10 — Stable Playwright Auth Setup Flow
- Status: ✅ Completed
- What was done: Added deterministic E2E auth preparation with runtime seed script (`scripts/seed-e2e-auth.mjs`) and setup project state generation (`tests/e2e/auth.setup.ts`) that produces role storage states for school-admin, teacher, and manager users. Updated E2E specs to consume storage states instead of repeated UI login.
- Tests: `pnpm test:e2e --project=setup` → passed (`1 passed`).

### 2026-04-07 — Milestone 2.1 — Printable Report Cards + Class Batch PDF Export
- Status: ✅ Completed
- What was done: Enhanced exam report-cards page with printable template mode (`window.print` + print media styles), student search filter, and class-level batch report-card PDF export action. Extended `generate-pdf` Edge Function with `report_card_batch` and multi-page PDF rendering support.
- Tests: `pnpm type-check` → passed.

### 2026-04-07 — Milestone 2.5 — Advanced Analytics (Slice 1)
- Status: 🔄 In Progress
- What was done: Enhanced school-admin reports with advanced analytics cards and trend visualization: week-over-week fee momentum, average daily collection (7D), attendance risk monitor, and daily fee collection area chart. Added `getFeeMomentumSummary` server action for analytics computation.
- Tests: `pnpm type-check` → passed.

### 2026-04-07 — Milestone 2.5 — Advanced Analytics (Slice 2)
- Status: 🔄 In Progress
- What was done: Added exam analytics into school-admin reports with three visual insights: recent exam pass-rate trend, lowest-pass-rate subject difficulty ranking, and class-wise average score comparison. Implemented server-side `getExamAnalyticsSummary` aggregator in reports actions.
- Tests: `pnpm type-check` → passed.

### 2026-04-07 — Milestone 2.5 — Advanced Analytics (Slice 3)
- Status: 🔄 In Progress
- What was done: Added parent-facing trend analytics (6-month attendance trend and exam performance trend) in parent dashboard, plus manager financial drilldowns (payment-mode mix and class-level pending fee risk) in manager dashboard.
- Tests: `pnpm type-check` → passed.

### 2026-04-07 — Milestone 2.6 — Phase 2 Testing (Auth E2E Hardening)
- Status: 🔄 In Progress
- What was done: Hardened `tests/e2e/auth.spec.ts` by replacing flaky selectors and brittle text assertions with stable route/content checks that match current UI patterns across Chromium and Mobile Safari.
- Tests: `pnpm test:e2e tests/e2e/auth.spec.ts --reporter=line` → passed (`41 passed`).

---

## Known Issues / Blockers

- **E2E suite**: Full chromium suite is green across all modules (auth, students, attendance, fees, exams, inventory, parent, reports). Run single-worker for deterministic results; parallel 4-worker runs can hit transient `ERR_ABORTED` cold-compile flakiness against the dev server.
- **Timetable view (Parent Portal)**: Deferred — no timetable schema exists yet.

---

## Decision Log

| Date | Decision | Made By | Reason |
|------|----------|---------|--------|
| 2026-02-27 | Chose Supabase as BaaS | EduNexus Team | See ADR-001 in ARCHITECTURE.md |
| 2026-02-27 | Chose Next.js App Router | EduNexus Team | See ADR-002 in ARCHITECTURE.md |
| 2026-02-27 | Chose Tailwind + shadcn/ui | EduNexus Team | See ADR-004 in ARCHITECTURE.md |
| 2026-03-15 | Dark theme `#0a0a0a` glassmorphism design system | EduNexus Team | Faculty Framer-inspired; premium dark minimalist aesthetic |
| 2026-03-31 | Skipped formal Phase 1 exit gate | EduNexus Team | Phase 2 backend was started early due to co-development; E2E gate deferred |

---

## Update Template

When completing a task, update this file with:

```markdown
### [Date] — [Milestone] — [Task Name]
- Status: ✅ Completed
- What was done: Brief description
- Tests: What tests were run/written
- Notes: Any important decisions made
```
