# EduNexus — Database Schema

> **Version:** 1.0.0  
> **Last Updated:** 2026-02-27  
> **Database:** PostgreSQL 15+ (via Supabase)  
> **Audience:** Developers, AI Assistants, DBAs

---

## Table of Contents

1. [Schema Design Principles](#schema-design-principles)
2. [Entity Relationship Overview](#entity-relationship-overview)
3. [Core Tables](#core-tables)
4. [Academic Tables](#academic-tables)
5. [Financial Tables](#financial-tables)
6. [Inventory & POS Tables](#inventory--pos-tables)
7. [Communication Tables](#communication-tables)
8. [Audit & Logs Tables](#audit--logs-tables)
9. [Row-Level Security Policies](#row-level-security-policies)
10. [Indexes](#indexes)
11. [PostgreSQL Functions](#postgresql-functions)
12. [Migrations Naming Convention](#migrations-naming-convention)

---

## Schema Design Principles

1. **Every tenant-scoped table has `school_id UUID NOT NULL`**
2. **All tables use UUID primary keys** (not serial integers)
3. **Soft deletes** — `deleted_at TIMESTAMPTZ` where appropriate (students, teachers)
4. **Audit fields** — `created_at`, `updated_at`, `created_by` on all tables
5. **RLS on all tenant tables** — no application-level filtering alone
6. **No cross-school foreign keys** — all FK references within same school guaranteed by RLS + application logic
7. **Enum types** defined in PostgreSQL for constrained fields

---

## Entity Relationship Overview

```
schools (1)
  └── users (N)                          -- all users belong to a school
  └── classes (N)
        └── sections (N)
              └── students (N)
                    └── parents (1..N)
                    └── attendance (N)
                    └── marks (N)
                    └── payments (N)
  └── teachers (N)
        └── teacher_class_assignments (N)
        └── teacher_subject_assignments (N)
  └── subjects (N)
  └── exams (N)
        └── exam_subjects (N)
  └── fee_structures (N)
        └── fee_heads (N)
  └── students
        └── fee_installments (N)
  └── inventory_items (N)
        └── inventory_sales (N)
  └── announcements (N)
  └── audit_logs (N)
```

---

## Core Tables

### `schools`

```sql
CREATE TABLE schools (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  code                TEXT UNIQUE NOT NULL,           -- short identifier e.g. "GVS2024"
  logo_url            TEXT,
  theme_color         TEXT DEFAULT '#1d4ed8',         -- hex
  address             TEXT,
  phone               TEXT,
  email               TEXT,
  website             TEXT,
  subscription_plan   TEXT DEFAULT 'basic',           -- basic | standard | premium
  subscription_status TEXT DEFAULT 'active',          -- active | suspended | trial
  trial_ends_at       TIMESTAMPTZ,
  is_active           BOOLEAN DEFAULT true,
  timezone            TEXT DEFAULT 'Asia/Kolkata',
  currency            TEXT DEFAULT 'INR',
  academic_year_start DATE,
  academic_year_end   DATE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
```

### `users`

```sql
CREATE TYPE user_role AS ENUM ('super_admin', 'school_admin', 'teacher', 'manager', 'parent');

CREATE TABLE users (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id    UUID REFERENCES schools(id),              -- NULL for super_admin
  role         user_role NOT NULL,
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  email        TEXT NOT NULL,
  phone        TEXT,
  avatar_url   TEXT,
  is_active    BOOLEAN DEFAULT true,
  last_login   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### `classes`

```sql
CREATE TABLE classes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id),
  name          TEXT NOT NULL,                           -- "Grade 1", "Class 9"
  display_order INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, name)
);
```

### `sections`

```sql
CREATE TABLE sections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id),
  class_id      UUID NOT NULL REFERENCES classes(id),
  name          TEXT NOT NULL,                           -- "A", "B", "Science"
  capacity      INT DEFAULT 40,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, class_id, name)
);
```

### `students`

```sql
CREATE TABLE students (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID NOT NULL REFERENCES schools(id),
  section_id          UUID NOT NULL REFERENCES sections(id),
  roll_number         TEXT,
  admission_number    TEXT NOT NULL,
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  date_of_birth       DATE,
  gender              TEXT,                              -- male | female | other
  blood_group         TEXT,
  photo_url           TEXT,
  address             TEXT,
  admission_date      DATE DEFAULT CURRENT_DATE,
  status              TEXT DEFAULT 'active',             -- active | transferred | graduated | suspended
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  created_by          UUID REFERENCES users(id),
  UNIQUE(school_id, admission_number)
);
```

### `parents`

```sql
CREATE TABLE parents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id),
  user_id      UUID REFERENCES users(id),                -- linked auth user (when they log in)
  student_id   UUID NOT NULL REFERENCES students(id),
  relationship TEXT NOT NULL,                            -- father | mother | guardian
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  email        TEXT,
  phone        TEXT NOT NULL,
  occupation   TEXT,
  is_primary   BOOLEAN DEFAULT false,                    -- primary contact
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### `teachers`

```sql
CREATE TABLE teachers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES schools(id),
  user_id        UUID NOT NULL REFERENCES users(id),
  employee_code  TEXT,
  department     TEXT,
  qualification  TEXT,
  joining_date   DATE,
  is_active      BOOLEAN DEFAULT true,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, employee_code)
);
```

### `teacher_class_assignments`

```sql
CREATE TABLE teacher_class_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id),
  teacher_id      UUID NOT NULL REFERENCES teachers(id),
  section_id      UUID NOT NULL REFERENCES sections(id),
  academic_year   TEXT NOT NULL,                         -- e.g. "2025-2026"
  is_class_teacher BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, teacher_id, section_id, academic_year)
);
```

### `subjects`

```sql
CREATE TABLE subjects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id),
  class_id      UUID NOT NULL REFERENCES classes(id),
  name          TEXT NOT NULL,
  code          TEXT,
  max_marks     INT DEFAULT 100,
  pass_marks    INT DEFAULT 33,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, class_id, name)
);
```

---

## Academic Tables

### `attendance`

```sql
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'half_day', 'holiday', 'excused');

CREATE TABLE attendance (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id),
  student_id   UUID NOT NULL REFERENCES students(id),
  section_id   UUID NOT NULL REFERENCES sections(id),
  date         DATE NOT NULL,
  status       attendance_status NOT NULL DEFAULT 'present',
  marked_by    UUID REFERENCES users(id),
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, student_id, date)               -- one record per student per day
);
```

### `exams`

```sql
CREATE TYPE exam_status AS ENUM ('draft', 'published', 'ongoing', 'completed', 'locked');

CREATE TABLE exams (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES schools(id),
  class_id       UUID NOT NULL REFERENCES classes(id),
  name           TEXT NOT NULL,                          -- "First Term Exam 2025"
  academic_year  TEXT NOT NULL,
  start_date     DATE,
  end_date       DATE,
  status         exam_status DEFAULT 'draft',
  result_visible BOOLEAN DEFAULT false,                  -- whether parents can see
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### `exam_subjects`

```sql
CREATE TABLE exam_subjects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id),
  exam_id         UUID NOT NULL REFERENCES exams(id),
  subject_id      UUID NOT NULL REFERENCES subjects(id),
  exam_date       DATE,
  start_time      TIME,
  duration_mins   INT,
  max_marks       INT NOT NULL,
  pass_marks      INT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exam_id, subject_id)
);
```

### `marks`

```sql
CREATE TABLE marks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id),
  exam_id         UUID NOT NULL REFERENCES exams(id),
  exam_subject_id UUID NOT NULL REFERENCES exam_subjects(id),
  student_id      UUID NOT NULL REFERENCES students(id),
  marks_obtained  DECIMAL(5,2),
  grade           TEXT,                                  -- computed; stored for perf
  is_absent       BOOLEAN DEFAULT false,
  entered_by      UUID REFERENCES users(id),
  entered_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exam_subject_id, student_id)
);
```

### `grading_rules`

```sql
CREATE TABLE grading_rules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id),
  class_id     UUID REFERENCES classes(id),              -- NULL = applies to all classes
  min_percent  DECIMAL(5,2) NOT NULL,
  max_percent  DECIMAL(5,2) NOT NULL,
  grade        TEXT NOT NULL,                            -- "A+", "A", "B", "C", "D", "F"
  gpa          DECIMAL(3,2),
  description  TEXT,                                    -- "Outstanding", "Excellent"
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Financial Tables

