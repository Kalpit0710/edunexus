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
| Result locked by fee | Lock results if fee unpaid | false (configurable) |

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
