# EduNexus — Product Backlog (Bugs & Enhancements)

> **Created:** 2026-06-19
> **Supersedes:** the former `QA_AUDIT_AND_HARDENING_PLAN.md` (Parts 1–5 of that plan are ✅ done; Part 6 readiness is captured below).
> **Authoritative current status:** [PROGRESS.md](./PROGRESS.md). This file is the *forward* backlog — what to build/fix next to run EduNexus in a real primary school **and** sell it to others.
> **Source:** in-depth code audit (2026-06-19). Each item cites real files; severity is P0 (data-loss/security/revenue) · P1 (blocks adoption) · P2 (nice-to-have).

---

## ✅ Already done (context — do not redo)
- **Hardening Parts 1–5** (ex-QA plan): atomic attendance RPC, soft-delete + restore UI, audit logging, Zod validation, fee-payment guards, typed-confirmation destructive actions, error/empty/loading states, perf RPCs, a11y pass, `any`/`@ts-expect-error` burn-down, de-duped Supabase helper.
- **Phases 1 & 2 complete** (signed off 2026-06-16). Tests: 217 passing; type-check 0; lint 0 errors.
- **Part 6 seams in place** (no live providers yet) — see [§ Part 6 readiness](#part-6-readiness-seams-only) below.

---

## 🔴 Tier 0 — "Make it sellable" (do first) · ✅ **COMPLETE 2026-06-19**

### B0.1 — SaaS plan / trial / suspension enforcement · **P0 (revenue)** · ✅ **lockout DONE 2026-06-19**
- **What exists:** [plan-features.ts](../src/lib/plan-features.ts) (tier→feature map), [plan-guard.ts](../src/lib/plan-guard.ts) `requireFeature()`, and `schools.subscription_plan` / `subscription_status` / `trial_ends_at` columns.
- **Plan-tier gating (already wired):** `requireFeature()` **is** called in the school-admin module layouts ([reports](../src/app/(school-admin)/school-admin/reports/layout.tsx), teachers, fees, exams) — server-side defense behind the client nav gating. *(Earlier audit claim that it was unused was wrong.)*
- **✅ Lockout implemented (the real gap):** suspended schools and expired trials were **not** blocked at request time. Added pure [`evaluateSubscriptionAccess`](../src/lib/subscription-access.ts) (8 unit tests) + middleware enforcement ([supabase/middleware.ts](../src/lib/supabase/middleware.ts)) that redirects non-super-admin users of a `suspended`/`trial_expired` school to a new [`/subscription-inactive`](../src/app/subscription-inactive/page.tsx) lockout screen (with sign-out). Fail-open on any read issue so legitimate users are never locked out.
- **Remaining (lower priority):** wire `requireFeature` into the manager (inventory) + communication + parent_portal entry points for full tier parity; optional plan-limit (max students/teachers) enforcement at create time.

### B0.2 — Dead fee-reminder cron queries a non-existent table · **P0 (silent failure)** · ✅ **DONE 2026-06-19**
- **Where:** `src/app/api/cron/fee-reminders/route.ts` queried `fee_installments`, which **no migration creates**, behind a `db = supabase as any` cast → returned 0 rows forever; no `vercel.json` ever scheduled it.
- **Resolved:** deleted the dead route (option a). The `FeeReminderEmail` template is kept for when the reminder feature is properly rebuilt against the real schema (`get_pending_fees` RPC) + a real scheduler + the notification dispatcher.

### B0.3 — UTC date footgun in day-keyed operations · **P1 (logic)** · ✅ **DONE 2026-06-19**
- **Where:** `new Date().toISOString().split('T')[0]` (UTC date) was used for "today" across attendance/fees/dashboards. For an IST school, late-evening operations recorded under the **wrong day**.
- **Resolved:** added timezone-aware [`date-utils.ts`](../src/lib/date-utils.ts) (`schoolToday()` / `localDateISO(instant, tz)`, default `Asia/Kolkata`, override via `NEXT_PUBLIC_DEFAULT_TIMEZONE`) with 6 boundary unit tests. Routed the operational "today" derivations through it: attendance mark + import default date, teacher dashboard pending-attendance check, manager dashboard today + 7-day window, fees history range, parent attendance "today" highlight, and the teacher/student join-date form defaults. Per-school timezones (store on `schools`) remain a future enhancement.

### B0.4 — Observability · **P1 (ops)** · ✅ **DONE 2026-06-19**
- **Missing:** error tracking (Sentry), `/health` endpoint, structured logging, rate limiting on public/auth routes beyond Supabase defaults.
- **Done:**
  - [`/api/health`](../src/app/api/health/route.ts) liveness/readiness probe (200 / 503), allow-listed in middleware.
  - **Sentry** wired (`@sentry/nextjs`): client/server/edge configs + `src/instrumentation.ts` (`onRequestError`) + `src/app/global-error.tsx`, `withSentryConfig` in `next.config.ts`. PII off (`sendDefaultPii: false`), no session replay, enabled only in production with a DSN. DSN/org/project in gitignored `.env.local`.
  - **Rate limiting** (`@upstash/ratelimit` + `@upstash/redis`): [`src/lib/rate-limit.ts`](../src/lib/rate-limit.ts) sliding-window limiter (fail-open when Upstash unset), wired into the public `parent-register` route (10/min/IP → 429).
- **Note:** login uses Supabase's built-in auth rate limiting (client-side `signInWithPassword`, no custom route to gate). Renaming `sentry.client.config.ts` → `instrumentation-client.ts` is deferred until Next ≥ 15.3 (current 15.1.7 doesn't auto-load it).

