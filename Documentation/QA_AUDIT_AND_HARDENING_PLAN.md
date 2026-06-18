# EduNexus — QA Audit & Production-Hardening Plan

> **Created:** 2026-06-18
> **Author:** QA / Senior Engineering review
> **Scope:** Post Phase-2 hardening. Work is divided into independent **Parts**; each Part has **Chunks** that can be picked up as discrete tasks/PRs.
> **Priority note:** Payment gateway, Mobile/PWA, and SMS/WhatsApp are intentionally **deferred to the last Part (Part 6)** per current product priorities.

---

## Baseline (verified 2026-06-18)

| Gate | Result |
|------|--------|
| `pnpm type-check` | ✅ 0 errors |
| `pnpm test` | ✅ 185 passing (14 files; 176 unit + 9 live-DB integration) |
| `pnpm lint` | ✅ 0 errors · 338 warnings (311 `no-explicit-any`, 27 `exhaustive-deps`) |
| RLS tenant isolation (live DB) | ✅ cross-tenant read/write blocked |

**Overall:** Mature, well-tested Phase-2 product with real multi-tenant isolation and server-only service keys. The items below harden it for production scale and trust.

### False positives discarded during audit (do NOT action)
- ❌ "Hard delete on students" — no `students.delete()` exists anywhere.
- ❌ "Hard delete on teachers" — teachers use soft delete (`toggleTeacherStatus` → `is_active`); the `.delete()` is on the `teacher_section_assignments` **link table**, which is correct.
- ❌ "Parent self-registration creates orphaned accounts" — **guarded**: the route returns HTTP 400 ("email and phone do not match school records") before any account is created. See [parent-register/route.ts](../src/app/api/auth/parent-register/route.ts).

---

## Part 1 — Data Integrity & Safety  · Priority **P0**

The highest-risk items: silent data loss and unrecoverable deletes.

### Chunk 1.1 — Atomic attendance upsert *(highest-risk bug)* · **✅ DONE**
- **Problem:** Attendance save did a non-atomic **delete-then-insert** for a date/class/section. If the insert failed after the delete, the day's attendance was lost with no transaction.
- **Files:** [attendance/actions.ts](../src/app/(school-admin)/school-admin/attendance/actions.ts)
- **Implemented:** Added `save_attendance_atomic(...)` SECURITY DEFINER RPC ([migration](../supabase/migrations/20260618000001_attendance_atomic_save.sql)) that wraps delete+insert in a single transaction with a tenant auth check; rewired `saveAttendance` to call it (covers both the attendance page and Excel import).
- **Acceptance:** Re-marking a day never leaves a gap; cross-school save is rejected; **4 integration tests added & passing**.

### Chunk 1.2 — Consistent soft-delete + restore · **✅ DONE**
- **Problem:** Hard deletes on config/critical templates with no recovery path.
- **Files (corrected scope):**
  - Fee structures: [fees/actions.ts](../src/app/(school-admin)/school-admin/fees/actions.ts) (`deleteFeeStructure`)
  - Settings entities (classes/sections/subjects/grading_rules/academic_years): [settings/actions.ts](../src/app/(school-admin)/school-admin/settings/actions.ts)
  - **NOT schools** — there is no user-facing school delete; the super-admin `.delete()` calls are rollback cleanup inside `createSchool`. Schools use `setSchoolSuspended` (soft via `is_active`).
- **Implemented:** [Migration `20260618000002`](../supabase/migrations/20260618000002_soft_delete_config_entities.sql) adds `deleted_at` to all 6 tables, swaps the hard `UNIQUE(...)` constraints for **partial unique indexes** (`WHERE deleted_at IS NULL`, so a deleted name is reusable), and updates RLS so soft-deleted rows are hidden from every session-client read (both the staff-read **and** the FOR-ALL manage policy USING clauses; manage WITH CHECK keeps working for live-row writes). `academic_years` (which had RLS on but **no policies** — default-deny) gained the standard staff-read + admin-manage policies. The delete actions now soft-delete and new `restore*` actions clear `deleted_at`; both run via the **service-role client, explicitly scoped to the caller's school** (resolved via `requireActor`) and write an audit row. Added `getDeletedConfigEntities()` to back a future restore/trash UI.
- **Acceptance:** Deleting hides the row everywhere but it remains restorable; a deleted name can be recreated; tenant isolation holds. **4 integration tests** (`tests/integration/soft-delete-config.test.ts`) passing. *(Gates green: type-check 0, lint 0 errors, 193 tests pass.)*