### `fee_structures`

```sql
CREATE TABLE fee_structures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id),
  class_id        UUID REFERENCES classes(id),           -- NULL = all classes
  name            TEXT NOT NULL,
  academic_year   TEXT NOT NULL,
  frequency       TEXT NOT NULL,                         -- monthly | quarterly | half_yearly | yearly
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### `fee_heads`

```sql
CREATE TYPE fee_head_type AS ENUM ('tuition', 'transport', 'admission', 'maintenance', 'miscellaneous', 'library', 'sports', 'lab');

CREATE TABLE fee_heads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES schools(id),
  fee_structure_id  UUID NOT NULL REFERENCES fee_structures(id),
  name              TEXT NOT NULL,
  type              fee_head_type NOT NULL,
  amount            DECIMAL(10,2) NOT NULL,
  is_optional       BOOLEAN DEFAULT false,
  display_order     INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
```

### `fee_installments`

```sql
CREATE TYPE installment_status AS ENUM ('pending', 'partial', 'paid', 'overdue', 'waived');

CREATE TABLE fee_installments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES schools(id),
  student_id        UUID NOT NULL REFERENCES students(id),
  fee_structure_id  UUID NOT NULL REFERENCES fee_structures(id),
  installment_no    INT NOT NULL,                        -- 1, 2, 3, 4 (for quarterly)
  due_date          DATE NOT NULL,
  total_amount      DECIMAL(10,2) NOT NULL,
  paid_amount       DECIMAL(10,2) DEFAULT 0,
  late_fee          DECIMAL(10,2) DEFAULT 0,
  discount          DECIMAL(10,2) DEFAULT 0,
  status            installment_status DEFAULT 'pending',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

