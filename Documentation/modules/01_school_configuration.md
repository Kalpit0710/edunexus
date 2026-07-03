# Module 01 — School Configuration

> **Phase:** Phase 1 | **Priority:** P0

## Overview
School Configuration is the foundation. Every other module depends on the settings defined here. It is the first thing a School Admin configures when onboarding.

## Configurable Settings

| Setting | Description | Example |
|---------|-------------|---------|
| School name | Displayed everywhere | "Green Valley School" |
| Logo | Uploaded to Storage, shown in UI and PDFs | 200x200 PNG |
| Theme color | Hex color for school branding | `#1d4ed8` |
| Academic year | Start and end dates | 2025-04-01 to 2026-03-31 |
| Timezone | For all date/time display | Asia/Kolkata |
| Currency | For all fee displays | INR |
| Grade system | Select grading rules | CBSE / custom |
| Attendance policy | % threshold for warnings | 75% |
| Fee late charge | Daily late fee amount | ₹50/day |
| Late grace period | Days after due before late fee starts | 5 days |
| Result visibility | Whether parents can view results by default | true |
| Result locked by fee | Lock report cards while fees are due | false (configurable) ✅ |

## Implemented School Settings (Settings → General / Report Card / Access Control)

These per-school controls are live (defaults preserve prior behavior):

| Setting | Where | Notes |
|---------|-------|-------|
| Report card title | General | Letterhead badge text (default "Progress Report") |
| Pass percentage | General | Drives auto Pass/Fail on the card (default 33) |
| Result status options | General | Dropdown values for a student's result |
| Co-scholastic grade scale | General | e.g. A–E or A–C |
| Currency symbol / locale / date format | General | Used in fee + report-card formatting |
| Lock results on fee | General | Server-enforced fee guardrail toggle |
| Principal / class-teacher signatures | General + Teacher edit | Image URLs printed on report cards |
| Grand-total rule | Report Card | Average vs sum of the two terms |
| Scholastic component labels | Report Card | Rename Periodic Test / Notebook / etc. |
| Co-scholastic areas | Report Card | Add/remove custom areas |
| Subject display order | Subjects | Orders subjects on report cards |
| Module visibility | Access Control | Switch any module on/off school-wide |
| Role permissions | Access Control | Per-role capability matrix (server-enforced) |

## Classes & Sections Setup
- School Admin creates classes (Grade 1–10, etc.)
- Creates sections per class (A, B, Science, etc.)
- Assigns capacity per section
- Assigns a class teacher per section

## Grading Rules Setup
School Admin defines the grading scale:
```
90–100 → A+  (Outstanding)
75–89  → A   (Excellent)
60–74  → B   (Good)
40–59  → C   (Average)
0–39   → F   (Fail)
```

## Subject Setup
Per class, admin defines subjects with:
- Name
- Code (optional)
- Max marks
- Pass marks

## Guided Onboarding Wizard
For new schools, a step-by-step wizard walks through:
1. School details (name, logo, theme)
2. Academic year setup
3. Classes and sections
4. Subjects per class
5. Grading rules
6. Fee structure (leads into fee module)

## Phase 1 Scope
- [x] School details form
- [x] Logo upload (Supabase Storage)
- [x] Academic year setup
- [x] Class/section CRUD
- [x] Subject management
- [x] Grading rules setup
- [x] Guided setup wizard
- [x] Attendance policy config

## Phase 2 Additions
- [ ] Multiple grading rule sets (per class level)
- [ ] Custom school subdomain
- [ ] Timetable configuration
- [ ] Holiday calendar setup

## Mermaid Visual Summary

`mermaid
flowchart LR
  Discovery --> Planning --> Build --> Validate --> Release
`