### Chunk 1.3 — Audit log (who/what/when) · **✅ DONE**
- **Problem:** No school-level activity trail — a trust/compliance gap vs. every competitor.
- **Pre-existing:** `audit_logs` table + RLS (scoped to `school_id`) + `logAudit()` helper already existed; **super-admin** actions were already fully audited (school create/update/suspend, plan pricing, user activate/deactivate, password reset).
- **Implemented (school-level gap closed):** Wired `logAudit()` into the high-value school-admin write actions — fee collection (`collectFeePayment` → `fee.payment.collected`), exam publish/unlock (`publishExamResults`/`unlockExamResults`), student admission (`createStudent` → `student.created`), and teacher onboarding/access (`createTeacher`, `toggleTeacherStatus`). The two teacher actions also gained the previously-missing `requireActor(['school_admin'])` auth gate. Destructive deletes (fee structures + settings entities) are audited as part of **Chunk 1.2** (`*.deleted` / `*.restored`).
- **Acceptance:** Sensitive writes produce an audit row; trail is RLS-scoped per school. *(Gates green: type-check 0, lint 0 errors, 193 tests pass.)*

---

> **Part 1 status: ✅ COMPLETE** (1.1 atomic attendance, 1.2 soft-delete + restore, 1.3 audit). Two migrations applied to the remote DB; 8 new integration tests; full suite 193 passing.

---

## Part 2 — Validation & Security Boundary  · Priority **P0 / P1**

Tighten server-action input validation (you already use Zod — coverage is just incomplete).