### B0.5 — Small typed-cast / debt quick wins · **P2** · ✅ **DONE 2026-06-19**
- Login `subscription_plan/status` casts were already explicit (`as SubscriptionPlan/Status`) — no `any` there.
- Typed `bulkCreateStudents(studentsData: BulkStudentRow[])` (was `any[]`) and removed the last `@ts-expect-error` (onboarding grading-rule index → `Record<string, string|number>` cast). `no-explicit-any` 322 → **310**; `@ts-expect-error` now **0**.
- **Remaining (incremental, P2):** teacher-dashboard nested-relation selects + reports/fees data-shape casts + Next typed-routes `href as any` — left as ongoing burn-down (each needs per-shape typing against generated relation types).

---

## 🟡 Tier 1 — "Win primary schools" (feature gaps)

> Implemented today: students, attendance, fees/POS, exams/report-cards, teachers, parent portal, inventory, announcements.

| ID | Feature | Why it matters for primary schools | Severity |
|----|---------|-----------------------------------|----------|
| F1.1 | **Timetable / class schedule** | Asked for on day one; drives the teacher + parent day view | ✅ **DONE 2026-06-19** |
| F1.2 | **Homework / daily diary** | Primary parents live in this; biggest engagement driver | ✅ **DONE 2026-06-19** |
| F1.3 | **Year-end promotion / roll-over** | Bulk move Class 1→2, graduate the top class, roll the year | ✅ **DONE 2026-06-19** |
| F1.4 | **Self-serve school onboarding** | Today only super-admin can create a school + admin user → caps sales velocity. Add a guarded signup + trial provisioning. | **P1 (growth)** |
| F1.5 | Holiday / academic calendar | Feeds attendance "holiday" + parent calendar | ✅ **DONE 2026-06-19** |
| F1.6 | Transfer certificate + ID-card generation | Standard admin paperwork (PDF) | 🟡 **TC DONE 2026-06-19** · ID card pending |
| F1.7 | Health / allergy records on student profile | Safety expectation for young kids | ✅ **DONE 2026-06-19** |
| F1.8 | Library lending (checkout + due dates) | Extends inventory beyond POS | ✅ **DONE 2026-06-19** |
| F1.9 | Transport / bus assignment | Common add-on | ✅ **DONE 2026-06-19** |

---

## 🟢 Tier 2 — "Wow / differentiate" (creative)

- **E2.1 — AI report-card comments** · *P2, high demo value.* Teacher picks tone; auto-draft "Aarav has shown great improvement in reading…" from the marks. Big time-saver, sells itself.
- **E2.2 — Parent "Today" feed** · *P2.* One screen: attendance ✓, today's homework/diary, fee due, latest notice. Primary parents want one glance, not five tabs. Builds on [parent portal](../src/app/(parent)/parent/).
- **E2.3 — WhatsApp alerts** · *P1 once Part 6 lands.* Absence + fee-due over WhatsApp (email is ignored in this market). Seam already built.
- **E2.4 — Principal/owner weekly digest** · *P2.* Auto WhatsApp/PDF: collections, attendance %, defaulters — so the owner feels the product working without logging in.
- **E2.5 — Multi-language UI (i18n)** · *P2.* Regional-language parent portal widens the addressable market.

---

## Part 6 readiness (seams only)

> Carried over from the old QA plan. **No** Razorpay/Stripe/Twilio SDKs or credentials yet — each feature is a drop-in.

**Notifications (SMS / WhatsApp) — [src/lib/notifications/index.ts](../src/lib/notifications/index.ts):** channel-agnostic `notify({ channel, ... })` dispatcher + `NotificationChannelProvider` contract. `email` is wired (Resend); `sms`/`whatsapp` are not-configured placeholders. To add a provider: implement the contract, swap it into the `providers` map (no call sites change), and add a migration giving `notification_logs` a generic `recipient` column.

**Online payment gateway — [src/lib/payments/index.ts](../src/lib/payments/index.ts) + [webhook route](../src/app/api/payments/webhook/route.ts):** `PaymentProvider` contract (`createOrder`/`verifyWebhook`), minor-unit amounts, empty registry, `getActivePaymentProvider()`. Webhook returns **501** until a provider is registered and must verify the signature before trusting any amount. Schema is gateway-ready (`fee_payments.payment_mode='online'` + `reference_number`); a verified capture records via the service-role client scoped to the verified `school_id`.

**Mobile app / PWA:** fully deferred, no readiness work.

---

## Suggested order
1. **Tier 0** B0.1 (enforcement) → B0.2 (dead cron) → B0.4 (`/health` + Sentry) → B0.3 (timezone) → B0.5 (debt).
2. **Tier 1** F1.4 (self-serve onboarding) + F1.2 (homework) + F1.1 (timetable) → F1.3 (promotion).
3. **Tier 2** pick by demo impact (E2.1 / E2.2 / E2.3).

> Every change ships with: migration (if any), tests, and a `pnpm ai:sync-context` refresh per repo workflow.
