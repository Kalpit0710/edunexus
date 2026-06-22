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
| 2.1 Examination Module | ♻️ Replaced by Report Cards | The legacy exam/marks module was removed and rebuilt as the CBSE-style **Report Card module** (see 2026-06-22 changelog) — `report_subject_configs` / `report_scholastic_marks` / `report_co_scholastic_marks` / `report_student_meta` / `report_publications`, term-based scholastic + co-scholastic entry, publish/lock, A4 print route, parent + teacher access |
| 2.2 Inventory & POS | ✅ Completed (Backend + UI) | Inventory CRUD, stock adjust, POS billing, low-stock alerts, receipt emails; E2E coverage for list/add/stock/POS/reports |
| 2.3 Email Notifications | ✅ Completed | Resend integration, fee receipt email, inventory receipt email, exam publish notification |
| 2.4 Parent Portal | ✅ Completed | Dashboard, attendance calendar, exam results (fee-locked), fee status, announcements; E2E coverage across all 5 views with RLS-scoped child data |
| 2.5 Advanced Analytics | ✅ Completed | School-admin, parent, and manager analytics (fee momentum, exam trends, attendance/performance trends, manager drilldowns); reports E2E coverage |
| 2.6 Phase 2 Testing | ✅ Completed | Full chromium E2E suite green (auth + students + attendance + fees + exams + inventory + parent + reports); parent role added to E2E seed/auth setup |

---

## Completed Tasks

### 2026-06-22 — CBSE Report Card module (replaces the exam/marks module)
- Status: ✅ Completed. Ported the report-card model from the reference SRMS project and rebuilt EduNexus's assessment feature around it. The legacy `exams` / `exam_subjects` / `marks` tables, their RPCs, and the whole `school-admin/exams` UI + `src/lib/exam-utils.ts` were **removed**; `grading_rules` is retained and reused as the grade scale.
- **Migration `20260622000002_report_cards.sql`** (applied to remote, HTTP 201): drops the exam tables/RPCs and `exam_status` enum; adds enum `report_status`; `ALTER classes ADD report_card_type TEXT DEFAULT 'standard'`; new tables `report_subject_configs`, `report_scholastic_marks`, `report_co_scholastic_marks`, `report_student_meta`, `report_publications` + RPCs `publish_class_report` / `unlock_class_report`. RLS: super all; staff read; staff (admin/manager/teacher) write marks; admin/manager configure subjects + publish/unlock; parents read only published/locked, fee-cleared report cards.
- **`src/lib/report-card-utils.ts`** (+ 14 unit tests): two report tiers — **standard** (term1 = periodic test 10 / notebook 5 / subject enrichment 5 / half-yearly 80, term2 = …/yearly 80, grand = T1÷2 + T2÷2) and **lower** (free-form components, grand = T1 + T2). Pure helpers `calcStandardSubjectResult` / `calcLowerSubjectResult` / `calcOverallResult` / `resolveGrade` (via per-school `grading_rules`) / `sumComponents` / `validateComponentMark` / `parseMarkInput`. Co-scholastic = 3 areas graded A–E; analytics pass threshold 33%.
- **School-admin** `school-admin/report-cards`: class/section selector + 3 tabs — Students (ranking with Marks + Print links), Subjects (per-subject max-marks / component config), Publish (publish + unlock per class). Shared **`StudentMarksEditor`** (`src/components/modules/report-cards/`) drives term-based scholastic + co-scholastic + attendance/remarks entry at `…/report-cards/[studentId]/marks`.
- **Teacher** `teacher/report-cards`: read class ranking + enter marks (reuses `StudentMarksEditor`); cannot configure subjects or publish.
- **Parent** `parent/results`: fee-locked, read-only published report card (scholastic + co-scholastic + attendance) with a Print link.
- **Print**: A4 `report-card/[studentId]/print` route (browser print-to-PDF, no edge function), mirroring the transfer-certificate route; authorized for staff + eligible parents. The print layout is a faithful port of the reference SRMS templates (`reportCard.ejs` / `reportCardLowerClass.ejs`) — navy/gold standard tier + maroon lower tier, "Progress Report" letterhead, multi-row scholastic header (SUBJECT | TERM-1/TERM-2 component columns + Overall Assessment | Grade) with an italic max-marks row and a TOTAL row, summary bar, 3-point co-scholastic table, attendance/remark/result block, signatures, and the 8-point CBSE grade-scale legend.
- **Reports analytics** (`school-admin/reports/actions.ts`): `getExamAnalyticsSummary` rewritten to compute pass-rate / subject-difficulty / class-comparison from the report tables (same return shape).
- Tests: `pnpm type-check` → 0 errors; `pnpm lint` → exit 0 (warnings only); full Vitest suite **281 passed** (RLS role test repointed from `exams` → `report_subject_configs`); `pnpm build` → compiled successfully (57/57 pages). Obsolete `tests/unit/exams/**` + `tests/e2e/exams.spec.ts` removed; `dev_seed.sql` exam seed dropped.