### `payments`

```sql
CREATE TYPE payment_mode AS ENUM ('cash', 'upi', 'card', 'bank_transfer', 'cheque', 'online');
CREATE TYPE payment_status AS ENUM ('completed', 'partial', 'refunded', 'cancelled');

CREATE TABLE payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID NOT NULL REFERENCES schools(id),
  student_id          UUID NOT NULL REFERENCES students(id),
  installment_id      UUID REFERENCES fee_installments(id),
  receipt_number      TEXT UNIQUE NOT NULL,               -- auto-generated: SCH-2025-00001
  amount              DECIMAL(10,2) NOT NULL,
  payment_mode        payment_mode NOT NULL,
  payment_date        TIMESTAMPTZ DEFAULT NOW(),
  reference_number    TEXT,                              -- UPI ref, cheque no, etc.
  status              payment_status DEFAULT 'completed',
  notes               TEXT,
  receipt_url         TEXT,                              -- Supabase Storage URL
  collected_by        UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

### `payment_items`

```sql
CREATE TABLE payment_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id),
  payment_id   UUID NOT NULL REFERENCES payments(id),
  fee_head_id  UUID NOT NULL REFERENCES fee_heads(id),
  amount       DECIMAL(10,2) NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### `discounts`

```sql
CREATE TABLE discounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES schools(id),
  student_id     UUID NOT NULL REFERENCES students(id),
  fee_head_id    UUID REFERENCES fee_heads(id),          -- NULL = all heads
  discount_type  TEXT NOT NULL,                          -- percentage | fixed
  value          DECIMAL(10,2) NOT NULL,
  reason         TEXT,
  valid_from     DATE,
  valid_to       DATE,
  approved_by    UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Inventory & POS Tables

### `inventory_items`

```sql
CREATE TYPE inventory_category AS ENUM ('book', 'stationery', 'uniform', 'sports', 'lab', 'other');

