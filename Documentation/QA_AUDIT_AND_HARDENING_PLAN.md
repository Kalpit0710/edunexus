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
- **Restore/trash UI (follow-up · ✅ DONE 2026-06-19):** Added a reusable [`DeletedItemsPanel`](../src/app/(school-admin)/school-admin/settings/components/deleted-items-panel.tsx) (auto-hides when the trash is empty) wired into all five settings config tabs (classes, sections, subjects, academic years, grading rules) — each delete bumps a `refreshKey` and a successful **Restore** re-fetches the live list. Fee structures gained a parallel trash section on the fees page backed by a new `getDeletedFeeStructures(schoolId, academicYearId?)` action (tenant-scoped admin client, composed `class · category · ₹amount` label). All restores route through the existing tenant-scoped `restore*` server actions.

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

### Chunk 2.1 — Zod on all server actions (P0) · ✅ DONE
- **Files:**
  - `createTeacher()` — no validation: [teachers/actions.ts](../src/app/(school-admin)/school-admin/teachers/actions.ts#L363)
  - Student create — only `first_name` + `admission_number` validated, rest `.passthrough()`: [students/new/actions.ts](../src/app/(school-admin)/school-admin/students/new/actions.ts#L11-L15)
- **Fix:** Complete Zod schemas (email format, password policy, phone, DOB, gender enum, `class_id` uuid). Parse at the top of each action.
- **Acceptance:** Invalid payloads rejected with field-level messages before any DB call.
- **Implemented:**
  - Student create: optional-field validators that tolerate empty string **and** null/undefined (form sends `''` for skipped fields) — email format, phone length, gender enum (lowercased), `YYYY-MM-DD` DOB, `class_id`/`section_id` uuid; `.passthrough()` retained for extra keys; `safeParse` → first `issues[0].message`.
  - Teacher create: reuses the pure, unit-tested `validateTeacherCreateFields` (full_name, email format, password ≥ 8, join_date) so client `validateStep` and server rules match exactly (no client/server divergence) + optional phone length check.

### Chunk 2.2 — Fee payment guards (P1) · ✅ DONE
- **Problem:** `paymentMode` not enum-checked; `amount` not guarded against negative/extreme values.
- **Files:** [fees/actions.ts](../src/app/(school-admin)/school-admin/fees/actions.ts#L264)
- **Fix:** Zod enum for `paymentMode`; `amount` positive + sane upper bound; reject overpayment beyond balance (or allow with explicit flag).
- **Acceptance:** Bad payment payloads rejected; unit tests for boundary amounts.
- **Implemented:** `collectFeeInputSchema` + `validateCollectFeeInput` in [fee-utils.ts](../src/lib/fee-utils.ts) wired at the top of `collectFeePayment`. Guards: `studentId`/`categoryId`/`collectedById` uuid; non-empty items; `feeMoney` (finite, non-negative, ≤ `MAX_FEE_TRANSACTION_AMOUNT` = ₹1 crore); `paidAmount` > 0; `paymentMode` app-level enum (`cash,cheque,upi,neft,card,online`); `discountAmount` ≤ items total. **Cash overpayment is intentionally allowed** (POS change-due flow) — documented in code + asserted by a test. +11 unit tests (33 total in fee-utils).

### Chunk 2.3 — Destructive-action confirmation (P1) · ✅ DONE
- **Problem:** School hard-delete (pre-1.2) and other destructive ops lack a confirm gate.
- **Fix:** Require typed confirmation (school name) in UI + server-side re-check before purge.
- **Acceptance:** No single-click irreversible deletes.
- **Audit finding:** No user-facing hard delete exists — `deleteStudent` is soft (post-1.2), `setSchoolSuspended` is reversible. The highest-impact destructive op is **school suspension** (blocks an entire tenant), which previously used a single `window.confirm`.
- **Implemented:** `setSchoolSuspended(id, suspended, expectedName?)` now re-checks the typed name server-side (admin client) and throws on mismatch when suspending; reactivation needs no confirmation. The super-admin school detail page replaces `window.confirm` with a controlled typed-confirmation `Dialog` — the destructive **Suspend** button stays disabled until the operator types the exact school name. Implemented inline (single use, no shared abstraction).

> **Part 2 status: ✅ COMPLETE** (2.1 Zod on student/teacher actions, 2.2 fee payment guards + 11 tests, 2.3 typed-confirmation for school suspension with server-side re-check). Gates green: type-check 0, lint 0 errors, full suite 204 passing.

---

## Part 3 — Error Handling & UX Consistency  · Priority **P1**

### Chunk 3.1 — Surface fetch failures (no silent empty states) · ✅ DONE
- **Files:**
  - Parent dashboard `.catch(console.error)` with no toast: [parent/dashboard/page.tsx](../src/app/(parent)/parent/dashboard/page.tsx#L57)
  - Parent results: [parent/results/page.tsx](../src/app/(parent)/parent/results/page.tsx)
  - Inventory edit blank-on-error: [inventory/[itemId]/edit/page.tsx](../src/app/(manager)/manager/inventory/[itemId]/edit/page.tsx#L59-L82)
- **Fix:** Standard error toast + inline error/empty state + retry. Consider a shared `useAsync` wrapper ([use-async.ts](../src/hooks/use-async.ts)) applied consistently.
- **Acceptance:** Every data view renders an explicit loading / error / empty state.
- **Implemented:** Added a shared [`DataLoadError`](../src/components/shared/DataLoadError.tsx) component (friendly headline + detail + **Try Again** retry). Replaced silent `.catch(console.error)` swallowing across **all** client data views — parent dashboard, parent results (previously had *no* error handling → infinite spinner on failure), teacher dashboard, school-admin dashboard (parallel fetches via `Promise.allSettled`), manager dashboard, and reports. Each now sets an `error` state, shows a `toast.error` with a user-friendly message, and renders `DataLoadError` with retry. The student-profile secondary payment fetch swaps `console.error` for a toast. The inventory edit page already toasted + redirected on load failure (no change needed). Best-effort **server-action** email logs (`console.error` in fees/teachers/attendance/inventory/onboarding actions) are intentional background logging, left as-is.

### Chunk 3.2 — Inline form validation feedback · ✅ DONE
- **Problem:** Some forms only `toast.error` after submit (e.g. password rules) instead of inline as-you-type.
- **Files:** [create-account/page.tsx](../src/app/(auth)/create-account/page.tsx#L90-L98)
- **Fix:** React-hook-form + Zod resolver inline messages.
- **Acceptance:** Validation shown at field level before submit.
- **Implemented:** Converted the parent create-account **Step 2** (email / phone / password / confirm) from imperative `toast.error`-after-click checks to `react-hook-form` + `zodResolver` with `mode: 'onTouched'` and shadcn `Form`/`FormField`/`FormMessage` field-level errors (same pattern as login/reset-password). The client `parentSchema` mirrors the server `registerSchema` exactly (email format, phone trimmed length 6–30, password min 8 + uppercase/lowercase/digit, confirm-equality refine) so inline validation never rejects an input the server would accept. Step 1 (student lookup) stays controlled — it's a lookup, not field validation.

> **Part 3 status: ✅ COMPLETE** (3.1 surface fetch failures via shared `DataLoadError` + retry across 6 data views, 3.2 inline RHF+Zod validation on parent registration). Gates green: type-check 0, lint 0 errors, full suite 204 passing.

---

## Part 4 — Performance & Scale  · Priority **P1 / P2**

### Chunk 4.1 — Teacher dashboard query fan-out (P1) · ✅ DONE
- **Problem:** One `count` query per class-teacher section (N parallel queries).
- **Files:** [teacher/dashboard/actions.ts](../src/app/(teacher)/teacher/dashboard/actions.ts#L110-L125)
- **Fix:** Replace per-section counts with a single grouped query / RPC returning counts per section.
- **Acceptance:** Constant query count regardless of section count.
- **Implemented:** Replaced the `classTeacherSections.map(async … count …)` fan-out with **one** `attendance_records` lookup (`.select('section_id').in('section_id', classTchrSectionIds).eq('date', today)`); the marked section IDs are deduped into a `Set` and compared against the class-teacher sections by the new pure helper `computePendingAttendanceSections` in [teacher-utils.ts](../src/lib/teacher-utils.ts). Query count for the pending-attendance check is now constant (1) regardless of how many sections a teacher owns. +7 unit tests (boundary cases: none/all marked, duplicate rows from the grouped query, foreign IDs, empty sections, `Set` input).

### Chunk 4.2 — Pagination on unbounded reads (P2) · ✅ DONE
- **Problem:** `getPendingFees()` pulls all students + all payments and aggregates in JS; `getStudentPaymentHistory()` unbounded. Grows unboundedly as payment history accumulates.
- **Files:** [fees/actions.ts](../src/app/(school-admin)/school-admin/fees/actions.ts#L406-L478)
- **Fix:** Server-side pagination/limit; consider a DB view/RPC for pending-fee aggregation.
- **Acceptance:** Bounded payloads; large-school load test passes.
- **Implemented:** Added migration `20260618000003_pending_fees_aggregation.sql` — a `get_pending_fees(p_school_id)` `SECURITY DEFINER` RPC (with the standard `is_super_admin() OR get_my_school_id()` tenant guard) that aggregates fee structures + payments **in SQL** and returns only students with a positive balance (sorted by balance). `getPendingFees()` now calls the RPC instead of pulling every student + every payment into Node. `getPaymentsByStudent`/`getStudentPaymentHistory` gained a bounded `limit` (default 200, applied via `.limit()`). Behaviour mirrors the old JS exactly (verified). +4 integration tests (`tests/integration/pending-fees-aggregation.test.ts`): correct totals, excludes fully-paid + inactive students, tenant isolation.

### Chunk 4.3 — Harden `exhaustive-deps` suppressions (P2) · ✅ DONE
- **Problem:** 27 suppressed hook-dep warnings — safe today, fragile under refactor.
- **Fix:** Audit each; stabilize callbacks with `useCallback`/refs; remove suppressions where safe.
- **Acceptance:** Suppression count reduced; no refetch loops.
- **Implemented:** Eliminated **all 24** `react-hooks/exhaustive-deps` warnings (→ 0). Converted ~23 page/tab loaders to `useCallback` with honest dep arrays and `useEffect(() => loader(), [loader])`. Used the stable primitive `school?.id` (not the `school` object) with internal `if (!school?.id) return` self-guards so deps never loop even when a store returns fresh objects. Fragile cases handled with refs/imperatives without behaviour change: parent layout reads `activeChildId` via `useAuthStore.getState()`; fees list/history keep filter values in refs (filters applied explicitly); inventory reports uses a date-range ref + mount ref to preserve mount-load-then-date-reload; the exam-marks nested loader was reordered into two `useCallback`s. Also stabilised an unrealistic `useRouter()`/store mock in the inventory UI test.

> **Part 4 status: ✅ COMPLETE** (4.1 teacher-dashboard fan-out → single grouped query; 4.2 pending-fee SQL aggregation RPC + bounded payment history; 4.3 zero `exhaustive-deps` warnings). Gates green: type-check 0, lint 0 errors, `exhaustive-deps` 0, full suite 215 passing.

---

## Part 5 — Accessibility & Code Quality  · Priority **P2**

### Chunk 5.1 — Accessibility pass · ✅ DONE
- **Problems:** icon-only buttons without `aria-label`; inputs without `htmlFor`/`id`; generic alt text; no automated a11y in CI.
- **Files:** [inventory/page.tsx](../src/app/(manager)/manager/inventory/page.tsx#L81-L91), [inventory/new/page.tsx](../src/app/(manager)/manager/inventory/new/page.tsx#L108-L183)
- **Fix:** Add labels/aria; descriptive alt; add `axe-core`/Lighthouse CI step (the testing strategy already promises Lighthouse CI).
- **Acceptance:** Key flows pass axe with no critical violations.
- **Implemented:** Added `aria-label` to **every icon-only button that lacked an accessible name** across the app — back buttons (inventory new/stock/pos/reports/edit, exams marks/publish/reports, fees pending/history, exams new, students new/[id]/[id]·edit) and delete/remove buttons (settings tabs ×5, fees structure, students list edit/delete, teacher assignment, exam subject row, onboarding grading rule). `title`-bearing buttons already exposed names and were left as-is. Associated all labels↔inputs via `htmlFor`/`id` in the inventory **new** and **edit** forms. Improved the student-photo `alt`. Added **`vitest-axe`** and two axe assertions (inventory create + edit forms) proving **no violations** — the first automated a11y coverage. NOTE: label/`htmlFor` association on the *remaining* forms (settings, students/new, teachers/new, exams/new, fees) is follow-up work tracked for a later pass.
- **Label/`htmlFor` follow-up (✅ DONE 2026-06-19):** Associated every labelled field with its control across the remaining forms — settings **grading** tab (`<span>` → real `<label htmlFor>`) and **academic** tab (start-month select + term name/start/end inputs), **students/new** (all 4 steps, including selects + file + textarea), **students/[id]/edit** (personal/academic/parent sections), **teachers/[id]** assignment Selects (`SelectTrigger id` ↔ label), **fees/collect** payment details, and **exams/new** (step-1 fields + indexed step-2 subject rows via `htmlFor={`field-${index}`}`).

### Chunk 5.2 — `any` burn-down against generated DB types · ✅ DONE (root cause fixed 2026-06-18)
- **Problem:** 311 `no-explicit-any` + several `@ts-expect-error` on `.update()` calls mask schema drift.
- **Fix:** Type Supabase results against `database.types.ts` incrementally, module by module; remove `@ts-expect-error`.
- **Acceptance:** Warning count trending down each PR; no `@ts-expect-error` on writes.
- **Root cause found + fixed:** The write-side `@ts-expect-error`/`as any` were **not** lazy masks — they suppressed a genuine project-wide `never`-typing failure caused by **`@supabase/ssr@0.5.2`** (its `createServerClient<Database>`/`createBrowserClient<Database>` typings were too old; the base `@supabase/supabase-js` typed client compiled fine in isolation). The generated `src/types/database.types.ts` was **also severely stale** — missing ~12 tables (`exams`, `exam_subjects`, `marks`, `plan_prices`, `inventory_*`, `fee_payments`, `audit_logs`, …); the old loose typing hid this. Fix: upgraded `@supabase/ssr` `^0.5.2 → ^0.12.0` and `@supabase/supabase-js` `^2.47 → ^2.108` (peer), then regenerated types via `pnpm db:types` (CLI was authed to the live EduNexus project) — now 26 tables + RPC functions.
- **Implemented (this PR):** With the upgrade + regen, all **21 write-side `@ts-expect-error` directives became unused and were removed** (settings, onboarding, teachers, students, students/new) and their payloads typed against the generated `Insert`/`Update` types. Read-side `as any` burned down where the client is now typed: `app-initializer.tsx` (15), `login/page.tsx` (3, + a surfaced real schema-drift fix — `subscription_plan/status` are DB `string` but app unions, now an explicit typed cast not `any`), the shared `student-parent-sync.ts` helper (`db: any` → `SupabaseClient<Database>`, dropping 5 `as any` at call sites), two student read helpers, and `email.ts`. The **only** remaining `@ts-expect-error` is a **non-write** dynamic-index on local React state in `onboarding/page.tsx` — so **"no `@ts-expect-error` on writes" is met**.
- **Result:** `no-explicit-any` **358 → 321**; `@ts-expect-error` **22 → 1**; type-check 0 errors; lint 0 errors; full suite **217 passing**; `pnpm build` green (incl. SSR middleware). Remaining `any` (teacher-dashboard nested relation selects, reports/fees data-shape casts, `parent/actions.ts` `db: any`, `bulkCreateStudents(studentsData: any[])`, Next typed-routes `href as any`, and the dead fee-reminders cron whose `fee_installments` table doesn't exist) is incremental follow-up.
- **`parent/actions.ts` follow-up (✅ DONE 2026-06-19):** Typed the `ParentAccessContext.db` field and `getParentAccessContext`'s `db` local against the generated admin client (`Awaited<ReturnType<typeof createAdminClient>>`) instead of `any`, so every parent query is now type-checked. The single exception — `getLatestAnnouncements`, which queries an `announcements` table not present in the generated types ("may not exist yet; fail closed") — keeps one **localized** `(context.db as any)` cast. Net: `no-explicit-any` 323 → 322.
- **⚠️ Process note (kept):** `get_errors` (IDE language server) did **not** surface the `never` errors — only `pnpm type-check` (tsc) did. Always validate Supabase read/write changes with `pnpm type-check`.

### Chunk 5.3 — De-duplicate `getSupabase()` helper · ✅ DONE
- **Problem:** Near-identical `getSupabase()` + cookie try/catch duplicated across 9 action files.
- **Fix:** Centralize in [src/lib/supabase/server.ts](../src/lib/supabase/server.ts).
- **Acceptance:** Single shared helper; call sites updated.
- **Implemented:** Deleted all 9 local `getSupabase()` implementations (teacher dashboard, school-admin dashboard, super-admin, onboarding, attendance, teachers, students, students/new, settings) — each was an identical copy of the cookie-aware SSR client already exported as `createClient()` from [server.ts](../src/lib/supabase/server.ts). The 8 files that only used the helper now `import { createClient as getSupabase } from '@/lib/supabase/server'`, so every existing `await getSupabase()` call site and `Awaited<ReturnType<typeof getSupabase>>` type resolves to the single shared helper unchanged. `settings/actions.ts` (which already imported the shared client as `createServerSupabaseClient`) keeps that import and aliases `const getSupabase = createServerSupabaseClient` for its remaining call sites. Removed the now-unused `@supabase/ssr` (`createServerClient`/`CookieOptions`), `next/headers` `cookies`, and (where applicable) `Database` imports; `super-admin` retains `cookies` since it uses it for impersonation cookie writes. A side benefit: super-admin's session client is now typed (`<Database>`) instead of untyped. Gates green: type-check 0, lint 0 errors, full suite **217 passing**.

---

## Part 6 — Deferred Competitive Features  · Priority **LAST (not now)**

> Explicitly deferred per current priorities. Online payment gateway and SMS/WhatsApp are planned **before deployment**; the codebase is now **seam-ready** for them (see readiness below). The mobile app / PWA remains fully deferred (no readiness work done).

### Part 6 readiness (✅ seams added 2026-06-19 — no live providers/SDKs)

The architecture is prepared so each Part 6 feature is a **drop-in**, not a refactor. No Razorpay/Stripe/Twilio SDKs or credentials are added yet.

**Notifications (SMS / WhatsApp) — `src/lib/notifications/index.ts`:**
- A channel-agnostic `notify({ channel, to, event, ... })` dispatcher with a `NotificationChannelProvider` contract and a `channel` registry. `email` is wired (delegates to the existing `sendEmail` Resend integration); `sms` and `whatsapp` are registered as **not-configured** placeholders that resolve `{ success: false, skipped: true }` instead of throwing.
- `isChannelConfigured(channel)` lets callers fan out safely. The shared event vocabulary is `NotificationEvent` (= `EmailEvent`).
- **To add a provider later:** implement `NotificationChannelProvider` for the channel (env-gated `isConfigured()`, real `send()` + a `notification_logs` insert) and swap it into the `providers` map — **no call sites change**. The `notification_logs` table already has a `type` column; a real text provider also needs a small migration adding a generic `recipient` column (so a phone isn't stored in `recipient_email`).

**Online payment gateway — `src/lib/payments/index.ts` + `src/app/api/payments/webhook/route.ts`:**
- A `PaymentProvider` contract (`createOrder` / `verifyWebhook`) with typed `PaymentOrderRequest` / `VerifiedPayment` (amounts in minor units to avoid float drift), plus an **empty** provider registry and `getActivePaymentProvider()` / `isOnlinePaymentEnabled()`.
- A webhook route that responds **501** until a provider is registered, and (once wired) verifies the signature **before** trusting any amount.
- **Schema is already gateway-ready:** `fee_payments.payment_mode` includes `'online'` and `reference_number` holds the gateway payment id — a verified capture records an `online` `fee_payments` row via the **service-role client scoped to the verified `school_id`** (the webhook has no user session, so it cannot use `requireActor`).
- **To add a provider later:** implement `PaymentProvider`, register it, add the checkout server action + the persist step in the webhook (the TODO is marked in the route).

### Chunk 6.1 — Online payment gateway
- Razorpay/Stripe on top of existing POS; webhooks → `fee_payments`; reconciliation. **Seam ready** (above).

### Chunk 6.2 — Mobile app / PWA
- PWA install + offline attendance marking first; native shell later (Phase 4). *(No readiness work — fully deferred.)*

### Chunk 6.3 — SMS / WhatsApp notifications
- Add SMS/WhatsApp channel alongside existing Resend email; start with absence + fee-due alerts. **Seam ready** (above).

---

## Suggested execution order

1. **Part 1** (data safety) — start with **Chunk 1.1 (atomic attendance)**, then 1.2 + 1.3 (share a migration).
2. **Part 2** (validation) — 2.1 then 2.2 / 2.3.
3. **Part 3** (UX/error handling).
4. **Part 4** (performance).
5. **Part 5** (a11y / code quality, ongoing/incremental).
6. **Part 6** — deferred.

> Each Chunk should ship with: migration (if any), updated/added tests, and a `pnpm ai:sync-context` refresh per repo workflow.

## Mermaid Visual Summary

`mermaid
flowchart LR
  Discovery --> Planning --> Build --> Validate --> Release
`
