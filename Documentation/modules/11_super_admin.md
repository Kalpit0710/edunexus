# Module 11 — Super Admin (Platform Administration)

> **Phase:** Phase 1 (MVP) + Phase 2/3 (advanced) | **Priority:** P0
> **Audience:** EduNexus platform owner (`super_admin` role)
> **Spec status:** Spec-driven. Checked items are implemented; unchecked items are planned/pending.

## Overview

The Super Admin is the EduNexus platform owner. Unlike a School Admin (scoped to one
tenant), the Super Admin operates **across all schools (tenants)**: onboarding new
schools, managing their subscriptions, monitoring platform-wide health, and — in later
phases — auditing activity and impersonating school admins for support.

Super Admin users have `role = 'super_admin'` and `school_id = NULL` (enforced by the
`school_required_for_non_super_admin` CHECK constraint on `user_profiles`).

## Access & Security

- Route group `(super-admin)` is gated to the `super_admin` role by `middleware.ts`.
- Every server action additionally re-verifies the caller is a `super_admin`
  (defense in depth) before using the service-role client for cross-tenant operations.
- RLS already provides `is_super_admin()`, `super_admin_all_schools`, and
  `super_admin_all_profiles` policies. Cross-tenant aggregation uses the service-role
  client guarded by the explicit role check.
- Never expose the service role key to the client. All privileged work happens in
  `'use server'` actions.

## Subscription Model

| Plan | Monthly price (INR) |
|------|---------------------|
| `basic` | ₹2,000 |
| `standard` | ₹5,000 |
| `premium` | ₹10,000 |

| Status | Meaning | Counts toward revenue? |
|--------|---------|------------------------|
| `active` | Paying subscriber | ✅ Yes |
| `trial` | In free trial (`trial_ends_at` set) | ❌ No |
| `suspended` | Disabled by platform / non-payment | ❌ No |

**Platform monthly revenue** = sum of plan price for all schools whose
`subscription_status = 'active'`.

`schools.is_active` is the hard on/off switch (a suspended school's users cannot
operate); `subscription_status` is the billing state. Suspending a school sets
`subscription_status = 'suspended'` and `is_active = false`.

---

## Feature Checklist

### Milestone 1 — Crucial MVP

- [x] Subscription DB migration (`subscription_plan`, `subscription_status`, `trial_ends_at` on `schools`)
- [x] Super Admin layout with dedicated sidebar + auth hydration
- [x] Dashboard — platform stat cards (total / active / suspended / trial schools)
- [x] Dashboard — aggregate students & users across all schools
- [x] Dashboard — monthly recurring revenue (from active plans)
- [x] Dashboard — plan distribution breakdown
- [x] Dashboard — recent school sign-ups list
- [x] Schools — list with search, status & plan badges, skeleton loaders
- [x] Schools — create new school (details + subscription)
- [x] Schools — provision the first School Admin login during school creation
- [x] Schools — view & edit school details and subscription
- [x] Schools — suspend / reactivate a school
- [x] Server actions guarded by explicit `super_admin` verification
- [x] Empty / loading / error states for all data views

### Milestone 2 — Operations & Visibility (Pending)

- [x] Global users directory (all admins/staff across every school)
- [x] Reset credentials for any user (set new temporary password)
- [x] Deactivate / reactivate individual users platform-wide
- [x] CSV/Excel export of schools & revenue
- [x] Per-school drill-down (students, teachers, classes, collection, attendance, recent activity) on the school detail page
- [ ] Monthly revenue trend chart (recharts)
- [ ] School activity feed (recent logins, key events per school)

### Milestone 3 — Governance & Support (Pending)

- [x] `audit_logs` table + global audit log viewer with filters
- [x] Audit instrumentation of all super-admin write actions
- [ ] Cross-school failed-login / security alerting (≥10 failures, per SECURITY.md)
- [x] Impersonation / "view as school admin" with audit trail
- [ ] Subscription invoices & billing history
- [x] Plan price configuration UI (instead of code constants)
- [x] Plan-based feature entitlements (basic/standard/premium gate which modules a school can access)
- [ ] Scheduled platform summary email to the owner

---

## Data Model Additions (Milestone 1)

```sql
ALTER TABLE schools
  ADD COLUMN subscription_plan   TEXT NOT NULL DEFAULT 'basic',
  ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN trial_ends_at       TIMESTAMPTZ;

-- allowed values enforced via CHECK constraints
-- subscription_plan   ∈ {basic, standard, premium}
-- subscription_status ∈ {active, trial, suspended}
```

## Routes

| Route | Purpose |
|-------|---------|
| `/super-admin/dashboard` | Platform overview & KPIs |
| `/super-admin/schools` | All schools list |
| `/super-admin/schools/new` | Onboard a new school + first admin |
| `/super-admin/schools/[id]` | View / edit / suspend a school |
| `/super-admin/users` | Global users directory (manage/reset/deactivate) |
| `/super-admin/audit` | Global audit log viewer |
| `/super-admin/schools/[id]` | View / edit / suspend + per-school operational drill-down |

## Pending routes (future milestones)

| Route | Purpose |
|-------|---------|
| `/super-admin/schools/[id]/impersonate` | View-as school admin (pending) |

## Mermaid Visual Summary

`mermaid
flowchart LR
  Discovery --> Planning --> Build --> Validate --> Release
`
