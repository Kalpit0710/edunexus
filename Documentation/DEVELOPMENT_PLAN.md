# EduNexus — Development Plan

> **Version:** 1.0.0  
> **Last Updated:** 2026-02-27  
> **Methodology:** Phased iterative development with mandatory testing gates  
> **Audience:** Developers, Project Managers, AI Assistants

---

## Table of Contents

1. [Development Principles](#development-principles)
2. [Definition of Done](#definition-of-done)
3. [Branch Strategy](#branch-strategy)
4. [Phase 1 — MVP (Months 1–3)](#phase-1--mvp-months-13)
5. [Phase 2 — Advanced Academic + POS (Months 4–5)](#phase-2--advanced-academic--pos-months-45)
6. [Phase 3 — Scalability & Smart Features (Months 6–7)](#phase-3--scalability--smart-features-months-67)
7. [Phase 4 — Mobile Expansion (Future)](#phase-4--mobile-expansion-future)
8. [Sprint Structure](#sprint-structure)
9. [Testing Gates](#testing-gates)
10. [Milestone Checklist](#milestone-checklist)
11. [Risk Register](#risk-register)

---

## Development Principles

1. **No phase starts until the previous phase passes all testing gates**
2. **Each feature ships with tests** — unit tests, integration tests minimum
3. **Database migrations are immutable** — never edit a deployed migration, write a new one
4. **Every PR requires a human review** before merge to `main`
5. **Security-first** — RLS policies written and tested before feature is considered complete
6. **Mobile-ready thinking** — all API design anticipates future React Native consumption

---

## Definition of Done

A task/feature is **Done** when it meets ALL of the following:

- [ ] Code is written and reviewed
- [ ] Unit tests pass (coverage ≥ 80% for new code)
- [ ] Integration tests pass
- [ ] RLS policies written and tested
- [ ] TypeScript errors: 0
- [ ] ESLint errors: 0
- [ ] UI is responsive (mobile + desktop)
- [ ] Loading states implemented
- [ ] Error states implemented
- [ ] Empty states implemented
- [ ] Accessibility: basic ARIA labels, keyboard navigation
- [ ] Documentation updated (inline comments + relevant doc file)
- [ ] Merged to `main` via PR

---

## Branch Strategy

```
main                    ← production-ready, protected
  └── develop           ← integration branch
        └── feature/phase1-student-management
        └── feature/phase1-fee-module
        └── fix/attendance-date-bug
        └── chore/update-dependencies
```

| Branch Prefix | Usage |
|---------------|-------|
| `feature/` | New features |
| `fix/` | Bug fixes |
| `chore/` | Maintenance, deps, config |
| `db/` | Database migrations only |
| `docs/` | Documentation updates |

---

## Phase 1 — MVP (Months 1–3)

### Goal
Onboard first 5 real schools with core operations fully functional.

### Milestone 1.1 — Project Setup (Week 1)

| Task | Description | Priority |
|------|-------------|----------|
| Repo setup | Initialize Next.js 14, Supabase CLI, Git, pnpm | P0 |
| Folder structure | Create `src/app/`, `src/components/`, `supabase/` as per ARCHITECTURE.md | P0 |
| Environment config | `.env.example`, Supabase project creation | P0 |
| CI/CD pipeline | GitHub Actions: lint → test → build → deploy to Vercel | P0 |
| Linting setup | ESLint, Prettier, TypeScript strict mode | P0 |
| Design system | Install Tailwind, shadcn/ui, configure theme tokens with modern soft UI aesthetics | P0 |
| Animation setup | Install `framer-motion`, configure page transitions and micro-interactions | P0 |
| Testing setup | Vitest, Playwright, Supabase local | P0 |
| Testing setup | Vitest, Playwright, Supabase local | P0 |

**Acceptance Criteria:**
- `pnpm dev` starts without errors
- `pnpm test` runs Vitest suite
- `supabase start` starts local DB
- GitHub Actions pipeline runs on every PR

---

### Milestone 1.2 — Database Foundation (Week 2)

| Task | Description | Priority |
|------|-------------|----------|
| Core migrations | `schools`, `users`, `classes`, `sections` | P0 |
| Auth setup | Supabase Auth, JWT hook, role injection | P0 |
| RLS policies | Base policies for all Phase 1 tables | P0 |
| Seed data | Dev seed: 1 school, users for all roles | P0 |
| TypeScript types | Generate types from Supabase schema | P0 |

**Acceptance Criteria:**
- All migrations run without error on fresh DB
- RLS: School A cannot read School B data (tested via SQL)
- Type generation: `supabase gen types` produces valid TypeScript

---

### Milestone 1.3 — Authentication & Role Routing (Week 2–3)

| Task | Description | Priority |
|------|-------------|----------|
| Login page | Email/password + Google OAuth | P0 |
| JWT + role routing | Middleware reads role → redirects to correct panel | P0 |
| Password reset | Supabase email-based reset | P0 |
| Session management | Auto-refresh, timeout handling | P0 |
| Auth store | Zustand store for auth state | P0 |
| Protected routes | Middleware protection for all role panels | P0 |

**Acceptance Criteria:**
- School Admin logging in goes to `/school-admin/dashboard`
- Teacher logging in goes to `/teacher/dashboard`
- Parent logging in goes to `/parent/dashboard`
- Unauthenticated access → redirect to `/login`
- Cross-role URL access → forbidden/redirect

---

### Milestone 1.4 — School Configuration (Week 3)

| Task | Description | Priority |
|------|-------------|----------|
| School settings page | Name, logo, theme, academic year | P0 |
| Class management | CRUD for classes and sections | P0 |
| Subjects setup | Add/edit/delete subjects per class | P0 |
| Grading rules | Configure grade thresholds | P1 |
| Guided setup wizard | Step-by-step onboarding for new schools | P1 |

**Tests Required:**
- School config saves and persists correctly
- Logo upload works, URL stored in DB
- Class/section CRUD with duplicate name handling

---

### Milestone 1.5 — Student Management (Week 4)

| Task | Description | Priority |
|------|-------------|----------|
| Student list view | DataTable with search, filter, pagination | P0 |
| Add student form | 4-step wizard: Info → Parent → Fee Plan → Review | P0 |
| Edit student | Full edit form | P0 |
| Soft delete | Mark deleted, not hard delete | P0 |
| Student profile page | View all student details | P0 |
| Excel bulk upload | Parse, validate, insert students from `.xlsx` | P1 |
| Export to Excel | Download filtered student list | P1 |
| Student ID generation | Auto-generate admission numbers | P0 |
| Photo upload | Supabase Storage integration | P1 |

**Tests Required:**
- Add student end-to-end (form → DB → UI)
- Bulk upload: valid file, file with errors, duplicate handling
- RLS: manager from School A cannot see School B students

---

### Milestone 1.6 — Teacher Management (Week 5)

| Task | Description | Priority |
|------|-------------|----------|
| Teacher list | DataTable with filters | P0 |
| Add/edit teacher | Form with auth user creation | P0 |
| Assign to classes | Many-to-many assignment UI | P0 |
| Teacher profile | View assignments, stats | P0 |
| Activate/deactivate | Toggle access | P0 |

---

### Milestone 1.7 — Attendance Module (Week 6)

| Task | Description | Priority |
|------|-------------|----------|
| Daily attendance UI | Class/section/date picker → student list → mark | P0 |
| Bulk mark present | "Mark all present" with individual overrides | P0 |
| Edit attendance | Change previous day's records | P0 |
| Attendance report | Monthly summary per student | P0 |
| Class attendance view | Date-wise overview for a section | P0 |
| Excel bulk import | Import attendance from Excel | P1 |
| Excel export | Export attendance report | P1 |

---

### Milestone 1.8 — Fee Module Basic (Week 7–8)

| Task | Description | Priority |
|------|-------------|----------|
| Fee structure setup | Create fee heads per class, frequency | P0 |
| Installment generation | Auto-generate installments on student enrollment | P0 |
| POS fee collection | Student search → fee breakdown → collect | P0 |
| Receipt generation | Edge Function → PDF → Supabase Storage | P0 |
| Payment history | View all payments per student | P0 |
| Daily collection report | Manager's daily summary | P0 |
| Pending fees view | List students with outstanding fees | P0 |
| Discount handling | UI to apply discounts | P1 |
| Partial payment | Collect less than full amount | P1 |

---

### Milestone 1.9 — Role Dashboards (Week 9)

| Role | Dashboard Components |
|------|---------------------|
| School Admin | Total students, total collection, pending fees, attendance %, announcements |
| Teacher | Today's classes, pending attendance, pending marks, class performance |
| Manager | Daily collection, pending fees, inventory sales, transaction log |
| Parent | Child info, attendance %, recent marks, pending fee alert |

---

### Milestone 1.10 — Phase 1 Testing & Stabilization (Week 10–12)

| Task | Description |
|------|-------------|
| Full E2E test suite | Playwright: critical user journeys |
| Performance audit | Lighthouse, query timing |
| Security audit | RLS verification, auth bypass attempts |
| UAT with test school | Real school admin + teacher test |
| Bug fixing sprint | Address all P0/P1 bugs from UAT |
| Documentation review | Update all docs for phase changes |

**Phase 1 Exit Criteria:**
- [ ] 5 schools successfully onboarded
- [ ] All P0 features complete and tested
- [ ] Zero known P0/P1 bugs
- [ ] E2E tests: all passing
- [ ] Performance: page load < 2s on 4G

---

## Phase 2 — Advanced Academic + POS (Months 4–5)

### Goal
Fully operational ERP with exam management, POS, analytics, and parent portal.

### Milestone 2.1 — Examination Module (Week 13–14)

| Task | Description | Priority |
|------|-------------|----------|
| Create exam | Name, class, subjects, dates | P0 |
| Marks entry | Grid: students × subjects with validation | P0 |
| Bulk marks upload | Excel template → validate → insert | P1 |
| Grade calculation | Auto-compute grade per grading rules | P0 |
| Result publishing | Admin publishes; parents notified | P0 |
| Result locking | Lock after publish; no edits without unlock | P0 |
| Report card PDF | Beautiful PDF with school branding | P0 |
| Class performance report | Subject-wise analysis, toppers | P1 |
| Topper list | Rank students by total marks | P1 |

---

### Milestone 2.2 — Bookstore & Inventory POS (Week 15–16)

| Task | Description | Priority |
|------|-------------|----------|
| Inventory management | CRUD items (books, uniforms, stationery) | P0 |
| Stock management | Add stock, adjust stock levels | P0 |
| Low stock alerts | Dashboard alerts + email | P0 |
| POS billing | Search item → cart → checkout → bill | P0 |
| Student-linked purchase | Link sale to student | P1 |
| Bill PDF generation | Receipt with school header | P0 |
| Inventory report | Stock value, low-stock, sales summary | P1 |

---

### Milestone 2.3 — Email Notifications (Week 17)

| Task | Description |
|------|-------------|
| Resend integration | Configure API key, send-email Edge Function |
| Attendance alerts | Daily absent notification to parents |
| Fee reminders | Configurable pre-due and overdue reminders |
| Exam notifications | Exam scheduled, results published |
| Receipt emails | Send receipt PDF on payment |

---

### Milestone 2.4 — Parent Portal (Week 17–18)

| Task | Description | Priority |
|------|-------------|----------|
| Parent login | Existing auth, parent role routing | P0 |
| Child info page | Basic student details | P0 |
| Attendance view | Calendar + monthly summary | P0 |
| Results view | Exam-wise marks, grades, report download | P0 |
| Fee status | Pending installments, payment history, receipt download | P0 |
| Announcements | School/class announcements | P0 |
| Timetable view | Class timetable (if configured) | P1 |
| Fee restriction | Optional: lock results if fee unpaid | P1 |

---

### Milestone 2.5 — Advanced Analytics (Week 18–19)

| Dashboard | New Metrics |
|-----------|------------|
| School Admin | Year-on-year collection trend, exam performance trend |
| Teacher | Per-student performance progression, class comparison |
| Manager | Monthly/quarterly revenue chart, collection by mode |

---

### Milestone 2.6 — Phase 2 Testing & Stabilization (Week 19–20)

- Full regression test of Phase 1 features
- E2E tests for all Phase 2 flows
- PDF generation quality check
- Email delivery testing
- Parent portal UAT

---

## Phase 3 — Scalability & Smart Features (Months 6–7)

### Milestone 3.1 — Performance & Scalability

| Task | Description |
|------|-------------|
| Materialized views | Fee summary, attendance summary, performance summary |
| Read replica setup | Supabase Pro: enable read replica |
| Redis caching | Cache school config, class lists (Upstash) |
| Pagination everywhere | Ensure all lists are paginated (no full-table fetches) |
| Background jobs | Queue for PDF generation, bulk operations |

### Milestone 3.2 — PWA Support

| Task | Description |
|------|-------------|
| Service Worker | Offline fallback, asset caching |
| Web App Manifest | Add to home screen support |
| Push notifications (web) | Attendance alerts, fee reminders |
| Offline attendance | Mark attendance offline, sync when online |

### Milestone 3.3 — AI-Assisted Insights

| Feature | Description |
|---------|-------------|
| Fee default prediction | Flag students likely to default (historical pattern) |
| Attendance trend alerts | Detect students with declining attendance |
| Performance trend | Identify underperforming students early |
| Automated fee reminders | Smart timing based on parent payment patterns |

### Milestone 3.4 — Advanced Audit System

| Feature | Description |
|---------|-------------|
| Audit log viewer | Full table with filters, search, export |
| Change history | Per-record change timeline |
| Super Admin audit | Cross-school activity monitoring |

### Milestone 3.5 — Phase 3 Testing

- Load testing: 500 concurrent users
- PWA functionality on iOS + Android
- AI feature accuracy validation
- Security penetration testing

---

## Phase 4 — Mobile Expansion (Future)

### Prerequisites
- Phase 3 complete and stable
- 20+ active schools

### Milestones

| Feature | Description |
|---------|-------------|
| React Native App | Parent-first mobile app |
| Teacher mobile | Attendance, marks, announcements |
| Push notifications | Native push (Expo) |
| Biometric attendance | Fingerprint/face ID integration (optional) |
| Offline-first | Full offline support with sync |

**Architecture note:** Backend stays exactly the same — React Native uses the same Supabase APIs. No backend rewrite needed.

---

## Sprint Structure

Each sprint is **2 weeks**:

| Day | Activity |
|-----|----------|
| Mon Week 1 | Sprint planning, task assignment |
| Tue–Thu | Development |
| Fri | Code review + PR merges |
| Mon Week 2 | Development continues |
| Tue–Wed | Integration testing |
| Thu | Bug fixes |
| Fri | Sprint review + retrospective |

---

## Testing Gates

Before advancing to the next phase, ALL of the following must pass:

| Gate | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|
| Unit test coverage ≥ 80% | ✅ | ✅ | ✅ |
| Integration tests: all pass | ✅ | ✅ | ✅ |
| E2E: critical paths pass | ✅ | ✅ | ✅ |
| RLS security audit | ✅ | ✅ | ✅ |
| Performance: LCP < 2.5s | ✅ | ✅ | ✅ |
| Zero P0 bugs | ✅ | ✅ | ✅ |
| UAT sign-off | ✅ | ✅ | ✅ |

---

## Risk Register

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Supabase RLS complexity | High | Medium | Dedicated RLS test suite early |
| PDF generation performance | Medium | Medium | Async generation + caching |
| Excel import data quality | Medium | High | Strict validation + error download |
| Parent adoption | Medium | Medium | Simple UI, guided onboarding |
| Scope creep per school | High | High | Freeze Phase 1 scope, log requests for Phase 2 |
| Multi-timezone support | Low | Low | Store all times in UTC, display in school timezone |
| SMTP deliverability | Medium | Low | Use Resend (high deliverability) + test before go-live |
