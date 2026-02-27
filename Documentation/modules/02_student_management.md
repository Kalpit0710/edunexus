# Module 02 — Student Management

> **Phase:** Phase 1 | **Priority:** P0

## Overview
Central student registry. Every academic and financial record in EduNexus is anchored to a student record. This module handles the full student lifecycle from admission to graduation/transfer.

## Features

### Student CRUD
- Add student (4-step wizard: Basic Info → Parent Mapping → Fee Plan → Review)
- Edit student details
- View full student profile
- Soft delete (never hard delete)
- Change class/section

### Student Fields
```
Basic Info:
  first_name, last_name, date_of_birth, gender, blood_group,
  address, admission_date, admission_number, roll_number, photo

Assignment:
  class_id, section_id, academic_year

Status:
  active | transferred | graduated | suspended
```

### Bulk Excel Upload
- Download template from UI
- Fill student data
- Upload `.xlsx` file
- System validates: duplicates, required fields, class exists
- Preview: valid rows vs error rows
- Confirm to import

**Excel Template Columns:**
`first_name, last_name, date_of_birth, gender, admission_number, class_name, section_name, parent_name, parent_phone, parent_email`

### Student ID / Admission Number
Auto-generated format (configurable): `{SCHOOL_CODE}/{YEAR}/{SEQUENCE}`  
Example: `GVS/2025/0042`

### Transfer Certificate (Phase 2)
Generate TC PDF with:
- Student details
- Class enrolled
- Date of admission and leaving
- Attendance summary
- Reason for leaving

## Student Profile View
```
┌─────────────────────────────────────┐
│ [Photo] John Doe        [Edit]      │
│ ADM-001 | Grade 5A | Active         │
├─────────────────────────────────────┤
│ Tabs: Overview | Attendance |       │
│       Exams | Fees | Activity       │
├─────────────────────────────────────┤
│ Overview:                           │
│   DOB: 01/01/2015                  │
│   Parent: Raj Doe (+91 9876543210) │
│   Address: ...                      │
│   Admission: 01/04/2023            │
└─────────────────────────────────────┘
```

## Business Rules
1. One student can have **multiple parents** (father + mother both stored)
2. Admission number is **unique per school**
3. Student can be moved between sections — history is preserved
4. Deleting a student is soft-delete — records are archived, not destroyed
5. A student's fee installments auto-generate on assignment to a fee structure

## Phase 1 Scope
- [x] Student list with search, filter, pagination
- [x] Add student wizard
- [x] Edit student
- [x] Soft delete
- [x] Student profile page
- [x] Photo upload
- [x] Excel bulk import/export
- [x] Parent mapping

## Phase 2 Additions
- [ ] Transfer certificate generation
- [ ] Student promotion (bulk move to next class at year end)
- [ ] Biometric ID integration
- [ ] Digital student ID card PDF