### 2026-06-22 — Tier 1 F1.1+: Timetable real-world enhancements
- Status: ✅ Completed (builds on the F1.1 timetable system below).
- What was done: made the timetable handle real-world multi-teacher / multi-class scheduling.
  - **Migration `20260622000001_timetable_enhancements.sql`** (applied to remote, HTTP 201): `schools.working_days SMALLINT[] NOT NULL DEFAULT '{1,2,3,4,5,6}'` with a `schools_working_days_valid` CHECK (non-empty, subset of ISO 1–7) + index `idx_entries_day_period (school_id, day_of_week, period_id)` for slot-occupancy lookups.
  - **`timetable-utils.ts`**: added `periodsOverlap` (time-range overlap; null-safe; touching edges are *not* overlap) and `normalizeWorkingDays` (dedupe/filter-to-1–7/sort, falls back to `DEFAULT_WORKING_DAYS`) + **8 new unit tests** (22 total in the file).
  - **Admin `actions.ts`**: setup now returns `workingDays` + `assignments` (from `teacher_section_assignments`); `createPeriod`/`updatePeriod` reject time-overlapping periods (`assertNoPeriodOverlap`); `upsertEntry` returns `{ conflictSections, roomConflictSections }` (teacher double-book **and** room double-book, both non-blocking warnings); new `getSlotOccupancy`, `setWorkingDays`, `copyDay`, `clearDay`, `duplicateSectionTimetable`.
  - **Admin `page.tsx`**: a **Working Days** editor (toggle Mon–Sun, persisted per school); the class grid only renders working columns; **smarter teacher dropdown** in the cell dialog — filtered to teachers assigned to that section (with a "Show all teachers" escape hatch), each option flagged `· busy` when already teaching that slot elsewhere, plus an inline amber warning; **room** field warns when the room is already booked that slot; in-grid amber **teacher-clash** highlighting; and a **DayActions** toolbar (Copy day, Clear day, Duplicate timetable to a sibling section of the same class).
  - **Teacher & Parent views**: `getMyTimetable` / `getChildTimetable` now read `schools.working_days` (via `normalizeWorkingDays`) so both grids show the school's real working week instead of a hardcoded Mon–Sat.
- Tests: `pnpm type-check` → 0 errors; `pnpm lint` → exit 0 (warnings only); timetable-utils suite → **22 passed**.
- Edge cases: double-booking a teacher **and** booking a busy room are warnings (admin can override for genuine shared/split classes); period time overlaps are hard-rejected; `copyDay`/`duplicateSectionTimetable` overwrite the target (delete-then-copy); duplicate is restricted to sections of the *same* class; working-day list is normalized + CHECK-guarded so it can never be empty or out of range; teacher/parent grids fall back to the default week when the column is unset.

### 2026-06-22 — Tier 2 E2.2 / E2.4: Parent "Today" feed & Principal weekly digest
- Status: ✅ Both done. (Owner descoped E2.1 AI report-card comments, the F1.6 ID-card generator, and E2.5 multi-language UI — not built.)
- **E2.2 Parent "Today" feed** — one-glance home for parents (no DB migration; pure aggregation of existing per-section queries).
  - New action `getParentTodayFeed(schoolId, childId)` in `parent/actions.ts`: today's attendance status (via `schoolToday()`), homework posted today + due-soon, fee balance/total, and the latest class-targeted announcement. Reuses `getChildHomework` / `getChildFeeStatus` / `getLatestAnnouncements`.
  - New `parent/today/page.tsx`: attendance status pill, fee-due alert, today's homework list (+ "Due Soon"), latest notice, and a link to the full analytics dashboard.
  - Nav: bottom-bar "Home" tab → **Today** (`/parent/today`); parent post-login route (`supabase/middleware.ts`) now lands on the Today feed. The analytics `/parent/dashboard` stays reachable (Today page link + direct URL — e2e unaffected).
