# Module 10 — Parent Portal

> **Phase:** Phase 2 | **Priority:** P0

## Overview
A read-only portal for parents to track their child's academic progress, attendance, fees, and school announcements. Designed to be extremely simple — parents are non-technical users.

## Access Rules
- Parent logs in with the email/phone registered during student enrollment
- Parent can only see **their own child's** data (RLS enforced)
- One parent account can be linked to **multiple children**
- If a parent has multiple children, they switch between them via a dropdown

## Screens

### Parent Home / Dashboard
```
[Child: John Doe — Grade 5A]    [Switch Child ▼]

Attendance This Month: 87% ✅
Last Result: First Term — 78% (Grade A) 📘
Pending Fee: ₹3,500 due 31 Mar 💰
New Announcement (2) 📢
```

### Attendance View
Calendar view showing:
- Green ✅ = Present
- Red ❌ = Absent
- Yellow ⏰ = Late

Monthly summary: X days present / Y days absent / Z% attendance

### Results & Report Cards
- List of all exams
- Click exam → view marks per subject + grade
- Download PDF report card
- If `result_visible = false` → shows "Results not yet published"
- If fee restriction enabled + fee unpaid → shows locked icon + "Clear dues to view results"

### Fee Status
```
Academic Year: 2025-2026

Installment 1 (Apr 2025):  ✅ Paid — ₹6,700  [Download Receipt]
Installment 2 (Jul 2025):  ✅ Paid — ₹6,700  [Download Receipt]
Installment 3 (Oct 2025):  🟡 Partial — ₹3,500 paid, ₹3,200 due
Installment 4 (Jan 2026):  🔴 Pending — ₹6,700 due 31 Jan 2026
```

### Announcements
List of school/class announcements (newest first). Read-only.

### Timetable (Phase 2+)
Class timetable if configured by Admin.

## Business Rules
1. Parent CANNOT edit any data
2. Parent CANNOT see other students' data (RLS enforced)
3. Parent CAN download their child's fee receipts and report cards
4. Result visibility is controlled by Admin's `result_visible` flag per exam
5. Fee restriction (lock results if unpaid) is school-configurable

## UI Design
The parent portal uses a **simplified layout** — no sidebar, just bottom navigation (mobile-first):
```
Home | Attendance | Results | Fees | More
```

## Phase 2 Scope
- [ ] Parent login + auth routing
- [ ] Dashboard (child summary)
- [ ] Attendance calendar view
- [ ] Exam results view
- [ ] Report card download
- [ ] Fee status + receipt download
- [ ] Announcements view
- [ ] Multi-child switcher
- [ ] Fee unpaid result lock