CREATE TABLE inventory_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id),
  name             TEXT NOT NULL,
  category         inventory_category NOT NULL,
  sku              TEXT,
  description      TEXT,
  unit_price       DECIMAL(10,2) NOT NULL,
  cost_price       DECIMAL(10,2),
  stock_quantity   INT NOT NULL DEFAULT 0,
  low_stock_alert  INT DEFAULT 10,                        -- alert when stock <= this
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
```

### `inventory_sales`

```sql
CREATE TABLE inventory_sales (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES schools(id),
  student_id     UUID REFERENCES students(id),           -- NULL for walk-in
  bill_number    TEXT UNIQUE NOT NULL,
  total_amount   DECIMAL(10,2) NOT NULL,
  payment_mode   payment_mode NOT NULL,
  sold_by        UUID REFERENCES users(id),
  sale_date      TIMESTAMPTZ DEFAULT NOW(),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### `inventory_sale_items`

```sql
CREATE TABLE inventory_sale_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES schools(id),
  sale_id        UUID NOT NULL REFERENCES inventory_sales(id),
  item_id        UUID NOT NULL REFERENCES inventory_items(id),
  quantity       INT NOT NULL,
  unit_price     DECIMAL(10,2) NOT NULL,
  total_price    DECIMAL(10,2) NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### `stock_adjustments`

```sql
CREATE TABLE stock_adjustments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id),
  item_id      UUID NOT NULL REFERENCES inventory_items(id),
  type         TEXT NOT NULL,                            -- add | remove | adjustment
  quantity     INT NOT NULL,
  reason       TEXT,
  adjusted_by  UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Communication Tables

### `announcements`

```sql
CREATE TYPE announcement_audience AS ENUM ('school', 'class', 'section', 'teachers', 'parents');

CREATE TABLE announcements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id),
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  audience     announcement_audience NOT NULL,
  class_id     UUID REFERENCES classes(id),              -- if audience = class/section
  section_id   UUID REFERENCES sections(id),             -- if audience = section
  is_published BOOLEAN DEFAULT false,
  publish_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ,
  attachment_url TEXT,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### `notification_logs`

```sql
CREATE TABLE notification_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id),
  type         TEXT NOT NULL,                            -- email | sms | push
  event        TEXT NOT NULL,                            -- fee_reminder | attendance_alert | etc.
  recipient_id UUID REFERENCES users(id),
  recipient_email TEXT,
  subject      TEXT,
  status       TEXT DEFAULT 'sent',                     -- sent | failed | bounced
  error_msg    TEXT,
  sent_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Audit & Logs Tables

### `audit_logs`

```sql
CREATE TABLE audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID REFERENCES schools(id),              -- NULL for super admin actions
  user_id      UUID REFERENCES users(id),
  action       TEXT NOT NULL,                            -- e.g. "CREATE_STUDENT", "COLLECT_FEE"
  table_name   TEXT,
  record_id    UUID,
  old_data     JSONB,
  new_data     JSONB,
  ip_address   INET,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Row-Level Security Policies

### Pattern Applied to All Tenant Tables

```sql
-- Template: replace 'students' with any tenant table name

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Super admin can see everything
CREATE POLICY "super_admin_all" ON students
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- School users see only their school's data
CREATE POLICY "school_isolation" ON students
  FOR ALL
  TO authenticated
  USING (
    school_id = (auth.jwt() ->> 'school_id')::UUID
  );

-- Service role bypasses RLS (used by Edge Functions)
CREATE POLICY "service_role_bypass" ON students
  FOR ALL
  TO service_role
  USING (true);
```

### Parent Read-Only Access

```sql
-- Parents can only view their own children
CREATE POLICY "parent_read_own_child" ON students
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'parent'
    AND id IN (
      SELECT student_id FROM parents
      WHERE user_id = auth.uid()
    )
  );
```

### Teacher Scoped Access

```sql
-- Teachers see only students in their assigned sections
CREATE POLICY "teacher_class_scope" ON students
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'teacher'
    AND school_id = (auth.jwt() ->> 'school_id')::UUID
    AND section_id IN (
      SELECT section_id FROM teacher_class_assignments
      WHERE teacher_id = (
        SELECT id FROM teachers WHERE user_id = auth.uid()
      )
      AND academic_year = EXTRACT(YEAR FROM NOW())::TEXT
    )
  );