- **E2.4 Principal/owner weekly digest** — last-7-days summary so the owner feels the product working.
  - Pure, unit-tested helpers `src/lib/digest-utils.ts` (`weeklyWindow`, `addDaysISO`, `summarizeCollections`, `percent`, `formatINR`, `topDefaulters`, `pickTodayHomework`, `pickUpcomingDue`) + **13 unit tests**.
  - `dashboard/digest-actions.ts`: `buildWeeklyDigest` (service-role client → works session-less) gathers collections (per-day + total), attendance %, active student/teacher counts, total pending + top-5 defaulters via the `get_pending_fees` RPC. `getWeeklyDigest` / `sendWeeklyDigestEmail` verify the caller is an active `school_admin` of the school; `dispatchAllWeeklyDigests` fans out to every active, non-suspended school's admins.
  - On-screen **Weekly Digest card** (`weekly-digest-card.tsx`) on the admin dashboard (stat tiles + defaulter list + "Email me" button) and a `WeeklyDigestEmail` React Email template sent through the `notify()` email channel (`event: 'weekly_digest'`).
  - Scheduler-ready `/api/cron/weekly-digest` route — disabled (503) unless `CRON_SECRET` is set, then requires `Authorization: Bearer <CRON_SECRET>`. Allow-listed in middleware.
- Tests: `pnpm type-check` → 0 errors; `pnpm lint` → 0 errors (warnings only); full suite → **274 passed** (261 prior + 13); `pnpm build` → success, `/parent/today` + `/api/cron/weekly-digest` emitted.
- Edge cases: today feed fails closed to "No Student Linked" when child isn't linked; attendance with no record shows "Not marked yet"; digest divide-by-zero guarded; defaulter list de-mutated; cron can never run unauthenticated; digest builder bypasses RLS deliberately (service role) but every UI entry point re-verifies the caller's school + role. WhatsApp/PDF digest delivery deferred to Part 6 (seam ready).

### 2026-06-19 — Tier 1 F1.8 / F1.9: Library lending & Transport
- Status: ✅ Both done.
- **Migration `20260619000005_library_transport.sql`** (applied to remote + types regenerated):
  - **F1.8** — `library_books` (copies_total/available with `CHECK available<=total`) + `book_loans` (issued|returned|lost, due/returned dates, fine, partial-unique index preventing duplicate outstanding loan of a title per student). Atomic RPCs `issue_book` (validates availability, decrements) and `return_book` (restores availability, or drops a copy from total when lost). RLS: super all; member read (catalogue); admin/manager manage; parent reads own child's loans.
  - **F1.9** — `buses` (driver name/phone/licence, attendant, registration, model, capacity, route), `bus_stops` (pickup/drop times, order), `student_transport` (one bus per student via `UNIQUE(school_id, student_id)`). Atomic RPC `assign_student_transport` (capacity check, stop-belongs-to-bus validation, upsert-on-student). RLS: super all; member read (buses/stops so parents see driver details); admin/manager manage; parent reads own child's assignment.
