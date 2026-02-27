# Phase 1 — MVP

> **Duration:** 3 months  
> **Goal:** Onboard first 5 schools with core operations fully functional

---

## What Ships in Phase 1

| Module | Coverage |
|--------|----------|
| Auth & Role Routing | 100% |
| School Configuration | 100% |
| Student Management | 100% (bulk upload included) |
| Teacher Management | 100% |
| Attendance | 100% (daily, reports, export) |
| Fee & Billing (Basic) | 80% (collection, receipts, basic reports) |
| Dashboards | Basic stat cards for all roles |

---

## Detailed Task List

See [DEVELOPMENT_PLAN.md](../DEVELOPMENT_PLAN.md) Milestones 1.1–1.10 for the full week-by-week breakdown.

---

## Excluded from Phase 1 (Deferred to Phase 2)

- Examination module
- Inventory & bookstore
- Parent portal (only basic access; no polished portal)
- Email notifications
- Advanced analytics / charts
- Late fee automation
- Discount approval workflow
- PDF report cards
- PWA features

---

## Exit Criteria

Before Phase 2 begins, ALL of the following must be true:

- [ ] 5 real schools are using the system for at least 2 weeks
- [ ] Zero P0 bugs open
- [ ] All P1 bugs either fixed or accepted as known issues
- [ ] Test coverage ≥ 80% for all Phase 1 modules
- [ ] RLS audit passed: cross-school isolation verified
- [ ] Performance: LCP < 2.5s, TTFB < 500ms on deployed environment
- [ ] E2E critical path tests all passing

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Schools onboarded | 5 |
| Teachers using system | 20+ |
| Students in system | 500+ |
| Fee collections via POS | 100+ |
| Critical bugs reported by users | < 5 |
| User satisfaction (informal) | Positive feedback from admins |