### Chunk 2.1 — Zod on all server actions (P0)
- **Files:**
  - `createTeacher()` — no validation: [teachers/actions.ts](../src/app/(school-admin)/school-admin/teachers/actions.ts#L363)
  - Student create — only `first_name` + `admission_number` validated, rest `.passthrough()`: [students/new/actions.ts](../src/app/(school-admin)/school-admin/students/new/actions.ts#L11-L15)
- **Fix:** Complete Zod schemas (email format, password policy, phone, DOB, gender enum, `class_id` uuid). Parse at the top of each action.
- **Acceptance:** Invalid payloads rejected with field-level messages before any DB call.

### Chunk 2.2 — Fee payment guards (P1)
- **Problem:** `paymentMode` not enum-checked; `amount` not guarded against negative/extreme values.
- **Files:** [fees/actions.ts](../src/app/(school-admin)/school-admin/fees/actions.ts#L264)
- **Fix:** Zod enum for `paymentMode`; `amount` positive + sane upper bound; reject overpayment beyond balance (or allow with explicit flag).
- **Acceptance:** Bad payment payloads rejected; unit tests for boundary amounts.

### Chunk 2.3 — Destructive-action confirmation (P1)
- **Problem:** School hard-delete (pre-1.2) and other destructive ops lack a confirm gate.
- **Fix:** Require typed confirmation (school name) in UI + server-side re-check before purge.
- **Acceptance:** No single-click irreversible deletes.

---

## Part 3 — Error Handling & UX Consistency  · Priority **P1**

### Chunk 3.1 — Surface fetch failures (no silent empty states)
- **Files:**
  - Parent dashboard `.catch(console.error)` with no toast: [parent/dashboard/page.tsx](../src/app/(parent)/parent/dashboard/page.tsx#L57)
  - Parent results: [parent/results/page.tsx](../src/app/(parent)/parent/results/page.tsx)
  - Inventory edit blank-on-error: [inventory/[itemId]/edit/page.tsx](../src/app/(manager)/manager/inventory/[itemId]/edit/page.tsx#L59-L82)
- **Fix:** Standard error toast + inline error/empty state + retry. Consider a shared `useAsync` wrapper ([use-async.ts](../src/hooks/use-async.ts)) applied consistently.
- **Acceptance:** Every data view renders an explicit loading / error / empty state.

### Chunk 3.2 — Inline form validation feedback
- **Problem:** Some forms only `toast.error` after submit (e.g. password rules) instead of inline as-you-type.
- **Files:** [create-account/page.tsx](../src/app/(auth)/create-account/page.tsx#L90-L98)
- **Fix:** React-hook-form + Zod resolver inline messages.
- **Acceptance:** Validation shown at field level before submit.

---

## Part 4 — Performance & Scale  · Priority **P1 / P2**

### Chunk 4.1 — Teacher dashboard query fan-out (P1)
- **Problem:** One `count` query per class-teacher section (N parallel queries).
- **Files:** [teacher/dashboard/actions.ts](../src/app/(teacher)/teacher/dashboard/actions.ts#L110-L125)
- **Fix:** Replace per-section counts with a single grouped query / RPC returning counts per section.
- **Acceptance:** Constant query count regardless of section count.

### Chunk 4.2 — Pagination on unbounded reads (P2)
- **Problem:** `getPendingFees()` pulls all students + all payments and aggregates in JS; `getStudentPaymentHistory()` unbounded. Grows unboundedly as payment history accumulates.
- **Files:** [fees/actions.ts](../src/app/(school-admin)/school-admin/fees/actions.ts#L406-L478)
- **Fix:** Server-side pagination/limit; consider a DB view/RPC for pending-fee aggregation.
- **Acceptance:** Bounded payloads; large-school load test passes.

### Chunk 4.3 — Harden `exhaustive-deps` suppressions (P2)
- **Problem:** 27 suppressed hook-dep warnings — safe today, fragile under refactor.
- **Fix:** Audit each; stabilize callbacks with `useCallback`/refs; remove suppressions where safe.
- **Acceptance:** Suppression count reduced; no refetch loops.

---

## Part 5 — Accessibility & Code Quality  · Priority **P2**

### Chunk 5.1 — Accessibility pass
- **Problems:** icon-only buttons without `aria-label`; inputs without `htmlFor`/`id`; generic alt text; no automated a11y in CI.
- **Files:** [inventory/page.tsx](../src/app/(manager)/manager/inventory/page.tsx#L81-L91), [inventory/new/page.tsx](../src/app/(manager)/manager/inventory/new/page.tsx#L108-L183)
- **Fix:** Add labels/aria; descriptive alt; add `axe-core`/Lighthouse CI step (the testing strategy already promises Lighthouse CI).
- **Acceptance:** Key flows pass axe with no critical violations.

### Chunk 5.2 — `any` burn-down against generated DB types
- **Problem:** 311 `no-explicit-any` + several `@ts-expect-error` on `.update()` calls mask schema drift.
- **Fix:** Type Supabase results against `database.types.ts` incrementally, module by module; remove `@ts-expect-error`.
- **Acceptance:** Warning count trending down each PR; no `@ts-expect-error` on writes.

### Chunk 5.3 — De-duplicate `getSupabase()` helper
- **Problem:** Near-identical `getSupabase()` + cookie try/catch duplicated across 10+ action files.
- **Fix:** Centralize in [src/lib/supabase/server.ts](../src/lib/supabase/server.ts).
- **Acceptance:** Single shared helper; call sites updated.

---

## Part 6 — Deferred Competitive Features  · Priority **LAST (not now)**

> Explicitly deferred per current priorities. Listed for roadmap completeness only.

### Chunk 6.1 — Online payment gateway
- Razorpay/Stripe on top of existing POS; webhooks → `fee_payments`; reconciliation.

### Chunk 6.2 — Mobile app / PWA
- PWA install + offline attendance marking first; native shell later (Phase 4).

### Chunk 6.3 — SMS / WhatsApp notifications
- Add SMS/WhatsApp channel alongside existing Resend email; start with absence + fee-due alerts.

---

## Suggested execution order

1. **Part 1** (data safety) — start with **Chunk 1.1 (atomic attendance)**, then 1.2 + 1.3 (share a migration).
2. **Part 2** (validation) — 2.1 then 2.2 / 2.3.
3. **Part 3** (UX/error handling).
4. **Part 4** (performance).
5. **Part 5** (a11y / code quality, ongoing/incremental).
6. **Part 6** — deferred.

> Each Chunk should ship with: migration (if any), updated/added tests, and a `pnpm ai:sync-context` refresh per repo workflow.