- **F1.8 UI** `school-admin/library/` (gated `inventory`): **Loans** tab (issue, return-with-fine/lost, overdue highlight, closed-loans toggle) + **Catalogue** tab (search, CRUD with on-loan-aware copy adjustment, delete blocked while copies are out).
- **F1.9 UI** `school-admin/transport/` (gated `students`): **Buses & routes** tab (CRUD with full driver/attendant details, per-bus stops manager, seat-occupancy badge, delete blocked while students assigned, capacity can't drop below seated) + **Assignments** tab (assign with live seats-left, stop filtered to bus, pickup point + monthly fee, unassign). Parent `getChildTransport` + `parent/transport/page.tsx` (bus, tappable driver phone, attendant, stop/pickup time, fee) + dashboard quick-link.
- **Nav**: admin sidebar gains Library (`BookMarked`) and Transport (`Bus`); parent dashboard gains Transport quick-link (alongside Calendar from F1.5).
- Tests: `pnpm type-check` → 0 errors; `pnpm lint` → 0 errors; full suite → **261 passed**; `pnpm build` → success, `/school-admin/library` + `/school-admin/transport` + `/parent/transport` emitted.
- Edge cases: book availability + duplicate-loan guarded in the RPC under `FOR UPDATE`; lost books decrement total (not available); fine entry on return with overdue-day hint; bus capacity enforced at assignment time (race-safe count under lock) and on capacity edits; stop must belong to its bus; one bus per student (re-assign upserts); bus/book deletes blocked while in use; parents see only their own child's transport/loans.

### 2026-06-19 — Tier 1 F1.5 / F1.6(TC) / F1.7: Calendar, Transfer Certificate, Health records
- Status: ✅ F1.5 done, ✅ F1.7 done, 🟡 F1.6 transfer-certificate done (ID-card deferred).
- **Migration `20260619000004_calendar_tc_health.sql`** (applied to remote + types regenerated):
  - **F1.7** — added student health columns: `allergies`, `medical_conditions`, `medications`, `emergency_contact_name`, `emergency_contact_phone`, `doctor_name`, `doctor_phone` (the profile UI previously referenced `medical_conditions` which never existed in the DB).
  - **F1.5** — `holidays` table (`title`, `category` holiday|event|exam|break, `start_date`, nullable `end_date`, `description`, soft-delete, `CHECK end>=start`). RLS: super all; member read (`school_id = get_my_school_id()` — admins, teachers, parents); admin/manager manage.
  - **F1.6** — `transfer_certificates` table (per-school `serial_no` + `tc_number`, issue/leaving dates, reason/conduct/remarks, immutable student snapshots) + `issue_transfer_certificate(...)` `SECURITY DEFINER` RPC that allocates the next serial atomically, snapshots the student, and optionally marks them inactive. RLS: super all; admin/manager manage.
- **F1.7 wiring**: extended `normalizeStudentWritePayload` to persist the new columns; added a **Health & Safety** card to the student edit form and a richer **Health & Medical** panel (allergies highlighted, medications, emergency contact, doctor) on the student profile.
- **F1.5 wiring**: `school-admin/calendar/` (feature-gated `attendance`) — CRUD list split into Upcoming/Past with category badges; `calendar-utils.ts` (`formatDateRange`, `isDateInRange`, category label/colors) + **6 unit tests**. Parent `getSchoolCalendar` + `parent/calendar/page.tsx`. Nav: admin sidebar (`CalendarDays`) + parent dashboard quick-link.
- **F1.6 wiring**: `students/tc-actions.ts` (`issueTransferCertificate` via RPC, `getStudentTransferCertificates`, `getTransferCertificate`). Student profile gets an **Issue TC** button → dialog (issue/leaving date, reason, conduct, remarks, “mark inactive”) → opens a clean printable certificate at `/transfer-certificate/[tcId]/print` (school letterhead, details table, signatures, browser print-to-PDF — no edge-function deploy needed). A **Documents** card lists issued TCs with reprint links.
- Tests: `pnpm type-check` → 0 errors; `pnpm lint` → 0 errors; full suite → **261 passed** (255 prior + 6); `pnpm build` → success, `/school-admin/calendar` + `/parent/calendar` + `/transfer-certificate/[tcId]/print` emitted.
- Edge cases: TC numbering is race-safe (RPC `MAX(serial_no)+1` under per-school `UNIQUE`); TC snapshots student data so edits don't mutate issued certificates; print route auth-gated (RLS returns null → “not authorized”); calendar end-date validated `>= start`; member-read RLS lets parents/teachers see the calendar but only admins manage; ID-card generation intentionally deferred.

### 2026-06-19 — Tier 1 F1.1: Timetable / class schedule
- Status: ✅ Completed
- What was done: full timetable system with role-specific views.
  - **Migration `20260619000003_timetable.sql`** (applied to remote + types regenerated): `timetable_periods` (school-wide time slots — name, start/end time, display order, `is_break`) and `timetable_entries` (per `section_id` × `day_of_week` 1–7 ISO × `period_id`: nullable `subject_id`/`teacher_id` + `room`, `UNIQUE(school_id, section_id, day_of_week, period_id)`). Subject/teacher FKs `ON DELETE SET NULL`, period FK `ON DELETE CASCADE`. RLS: super all; admin/manager manage (`is_admin_or_manager()`); teacher read (role-scoped); parent read (periods via `parents` school match, entries via `parents⋈students` section match).
  - **Pure helpers** `src/lib/timetable-utils.ts` (`WEEKDAYS`, `DEFAULT_WORKING_DAYS` Mon–Sat, `formatTime`/`formatPeriodRange` 12h, `validatePeriodTimes`, `detectTeacherConflicts`) + **14 unit tests** covering time formatting edge cases, validation, and double-booking detection (free/break/same-section de-dup).
  - **School admin** `timetable/` (feature-gated behind `teachers`): tabbed editor — **Periods** (CRUD time slots, break toggle, delete cascades with confirm), **Class timetable** (class→section picker, periods×weekday grid; each cell opens a dialog to set subject/teacher/room or clear; empty = delete; live teacher double-booking warning on save), **Teacher view** (read a teacher's week). A school-wide conflict banner lists every double-booked (teacher, day, period).
  - **Teacher** `teacher/timetable/` — read-only “My Timetable” grid (entries where teacher = me; resolves teacher via profile/email fallback).
  - **Parent** `getChildTimetable` (admin client, parent⇔child verification) + `parent/timetable/page.tsx` — mobile day-picker (defaults to today) listing the child's section schedule with subject/teacher/room.
  - **Nav**: Timetable added to admin sidebar (`CalendarRange`, gated `teachers`), teacher sidebar, and parent bottom bar (now `grid-cols-7`).
- Tests: `pnpm type-check` → 0 errors; `pnpm lint` → 0 errors (warnings only); full suite → **255 passed** (241 prior + 14); `pnpm build` → success, `/school-admin/timetable` + `/teacher/timetable` + `/parent/timetable` emitted.
- Edge cases handled: no periods / no classes / no sections / unlinked teacher / no active child / break (non-teaching) periods skip subject+teacher / single-sided or inverted period times rejected / teacher double-booking surfaced (non-blocking warning + admin report) / subject or teacher deletion nulls the slot rather than orphaning it / period deletion cascades its column. Default working week is Mon–Sat; per-school working-day config is a future enhancement.

### 2026-06-19 — Tier 1 F1.2: Homework / daily diary
- Status: ✅ Completed
- What was done: teachers post homework/diary entries; parents see them per child.
  - **Migration `20260619000002_homework.sql`** (applied to remote + types regenerated): `homework` table (`school_id`, `class_id` NOT NULL, `section_id` nullable = whole class, `subject_id` nullable = general diary, `title`, `description`, `homework_date` default today, `due_date`, `created_by`/`created_by_name` denormalized, soft-delete `deleted_at`). Indexes on `(school_id, class_id, section_id, homework_date DESC)` and author. RLS: super-admin all; `homework_staff_manage` (`FOR ALL` where school matches and role ∈ teacher/school_admin); `homework_parent_read` (`SELECT` via parents⋈students class/section match).
  - **Teacher** `teacher/homework/actions.ts` + `page.tsx`: `getTeacherHomeworkContext` resolves the teacher's section/subject assignments, lists own posts; `createHomework`/`updateHomework`/`deleteHomework` (soft-delete) with input validation, run through the **session client** so the staff RLS policy resolves. Form supports class-section, optional subject, title, description, homework date (defaults to `schoolToday()`), due date.
  - **Parent** `parent/actions.ts` `getChildHomework` (admin client, parent-portal pattern): verifies the parent↔child link, then returns the child's class homework with section scoping (`section_id` null or matching). New `parent/homework/page.tsx` lists entries with subject tag, dates, and author.
  - **Nav**: Homework added to the teacher sidebar (`BookText`) and the parent bottom bar (now `grid-cols-6`, "Homework" / `BookText`).
- Tests: `pnpm type-check` → 0 errors; `pnpm lint` → 0 errors; full suite → **241 passed**; `pnpm build` → success, `/teacher/homework` + `/parent/homework` emitted.
- Notes: parent reads go through the admin client with manual scoping (the `homework_parent_read` RLS policy is defense-in-depth). Section-null entries are treated as whole-class. Next Tier 1: F1.4 self-serve onboarding or F1.1 timetable.

### 2026-06-19 — Tier 1 F1.3: Year-end promotion & roll-over
- Status: ✅ Completed (first Tier 1 feature)
- What was done: bulk class promotion at year-end for school admins.
  - **Migration `20260619000001_promote_students.sql`** (applied to remote + types regenerated): `promote_students(p_school_id, p_target_year, p_mappings jsonb)` `SECURITY DEFINER` RPC with the standard `is_super_admin() OR get_my_school_id()` tenant guard. Promotions run as a **single `UPDATE … FROM` against the original class membership** so chained mappings (Class1→2, Class2→3) can never double-promote. Graduations (`to = null`) set `is_active = false`; promotions move `class_id` and clear `section_id`; the target academic year (optional) is rolled to current. Returns `{ promoted, graduated }`.
  - **Pure helper** `src/lib/promotion-utils.ts` (`computeDefaultPromotionMapping` = next class by `display_order`, top graduates; `validatePromotionMapping`) + **10 unit tests**.
  - **Server actions** `promotion/actions.ts`: `getPromotionData` (classes + active counts + academic years) and `promoteStudents` (typed-confirmation "PROMOTE", re-validates mapping, calls the RPC via the session client so the guard resolves, writes a `students.promoted` audit row).
  - **UI** `promotion/page.tsx`: per-class target dropdown (defaulted), academic-year roll-over selector, live promote/graduate totals, amber warning + typed "PROMOTE" confirmation. Added a **Promotion** sidebar item (gated behind the `students` feature).
- Tests: `pnpm type-check` → 0 errors; `pnpm lint` → 0 errors; full suite → **241 passed** (231 prior + 10); `pnpm build` → success, `/school-admin/promotion` emitted.
- Notes: students have no `status` column, so graduation = `is_active = false` (record retained, not deleted). **Fee carry-forward is intentionally out of scope for v1** — switching the academic year naturally drops prior-year dues from the current pending-fee view; auto-carry of opening balances is a future enhancement. Sections are cleared on promotion (admin re-assigns). Next Tier 1: F1.4 self-serve onboarding, F1.2 homework, or F1.1 timetable.

### 2026-06-19 — B0.4 observability completed: Sentry + Upstash rate limiting
- Status: ✅ Completed (Tier 0 now fully done, no remaining infra follow-ups)
- What was done:
  - **Sentry** (`@sentry/nextjs` v10): `sentry.client/server/edge.config.ts` + `src/instrumentation.ts` (`register` + `onRequestError`) + `src/app/global-error.tsx`; `withSentryConfig` wraps `next.config.ts`. Privacy-safe defaults (`sendDefaultPii: false`, no session replay, `enabled` only in production with a DSN). DSN/org/project live in gitignored `.env.local`; names documented in `.env.example`.
  - **Rate limiting** (`@upstash/ratelimit` + `@upstash/redis`): `src/lib/rate-limit.ts` sliding-window limiter that **fails open** when Upstash env is absent; wired into the public `parent-register` route (10 attempts/min/IP → 429). Login relies on Supabase's built-in auth rate limiting (no custom server route to gate).
  - Cleared Sentry build advisories: removed deprecated `disableLogger`, added the recommended `global-error.tsx`.
- Tests: `pnpm type-check` → 0 errors; `pnpm lint` → 0 errors; full suite → **231 passed**; `pnpm build` → success (only remaining advisory is the Next-15.3 `instrumentation-client.ts` rename, deferred — project is on 15.1.7 + webpack dev).
- Notes: `.env.local` now holds real secrets (Supabase, Sentry DSN, Upstash token) and is gitignored — not committed. Timezone confirmed `Asia/Kolkata`. **Tier 0 (B0.1–B0.5) is complete.** Next: Tier 1 (self-serve onboarding / homework / timetable / promotion) or Tier 2 (AI report-card comments / parent Today feed).

### 2026-06-19 — Tier 0 backlog COMPLETE: B0.5 typed-cast debt
- Status: ✅ Completed — Tier 0 (B0.1–B0.5) done; only infra follow-ups (Sentry, rate limiting) remain.
- What was done (B0.5): typed `bulkCreateStudents(studentsData: BulkStudentRow[])` (was `any[]`) and removed the last `@ts-expect-error` (onboarding grading-rule dynamic index → `Record<string, string|number>` cast). Login `subscription_plan/status` casts were already explicit (no change needed). `no-explicit-any` 322 → **310**; `@ts-expect-error` 1 → **0**.
- Tests: `pnpm type-check` → 0 errors; `pnpm lint` → 0 errors; full suite → **231 passed**.
- Tier 0 summary: B0.1 subscription lockout ✅, B0.2 dead cron removed ✅, B0.3 timezone helper ✅, B0.4 /health ✅, B0.5 typed-cast debt ✅. Deferred to owner/infra: Sentry (DSN), auth rate limiting (shared store). Incremental P2: teacher-dashboard/reports/fees nested-select `any` typing, per-school timezone column.

### 2026-06-19 — Tier 0 backlog: B0.3 timezone helper + B0.4 /health probe
- Status: ✅ Completed (B0.3 done; B0.4 /health done, Sentry + rate-limit flagged as infra follow-ups)
- What was done:
  - **B0.3 — UTC date footgun (P1):** added timezone-aware [`src/lib/date-utils.ts`](../src/lib/date-utils.ts) — `schoolToday()` and `localDateISO(instant, tz)` formatting via `Intl` in `Asia/Kolkata` by default (override `NEXT_PUBLIC_DEFAULT_TIMEZONE`), with 6 boundary unit tests (incl. the 23:30/01:30 IST roll-over the old `toISOString().split('T')[0]` got wrong). Routed operational "today" through it: attendance mark + import default dates, teacher dashboard pending-attendance check, manager dashboard today + 7-day trend window, fees history range, parent attendance "today" highlight, teacher/student join-date form defaults. `deleted_at`/`entered_at` full timestamps were correctly left as UTC.
  - **B0.4 — observability (/health):** added dependency-free [`src/app/api/health/route.ts`](../src/app/api/health/route.ts) — liveness 200 + best-effort Supabase reachability (503 when down), allow-listed `/api/health` in `src/lib/supabase/middleware.ts` so unauthenticated uptime monitors can reach it.
- Tests: `pnpm type-check` → 0 errors; `pnpm lint` → 0 errors; full suite → **231 passed** (225 prior + 6 date-utils); `pnpm build` → success, `/api/health` route emitted.
- Notes: Sentry (needs DSN/account + PII scrubbing) and app-level auth rate limiting (needs a shared store like Upstash for distributed correctness) are infra/account decisions left for the owner. Remaining Tier 0: B0.5 (typed-cast debt). Per-school timezone column on `schools` is a future enhancement.

### 2026-06-19 — Tier 0 backlog: B0.1 subscription lockout + B0.2 dead cron removal
- Status: ✅ Completed (first two Tier-0 items from PRODUCT_BACKLOG.md)
- What was done:
  - **B0.1 — runtime subscription lockout (P0):** suspended schools and expired trials were not blocked at request time (middleware only did auth/role routing). Added pure [`evaluateSubscriptionAccess(status, trialEndsAt, now)`](../src/lib/subscription-access.ts) and wired it into `src/lib/supabase/middleware.ts`: for any authenticated non-super-admin on a non-public route, it reads the caller's school (`user_profiles → schools(subscription_status, trial_ends_at)`) and redirects `suspended`/`trial_expired` schools to a new `/subscription-inactive` lockout screen (with sign-out). **Fail-open** on any read miss so legitimate users are never wrongly locked out. Correction to the earlier audit: `requireFeature()` (plan-tier gating) **is already wired** into the school-admin module layouts (reports/teachers/fees/exams) — the lockout was the genuine gap.
  - **B0.2 — dead fee-reminder cron (P0 silent failure):** deleted `src/app/api/cron/fee-reminders/route.ts`, which queried a `fee_installments` table that no migration creates (behind `db = supabase as any`) and was never scheduled (no `vercel.json`). Kept the `FeeReminderEmail` template for a future proper rebuild.
- Tests: `pnpm type-check` → 0 errors; `pnpm lint` → 0 errors; full Vitest suite → **225 passed** (217 prior + 8 new `subscription-access` unit tests); `pnpm build` → success, `/subscription-inactive` route emitted.
- Notes: Lockout enforced at the middleware choke point so it also covers parent (client layout) + server actions/API uniformly. Remaining Tier-0: B0.3 (timezone helper), B0.4 (/health + Sentry), B0.5 (typed-cast debt). Remaining B0.1 follow-up: `requireFeature` parity for manager/inventory + communication + parent_portal, optional plan-limit enforcement.

### 2026-06-19 — Documentation alignment & de-staling pass
- Status: ✅ Completed
- What was done: Audited all ~28 docs and aligned the stale ones to the current reality (Phases 1 & 2 complete; QA Parts 1–5 done; Part 6 seam-ready). **No docs deleted** — none were truly redundant/useless, and all are cross-referenced by the `.github` AI reference files; instead de-staled in place + added source-of-truth pointers.
  - `.github/instructions/edunexus-context.instructions.md`: rewrote the "Known Current State (Baseline)" — it had wrongly claimed teacher/attendance/fee/dashboards/Phase-1 exit gate and Phase-2 UI were still pending. Now correctly states Phases 1 & 2 complete + Part 6 seam-ready, with PROGRESS.md as authoritative.
  - `Documentation/README.md`: header was "1.0.0-planning / Pre-development — Planning Phase / 2026-02-27" → "2.0.0 / Active development, Phases 1&2 complete / 2026-06-19" + PROGRESS.md pointer.
  - `Documentation/DEVELOPMENT_PLAN.md`: refreshed header (v1.2.0, 2026-06-19) + status banner; flipped stale milestone markers 1.10 and 2.1 from "🔄 In Progress" to "✅ Completed".
  - `Documentation/phases/phase1_mvp.md` + `phase2_advanced.md`: status lines now "✅ Complete — exit gate signed off 2026-06-16".
  - `Documentation/DATABASE_SCHEMA.md` + `API_DESIGN.md`: added "⚠️ Canonical source" banners pointing AI to the generated `database.types.ts` + `migrations/` and the `src/app/**/actions.ts` + `src/lib/**` code (incl. Part 6 seams) over the conceptual 2026-02-27 examples.
  - Regenerated `Documentation/AI_CONTEXT_SNAPSHOT.md` via `pnpm ai:sync-context`.
- Tests: N/A (docs only). Left historical records untouched — PROGRESS.md milestone table + older task-log entries (e.g. the 1.10 "183 passing" milestone description and dated "🔄 In Progress" log lines) are accurate point-in-time history.
- Notes: Module specs (`modules/01–11`) and the schema/API docs keep their conceptual content (still useful reference) but now flag the code/types as canonical. No reference-list changes were needed in the `.github` files since nothing was removed.

### 2026-06-19 — Part 6 readiness seams (payment gateway + SMS/WhatsApp — no live providers)
- Status: ✅ Completed (seams only; mobile/PWA still fully deferred)
- What was done: Prepared the codebase so the deferred Part 6 features (online payment gateway, SMS/WhatsApp alerts) drop in without a refactor, per user direction that they'll be added before deployment. **No** Razorpay/Stripe/Twilio SDKs or credentials were added.
  - **Notifications seam** (`src/lib/notifications/index.ts`): channel-agnostic `notify({ channel, ... })` dispatcher + `NotificationChannelProvider` contract + channel registry. `email` is wired (delegates to existing `sendEmail`); `sms`/`whatsapp` are not-configured placeholders that resolve `{ success: false, skipped: true }`. `isChannelConfigured()` + shared `NotificationEvent` (= `EmailEvent`). Existing 5 email call sites are unchanged.
  - **Payment seam** (`src/lib/payments/index.ts`): `PaymentProvider` contract (`createOrder`/`verifyWebhook`) with typed `PaymentOrderRequest`/`VerifiedPayment` (minor-unit amounts), empty provider registry, `getActivePaymentProvider()`/`isOnlinePaymentEnabled()`. Webhook route `src/app/api/payments/webhook/route.ts` returns **501** until a provider is registered and verifies signature before trusting amounts. Schema is already gateway-ready (`fee_payments.payment_mode='online'` + `reference_number`).
  - **Docs:** rewrote the Part 6 section of `QA_AUDIT_AND_HARDENING_PLAN.md` with the readiness design + "to add a provider later" contracts.
- Tests: `pnpm type-check` → 0 errors; `pnpm lint` → 0 errors (warnings only); full Vitest suite → **217 passed** (additive modules, no behaviour change).
- Notes: Per user choice, **no DB readiness migration** yet — a real SMS/WhatsApp provider will need a small migration adding a generic `notification_logs.recipient` column (documented). Mobile app / PWA (6.2) remains fully deferred with no readiness work.

### 2026-06-19 — Production Hardening — Follow-up threads (1.2 restore UI · 5.1 form labels · 5.2 parent typing)
- Status: ✅ Completed
- What was done: Executed the deferred follow-up threads from `Documentation/QA_AUDIT_AND_HARDENING_PLAN.md`.
  - **1.2 Restore/trash UI (main ask):** Added a reusable `DeletedItemsPanel` (`settings/components/deleted-items-panel.tsx`) that auto-hides when the trash is empty, lists soft-deleted rows via the existing `getDeletedConfigEntities()`, and restores via the tenant-scoped `restore*` actions. Wired into all five settings config tabs (classes, sections, subjects, academic years, grading rules) with a `refreshKey`/`onRestored` handshake so deletes and restores keep both lists fresh. Fee structures gained a parallel trash section on the fees page, backed by a **new** `getDeletedFeeStructures(schoolId, academicYearId?)` action (tenant-scoped admin client; composed `class · category · ₹amount` label; uses existing `restoreFeeStructure`).
  - **5.1 Label/`htmlFor` follow-up:** Associated every labelled field with its control across the remaining forms — settings **grading** (`<span>` → `<label htmlFor>`) + **academic** tabs, **students/new** (all 4 steps incl. selects/file/textarea), **students/[id]/edit**, **teachers/[id]** assignment Selects (`SelectTrigger id` ↔ label), **fees/collect** payment details, and **exams/new** (step-1 fields + indexed step-2 subject rows).
  - **5.2 `any` burn-down:** Typed `parent/actions.ts` `ParentAccessContext.db` (and the `db` local) against the generated admin client instead of `any`, so all parent queries are now type-checked; only `getLatestAnnouncements` keeps one **localized** `(context.db as any)` cast because the `announcements` table isn't in the generated types. `no-explicit-any` 323 → 322.
- Tests: `pnpm type-check` → 0 errors; `pnpm lint` → 0 errors (warnings only); full Vitest suite → **217 passed** (additive UI + a typing change, no behaviour change).
- Notes: All restore paths reuse the existing tenant-scoped, audit-logged `restore*` server actions — no new privileged surface. Remaining 5.2 `any` (teacher-dashboard nested selects, reports/fees data-shape casts, `bulkCreateStudents(any[])`, Next typed-routes `href as any`, dead fee-reminders cron) stays incremental follow-up.

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
