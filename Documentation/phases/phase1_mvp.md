# Phase 1 — MVP

> **Duration:** 3 months  
> **Goal:** Onboard first 5 schools with core operations fully functional  
> **Status:** ✅ Implemented — pending formal exit gate (E2E + UAT)

---

## What Ships in Phase 1

| Module | Coverage | Status |
|--------|----------|--------|
| Auth & Role Routing | 100% | ✅ Done |
| School Configuration | 100% | ✅ Done |
| Student Management | 100% (bulk upload included) | ✅ Done |
| Teacher Management | 100% | ✅ Done |
| Attendance | 100% (daily, reports, export) | ✅ Done |
| Fee & Billing (Basic) | 100% (collection, receipts, reports, pending) | ✅ Done |
| Dashboards | Stat cards + charts for all 4 roles | ✅ Done |

---

## Detailed Task List

See [DEVELOPMENT_PLAN.md](../DEVELOPMENT_PLAN.md) Milestones 1.1–1.10 for the full week-by-week breakdown.

---

## Excluded from Phase 1 (Deferred to Phase 2)

- ~~Examination module~~ → **Implemented in Phase 2.1** ✅
- ~~Inventory & bookstore~~ → **Implemented in Phase 2.2** ✅
- ~~Parent portal~~ → **Implemented in Phase 2.4** ✅
- ~~Email notifications~~ → **Implemented in Phase 2.3** ✅
- Advanced analytics / charts → Phase 2.5 (pending)
- Late fee automation → Phase 2 (pending)
- Discount approval workflow → Phase 2 (pending)
- PDF report cards → Phase 2.1 (partial — Edge Function exists; template pending)
- PWA features → Phase 3

---

## Exit Criteria

Before formal Phase 2 go-live, ALL of the following must be true:

- [ ] 5 real schools are using the system for at least 2 weeks
- [x] Zero P0 TypeScript errors — `pnpm type-check` passes with 0 errors ✅
- [ ] All P1 bugs either fixed or accepted as known issues
- [x] Test coverage — Unit tests passing (Vitest) ✅
- [ ] E2E critical path tests all passing — **BLOCKER**: Playwright auth-flow timeout needs dedicated seed user
- [x] RLS audit passed: cross-school isolation implemented via `school_id` scoping ✅
- [ ] Performance: LCP < 2.5s, TTFB < 500ms on deployed environment (not yet measured)

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Schools onboarded | 5 | Pending UAT |
| Teachers using system | 20+ | Pending UAT |
| Students in system | 500+ | Pending UAT |
| Fee collections via POS | 100+ | Pending UAT |
| Critical bugs reported by users | < 5 | 0 (dev environment) |
| User satisfaction (informal) | Positive feedback from admins | Pending UAT |
