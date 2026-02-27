# Module 04 — Attendance

> **Phase:** Phase 1 | **Priority:** P0

## Overview
Daily attendance tracking with parent notification support. Single record per student per day (upsert model).

## Attendance Statuses
`present` | `absent` | `late` | `half_day` | `holiday` | `excused`

## Marking Flow
1. Teacher selects class + section + date (defaults to today)
2. System loads student list for that section
3. Default: all marked as **Present**
4. Teacher toggles individual students to Absent/Late
5. "Mark All Present" button for bulk operations
6. Save → upsert to `attendance` table

## Daily Attendance View (Teacher)
```
Class: Grade 5A  |  Date: 27 Feb 2026  |  [Mark All Present]

✅ John Doe        ← click to toggle
❌ Jane Smith      ← absent
⏰ Ravi Kumar     ← late
✅ Priya Sharma
...

[Save Attendance]             20/23 Present (87%)
```

## Reports
| Report | Who Sees | Description |
|--------|----------|-------------|
| Daily view | Teacher, Admin | Who was present/absent today |
| Monthly summary | Teacher, Admin, Parent | Per-student calendar view |
| Class monthly | Admin | Aggregate attendance % per class |
| Low attendance alert | Admin | Students below threshold |

## Excel Import
- Download template
- Fill date + student_id + status columns
- Validate on upload (student exists, date valid, no future dates)
- Batch upsert

## Parent Notification
Edge Function cron (daily evening):
1. Find all absent students for today
2. Fetch primary parent's email
3. Send notification via Resend
4. Log to `notification_logs`

## Business Rules
1. One record per student per day (upsert)
2. Cannot mark attendance for future dates
3. Teachers can edit any date's attendance (configurable restriction for past days)
4. Holidays are marked manually by Admin for the entire school
5. Attendance percentage = (present + late days) / total school days

## Phase 1 Scope
- [x] Daily marking UI
- [x] Monthly summary report
- [x] Excel import/export
- [x] Parent SMS/email notification

## Phase 2 Additions
- [ ] Teacher attendance (separate tracking)
- [ ] Holiday calendar integration
- [ ] Attendance-linked certificate generation
- [ ] Biometric integration hook (Phase 3/4)
