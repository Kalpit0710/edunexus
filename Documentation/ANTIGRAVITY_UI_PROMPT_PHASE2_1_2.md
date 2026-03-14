# Antigravity UI Prompt — EduNexus Phase 2.1 + 2.2 (UI Only)

Use this prompt in Antigravity exactly as the implementation brief.

---

## Context

You are implementing **UI only** for EduNexus Phase 2.1 (Examination) and Phase 2.2 (Inventory + POS).

Backend contracts are already implemented in this repo:
- SQL migration + RPC + RLS: `supabase/migrations/20260314000001_phase2_exam_inventory_backend.sql`
- Exam backend actions: `src/app/(school-admin)/school-admin/exams/actions.ts`
- Inventory backend actions: `src/app/(manager)/manager/inventory/actions.ts`
- Shared utilities:
  - `src/lib/exam-utils.ts`
  - `src/lib/inventory-utils.ts`
  - constants in `src/lib/constants.ts`

You must consume these contracts. Do not redesign backend.

---

## Hard Constraints

1. **UI only** — do not modify SQL migrations, RLS policies, or RPC signatures.
2. Do not add or change backend business logic in server actions.
3. Use the existing component system (`shadcn/ui`, shared components, Tailwind tokens).
4. Keep UX minimal and task-focused per `Documentation/UI_UX_GUIDELINES.md`.
5. Every screen must include loading, empty, and error states.
6. Keep role visibility in UI aligned to security model:
   - School Admin / Teacher: Exam workflows
   - School Admin / Manager / Cashier: Inventory/POS workflows
7. Add UI tests for critical happy paths and state transitions.

---

## Feature Scope

### Phase 2.1 — Examination UI

Build screens under school-admin route group:

1. `src/app/(school-admin)/school-admin/exams/page.tsx`
   - Exam list with filters (class, status, search by name)
   - CTA: Create Exam
   - Exam status badges (`draft`, `published`, `ongoing`, `completed`, `locked`)

2. `src/app/(school-admin)/school-admin/exams/new/page.tsx`
   - Create exam form
   - Fields: class, academic year (optional), exam name, date range
   - Dynamic subject rows: subject, date, time, duration, max marks, pass marks
   - Submit via `createExam()`

3. `src/app/(school-admin)/school-admin/exams/[examId]/marks/page.tsx`
   - Subject selector for selected exam
   - Marks grid: student, marks, absent toggle, computed grade preview
   - Save via `saveExamMarks()`
   - Prevent entry in disallowed statuses using `canEnterMarks` behavior

4. `src/app/(school-admin)/school-admin/exams/[examId]/publish/page.tsx`
   - Publish + lock action via `publishExamResults()`
   - Unlock action via `unlockExamResults()`
   - Show marks count and lock state

5. `src/app/(school-admin)/school-admin/exams/[examId]/reports/page.tsx`
   - Class performance table via `getClassPerformanceReport()`
   - Topper list via `getTopperList()`
   - Student report card data view via `getStudentReportCardData()` (read-only preview)


### Phase 2.2 — Inventory + POS UI

Build screens under manager route group:

1. `src/app/(manager)/manager/inventory/page.tsx`
   - Inventory list with category/search filters
   - Stock, low-stock, active status indicators
   - CTA: Add Item, Adjust Stock, POS Sale

2. `src/app/(manager)/manager/inventory/new/page.tsx`
   - Add inventory item form
   - Submit via `createInventoryItem()`

3. `src/app/(manager)/manager/inventory/[itemId]/edit/page.tsx`
   - Edit item form via `updateInventoryItem()`
   - Active toggle via `setInventoryItemActive()`

4. `src/app/(manager)/manager/inventory/stock/page.tsx`
   - Stock adjustment workflow (`add/remove/adjustment`)
   - Submit via `adjustInventoryStock()`
   - Show validation errors inline

5. `src/app/(manager)/manager/inventory/pos/page.tsx`
   - Cart-based sale UI
   - Optional student linking
   - Payment mode selector
   - Create sale via `createInventorySale()`
   - Success state: show bill number + total

6. `src/app/(manager)/manager/inventory/reports/page.tsx`
   - Sales list via `getInventorySales()`
   - Low stock list via `getLowStockItems()`
   - Summary cards via `getInventorySummary()`

---

## Data Contracts (Use As-Is)

### Exam actions
Use exports from `src/app/(school-admin)/school-admin/exams/actions.ts`:
- `getExams(schoolId, opts)`
- `getExamById(schoolId, examId)`
- `getExamSubjects(schoolId, examId)`
- `createExam(schoolId, input)`
- `updateExamStatus(schoolId, examId, status, resultVisible?)`
- `saveExamMarks(schoolId, examId, examSubjectId, rows, enteredByProfileId?)`
- `publishExamResults(examId, notifyParents?)`
- `unlockExamResults(examId)`
- `getClassPerformanceReport(schoolId, examId)`
- `getTopperList(schoolId, examId, limit?)`
- `getStudentReportCardData(schoolId, examId, studentId)`

### Inventory actions
Use exports from `src/app/(manager)/manager/inventory/actions.ts`:
- `getInventoryItems(schoolId, opts)`
- `createInventoryItem(schoolId, input)`
- `updateInventoryItem(schoolId, itemId, updates)`
- `setInventoryItemActive(schoolId, itemId, isActive)`
- `adjustInventoryStock(schoolId, input)`
- `createInventorySale(schoolId, input)`
- `getInventorySales(schoolId, opts)`
- `getLowStockItems(schoolId, limit?)`
- `getInventorySummary(schoolId)`

---

## UX/Design Requirements

Follow `Documentation/UI_UX_GUIDELINES.md`:
- Non-technical, minimal cognitive load
- Use existing card/table/form patterns
- Soft, modern visual language using existing tokens
- Accessible controls, labels, keyboard navigation
- Responsive behavior for tablet/mobile

Do not introduce a new design system.

---

## Testing Requirements (UI Level)

Add/extend tests for:
1. Exam creation happy path (form validation + submit action call)
2. Marks entry state handling (absent vs marks)
3. Publish/lock flow button states
4. Inventory create/edit form validation
5. POS cart validation and checkout success state
6. Low-stock report rendering

Keep tests focused on UI behavior; do not duplicate backend logic tests.

---

## Deliverable Definition of Done

1. All listed UI routes/pages implemented.
2. UI wired to existing backend action contracts.
3. Loading, empty, and error states present on every data screen.
4. Responsive and accessible behavior validated.
5. Type-check + lint + UI tests passing.
6. No backend contract changes.
