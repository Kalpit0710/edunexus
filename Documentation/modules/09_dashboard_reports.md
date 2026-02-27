# Module 09 — Dashboard & Reports

> **Phase:** Phase 1 (basic) + Phase 2 (advanced) | **Priority:** P0

---

## Role-Based Dashboards

### School Admin Dashboard
```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ 248 Students │ 18 Teachers  │ ₹1,24,500 Coll│ 86% Attend.  │
└──────────────┴──────────────┴──────────────┴──────────────┘
┌──────────────────────────┐ ┌──────────────────────────────┐
│ Monthly Collection Graph │ │ Pending Fees by Class        │
│ [Bar chart, 6 months]    │ │ [Pie chart / list]           │
└──────────────────────────┘ └──────────────────────────────┘
┌──────────────────────────┐ ┌──────────────────────────────┐
│ Attendance This Week     │ │ Recent Announcements          │
│ [Line chart per class]   │ │ [List]                       │
└──────────────────────────┘ └──────────────────────────────┘
```

### Teacher Dashboard
```
Today's Classes: 3  |  Pending Attendance: 1 class  |  Pending Marks: 2 exams

[My Classes (today)]     [Students with <75% attendance]
[Last exam performance]
```

### Manager Dashboard
```
Today's Collection: ₹12,400 (Cash: ₹8,000, UPI: ₹4,400)
Pending Fees: ₹2,34,000 across 47 students

[Daily transaction list]     [Low stock items]
```

### Super Admin Dashboard
```
Total Schools: 12  |  Active: 10  |  Suspended: 2  |  Revenue: ₹14,400

[Monthly revenue trend]     [School activity list]
[Recent sign-ups]
```

---

## Downloadable Reports

| Report | Format | Access |
|--------|--------|--------|
| Student list | Excel | Admin |
| Fee pending report | Excel / PDF | Admin, Manager |
| Payment history | Excel | Admin, Manager |
| Daily collection | PDF | Manager |
| Class attendance | Excel | Admin, Teacher |
| Exam results | PDF (per student) + Excel (class) | Admin, Teacher |
| Inventory stock | Excel | Admin, Manager |
| Audit log export | Excel | Admin |

---

## Materialized Views (Performance)

For heavy dashboard queries, PostgreSQL materialized views cached and refreshed periodically:

```sql
mv_school_fee_summary        -- total collected, pending per school
mv_daily_attendance_summary  -- present/absent counts per class per day
mv_exam_performance_summary  -- average marks, pass % per exam per class
```

## Phase 1 Scope
- [x] Basic admin stat cards (students, teachers, collection, attendance)
- [x] Teacher dashboard (classes, pending tasks)
- [x] Manager dashboard (daily collection, pending fees)
- [x] Parent dashboard (child summary)
- [x] Basic report exports

## Phase 2 Additions
- [ ] Trend charts (recharts) for collection, attendance, exam performance
- [ ] Advanced filters for all reports
- [ ] Materialized views for performance
- [ ] Scheduled report emails (weekly summary to admin)
- [ ] Super Admin cross-school analytics