```

---

## Indexes

```sql
-- Core lookup indexes
CREATE INDEX idx_users_school_id ON users(school_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_students_school_id ON students(school_id);
CREATE INDEX idx_students_section_id ON students(section_id);
CREATE INDEX idx_students_status ON students(status) WHERE deleted_at IS NULL;

-- Attendance queries (heavy read)
CREATE INDEX idx_attendance_school_date ON attendance(school_id, date);
CREATE INDEX idx_attendance_student_date ON attendance(student_id, date);
CREATE INDEX idx_attendance_section_date ON attendance(section_id, date);

-- Financial queries
CREATE INDEX idx_payments_school_date ON payments(school_id, payment_date);
CREATE INDEX idx_payments_student ON payments(student_id);
CREATE INDEX idx_fee_installments_student ON fee_installments(student_id);
CREATE INDEX idx_fee_installments_status ON fee_installments(status);
CREATE INDEX idx_fee_installments_due_date ON fee_installments(due_date) WHERE status = 'pending';

-- Marks
CREATE INDEX idx_marks_exam_student ON marks(exam_id, student_id);

-- Inventory
CREATE INDEX idx_inventory_items_school ON inventory_items(school_id, is_active);
CREATE INDEX idx_inventory_items_low_stock ON inventory_items(school_id) 
  WHERE stock_quantity <= low_stock_alert;

-- Audit logs
CREATE INDEX idx_audit_logs_school_date ON audit_logs(school_id, created_at DESC);
```

---

## PostgreSQL Functions

### `collect_fee` — Atomic fee payment

```sql
CREATE OR REPLACE FUNCTION collect_fee(
  p_school_id       UUID,
  p_student_id      UUID,
  p_installment_id  UUID,
  p_amount          DECIMAL,
  p_payment_mode    payment_mode,
  p_collected_by    UUID,
  p_reference_no    TEXT DEFAULT NULL,
  p_notes           TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_payment_id    UUID;
  v_receipt_no    TEXT;
  v_paid_so_far   DECIMAL;
  v_total         DECIMAL;
BEGIN
  -- Generate receipt number
  SELECT 'REC-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
         LPAD((COUNT(*) + 1)::TEXT, 5, '0')
  INTO v_receipt_no
  FROM payments WHERE school_id = p_school_id;

  -- Insert payment
  INSERT INTO payments (school_id, student_id, installment_id, receipt_number, 
                        amount, payment_mode, reference_number, notes, collected_by)
  VALUES (p_school_id, p_student_id, p_installment_id, v_receipt_no,
          p_amount, p_payment_mode, p_reference_no, p_notes, p_collected_by)
  RETURNING id INTO v_payment_id;

  -- Update installment
  SELECT paid_amount + p_amount, total_amount + late_fee - discount
  INTO v_paid_so_far, v_total
  FROM fee_installments WHERE id = p_installment_id;

  UPDATE fee_installments SET
    paid_amount = v_paid_so_far,
    status = CASE 
      WHEN v_paid_so_far >= v_total THEN 'paid'::installment_status
      ELSE 'partial'::installment_status
    END,
    updated_at = NOW()
  WHERE id = p_installment_id;

  -- Audit log
  INSERT INTO audit_logs (school_id, user_id, action, table_name, record_id, new_data)
  VALUES (p_school_id, p_collected_by, 'COLLECT_FEE', 'payments', v_payment_id,
          jsonb_build_object('amount', p_amount, 'mode', p_payment_mode));

  RETURN v_payment_id;
END;
$$;
```

### `apply_late_fees` — Called by cron job

```sql
CREATE OR REPLACE FUNCTION apply_late_fees(p_school_id UUID)
RETURNS INT  -- returns count of installments updated
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_late_fee_rate DECIMAL;
BEGIN
  -- Get late fee rate from school settings (future: school_settings table)
  v_late_fee_rate := 50; -- ₹50 per day default

  UPDATE fee_installments SET
    late_fee = late_fee + v_late_fee_rate,
    status = 'overdue',
    updated_at = NOW()
  WHERE school_id = p_school_id
    AND status = 'pending'
    AND due_date < CURRENT_DATE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
```

---

## Migrations Naming Convention

```
YYYYMMDDHHMMSS_description_of_change.sql

Examples:
  20260301000001_create_schools_table.sql
  20260301000002_create_users_table.sql
  20260315000001_add_late_fee_to_installments.sql
  20260320000001_create_inventory_tables.sql
```

All migrations live in `supabase/migrations/` and are version-controlled.
