# Module 05 — Academics & Examination

> **Phase:** Phase 2 | **Priority:** P0

## Overview
Manages the full exam lifecycle: creation → marks entry → result generation → report cards → publishing to parents.

## Exam Lifecycle
```
draft → published → ongoing → completed → locked
```
Results are visible to parents only when:
1. `exams.result_visible = true` (set by Admin on publish)
2. Student's fee is paid (if `result_locked_by_fee` school setting is enabled)

## Exam Creation
Admin/Teacher creates an exam with:
- Class scope
- Exam name (e.g., "First Term 2025")
- Academic year
- For each subject: date, time, duration, max marks, pass marks

## Marks Entry (Teacher View)
Grid layout per subject:
```
Exam: First Term 2025 | Subject: Mathematics | Class: Grade 5A

Student Name    | Marks (out of 100) | Grade | Absent
John Doe        | [85            ]   | A     | ☐
Jane Smith      | [   ] ← empty     |       | ☑ (absent)
Ravi Kumar      | [62            ]   | B     | ☐

[Save Draft]  [Mark as Complete]
```

## Grade Calculation
Auto-computed from school's grading rules when marks are entered.  
Grade is stored (not computed on read) for performance.

## Report Card Generation
Edge Function generates beautiful PDF with:
- School header (logo, name, address)
- Student details, class, academic year
- Per-subject marks table with grades
- Total and percentage
- Rank in class
- Remarks field (Admin editable)
- School stamp area

## Reports
| Report | Description |
|--------|-------------|
| Class performance | Subject-wise average, pass %, toppers |
| Topper list | Rank-ordered student list |
| Failed students | Students below pass marks per subject |
| Result card | Per-student printable PDF |

## Business Rules
1. Marks entry requires exam to be in `published` or `ongoing` status
2. Results **lock** on publish — Admin must unlock explicitly to re-enter
3. PDF report cards are generated once and cached (re-generated only if Admin re-publishes)
4. Marks can be entered per subject independently
5. Absent students get null marks (not 0)

## Phase 2 Scope
- [ ] Exam creation form
- [ ] Marks entry grid
- [ ] Excel bulk marks import
- [ ] Grade auto-calculation
- [ ] Report card PDF generation
- [ ] Result publishing flow
- [ ] Result locking
- [ ] Class performance report
- [ ] Topper list
