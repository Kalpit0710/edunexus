# Module 03 — Teacher Management

> **Phase:** Phase 1 | **Priority:** P0

## Overview
Manages all teachers in the school — their profiles, class assignments, subject responsibilities, and access control.

## Features

### Teacher CRUD
- Add teacher (creates both teacher profile + auth user)
- Edit teacher details
- View teacher profile with stats
- Activate / deactivate (revokes portal access)
- Delete (soft delete)

### Teacher Fields
```
Profile: first_name, last_name, email, phone, photo
Professional: employee_code, department, qualification, joining_date
Auth: linked auth user (role = 'teacher')
```

### Class Assignments
- Many-to-many: one teacher can be assigned to multiple sections
- One teacher is designated as **class teacher** per section
- Assignment is per academic year

### Subject Assignments  
- Teacher is assigned specific subjects in specific sections
- This controls which marks entries they can see and edit

## Teacher Profile View
```
Tabs: Overview | Classes | Performance
  
Classes tab:
  Grade 5A — Math, Science (Class Teacher)
  Grade 5B — Math
  Grade 6A — Science

Performance tab:
  Result improvement tracked per term
  Attendance compliance (how regularly they mark)
```

## Access Control
- Teacher can only see students in **their assigned sections**
- Teacher can only enter marks for **their assigned subjects**
- Teacher CANNOT see other teachers' classes or fee data
- Teacher CAN mark attendance for their classes
- Teacher CAN create announcements for their classes

## Phase 1 Scope
- [x] Teacher list with search and filter
- [x] Add/edit teacher form
- [x] Class and subject assignment UI
- [x] Activate/deactivate
- [x] Teacher profile with stats
- [x] Auth user creation on add

## Phase 2 Additions
- [ ] Performance analytics dashboard
- [ ] Salary tracking (basic)
- [ ] Parent feedback collection
- [ ] Teacher attendance (separate from student attendance)
