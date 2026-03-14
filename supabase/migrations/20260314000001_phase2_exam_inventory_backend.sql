-- ============================================================
-- Migration: 20260314000001_phase2_exam_inventory_backend
-- EduNexus — Phase 2.1 (Examinations) + 2.2 (Inventory POS)
-- ============================================================

-- ─── ENUMS ──────────────────────────────────────────────────

DO $$
BEGIN
  CREATE TYPE exam_status AS ENUM (
    'draft',
    'published',
    'ongoing',
    'completed',
    'locked'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE inventory_category AS ENUM (
    'book',
    'stationery',
    'uniform',
    'sports',
    'lab',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE stock_adjustment_type AS ENUM (
    'add',
    'remove',
    'adjustment',
    'sale'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- ─── PHASE-2 TABLES ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS grading_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id    UUID REFERENCES classes(id) ON DELETE SET NULL,
  min_marks   DECIMAL(5, 2) NOT NULL,
  max_marks   DECIMAL(5, 2) NOT NULL,
  grade_name  TEXT NOT NULL,
  grade_point DECIMAL(4, 2),
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT grading_rules_marks_range_chk CHECK (
    min_marks >= 0
    AND max_marks <= 100
    AND min_marks <= max_marks
  )
);

CREATE TABLE IF NOT EXISTS exams (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id         UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  start_date       DATE,
  end_date         DATE,
  status           exam_status NOT NULL DEFAULT 'draft',
  result_visible   BOOLEAN NOT NULL DEFAULT FALSE,
  created_by       UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  published_by     UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  published_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exam_subjects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  exam_id       UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  subject_id    UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  exam_date     DATE,
  start_time    TIME,
  duration_mins INTEGER,
  max_marks     INTEGER NOT NULL,
  pass_marks    INTEGER NOT NULL DEFAULT 33,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT exam_subjects_duration_chk CHECK (duration_mins IS NULL OR duration_mins > 0),
  CONSTRAINT exam_subjects_marks_chk CHECK (max_marks > 0 AND pass_marks >= 0 AND pass_marks <= max_marks),
  UNIQUE (exam_id, subject_id)
);

CREATE TABLE IF NOT EXISTS marks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  exam_id         UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  exam_subject_id UUID NOT NULL REFERENCES exam_subjects(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  marks_obtained  DECIMAL(6, 2),
  grade           TEXT,
  is_absent       BOOLEAN NOT NULL DEFAULT FALSE,
  entered_by      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  entered_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marks_absent_null_marks_chk CHECK (
    (is_absent = TRUE AND marks_obtained IS NULL)
    OR (is_absent = FALSE)
  ),
  CONSTRAINT marks_non_negative_chk CHECK (marks_obtained IS NULL OR marks_obtained >= 0),
  UNIQUE (exam_subject_id, student_id)
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        inventory_category NOT NULL,
  sku             TEXT,
  description     TEXT,
  unit_price      DECIMAL(12, 2) NOT NULL,
  cost_price      DECIMAL(12, 2),
  stock_quantity  INTEGER NOT NULL DEFAULT 0,
  low_stock_alert INTEGER NOT NULL DEFAULT 10,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_items_price_chk CHECK (unit_price >= 0 AND (cost_price IS NULL OR cost_price >= 0)),
  CONSTRAINT inventory_items_stock_chk CHECK (stock_quantity >= 0 AND low_stock_alert >= 0),
  UNIQUE (school_id, sku)
);

CREATE TABLE IF NOT EXISTS inventory_sales (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id   UUID REFERENCES students(id) ON DELETE SET NULL,
  bill_number  TEXT NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  payment_mode payment_mode NOT NULL,
  sold_by      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  sale_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_sales_total_chk CHECK (total_amount >= 0),
  UNIQUE (school_id, bill_number)
);

CREATE TABLE IF NOT EXISTS inventory_sale_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  sale_id    UUID NOT NULL REFERENCES inventory_sales(id) ON DELETE CASCADE,
  item_id    UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity   INTEGER NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  total_price DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_sale_items_qty_chk CHECK (quantity > 0),
  CONSTRAINT inventory_sale_items_price_chk CHECK (unit_price >= 0 AND total_price >= 0)
);

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  item_id     UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  type        stock_adjustment_type NOT NULL,
  quantity    INTEGER NOT NULL,
  reason      TEXT,
  adjusted_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stock_adjustments_qty_non_zero_chk CHECK (quantity <> 0)
);

-- ─── TRIGGERS ───────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_updated_at_exams ON exams;
CREATE TRIGGER set_updated_at_exams
  BEFORE UPDATE ON exams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_marks ON marks;
CREATE TRIGGER set_updated_at_marks
  BEFORE UPDATE ON marks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_inventory_items ON inventory_items;
CREATE TRIGGER set_updated_at_inventory_items
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── INDEXES ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_grading_rules_school_class
  ON grading_rules(school_id, class_id);

CREATE INDEX IF NOT EXISTS idx_exams_school_class_status
  ON exams(school_id, class_id, status);

CREATE INDEX IF NOT EXISTS idx_exams_school_year
  ON exams(school_id, academic_year_id);

CREATE INDEX IF NOT EXISTS idx_exam_subjects_exam
  ON exam_subjects(exam_id);

CREATE INDEX IF NOT EXISTS idx_marks_exam_student
  ON marks(exam_id, student_id);

CREATE INDEX IF NOT EXISTS idx_marks_school_exam_subject
  ON marks(school_id, exam_subject_id);

CREATE INDEX IF NOT EXISTS idx_inventory_items_school_active
  ON inventory_items(school_id, is_active);

CREATE INDEX IF NOT EXISTS idx_inventory_items_stock
  ON inventory_items(school_id, stock_quantity);

CREATE INDEX IF NOT EXISTS idx_inventory_sales_school_date
  ON inventory_sales(school_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_sale_items_sale
  ON inventory_sale_items(sale_id);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_item_date
  ON stock_adjustments(item_id, created_at DESC);

-- ─── RLS ENABLE ─────────────────────────────────────────────

ALTER TABLE grading_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

-- ─── RLS POLICIES: GRADING RULES ────────────────────────────

DROP POLICY IF EXISTS super_admin_all_grading_rules ON grading_rules;
CREATE POLICY super_admin_all_grading_rules ON grading_rules
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS school_staff_read_grading_rules ON grading_rules;
CREATE POLICY school_staff_read_grading_rules ON grading_rules
  FOR SELECT TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['school_admin', 'teacher', 'manager', 'cashier']::user_role[])
  );

DROP POLICY IF EXISTS school_admin_manage_grading_rules ON grading_rules;
CREATE POLICY school_admin_manage_grading_rules ON grading_rules
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_school_admin())
  WITH CHECK (school_id = get_my_school_id() AND is_school_admin());

-- ─── RLS POLICIES: EXAMS ────────────────────────────────────

DROP POLICY IF EXISTS super_admin_all_exams ON exams;
CREATE POLICY super_admin_all_exams ON exams
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS school_staff_read_exams ON exams;
CREATE POLICY school_staff_read_exams ON exams
  FOR SELECT TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['school_admin', 'teacher', 'manager', 'cashier']::user_role[])
  );

DROP POLICY IF EXISTS school_admin_manage_exams ON exams;
CREATE POLICY school_admin_manage_exams ON exams
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_school_admin())
  WITH CHECK (school_id = get_my_school_id() AND is_school_admin());

-- ─── RLS POLICIES: EXAM SUBJECTS ────────────────────────────

DROP POLICY IF EXISTS super_admin_all_exam_subjects ON exam_subjects;
CREATE POLICY super_admin_all_exam_subjects ON exam_subjects
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS school_staff_read_exam_subjects ON exam_subjects;
CREATE POLICY school_staff_read_exam_subjects ON exam_subjects
  FOR SELECT TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['school_admin', 'teacher', 'manager', 'cashier']::user_role[])
  );

DROP POLICY IF EXISTS school_admin_manage_exam_subjects ON exam_subjects;
CREATE POLICY school_admin_manage_exam_subjects ON exam_subjects
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_school_admin())
  WITH CHECK (school_id = get_my_school_id() AND is_school_admin());

-- ─── RLS POLICIES: MARKS ────────────────────────────────────

DROP POLICY IF EXISTS super_admin_all_marks ON marks;
CREATE POLICY super_admin_all_marks ON marks
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS school_staff_read_marks ON marks;
CREATE POLICY school_staff_read_marks ON marks
  FOR SELECT TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['school_admin', 'teacher', 'manager', 'cashier']::user_role[])
  );

DROP POLICY IF EXISTS school_staff_insert_marks ON marks;
CREATE POLICY school_staff_insert_marks ON marks
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['school_admin', 'teacher']::user_role[])
    AND EXISTS (
      SELECT 1
      FROM exams ex
      WHERE ex.id = marks.exam_id
        AND ex.status = ANY (ARRAY['published', 'ongoing']::exam_status[])
    )
  );

DROP POLICY IF EXISTS school_staff_update_marks ON marks;
CREATE POLICY school_staff_update_marks ON marks
  FOR UPDATE TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['school_admin', 'teacher']::user_role[])
    AND EXISTS (
      SELECT 1
      FROM exams ex
      WHERE ex.id = marks.exam_id
        AND ex.status = ANY (ARRAY['published', 'ongoing']::exam_status[])
    )
  )
  WITH CHECK (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['school_admin', 'teacher']::user_role[])
    AND EXISTS (
      SELECT 1
      FROM exams ex
      WHERE ex.id = marks.exam_id
        AND ex.status = ANY (ARRAY['published', 'ongoing']::exam_status[])
    )
  );

DROP POLICY IF EXISTS school_admin_delete_marks ON marks;
CREATE POLICY school_admin_delete_marks ON marks
  FOR DELETE TO authenticated
  USING (school_id = get_my_school_id() AND is_school_admin());

-- ─── RLS POLICIES: INVENTORY ITEMS ──────────────────────────

DROP POLICY IF EXISTS super_admin_all_inventory_items ON inventory_items;
CREATE POLICY super_admin_all_inventory_items ON inventory_items
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS admin_manager_read_inventory_items ON inventory_items;
CREATE POLICY admin_manager_read_inventory_items ON inventory_items
  FOR SELECT TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager());

DROP POLICY IF EXISTS admin_manager_manage_inventory_items ON inventory_items;
CREATE POLICY admin_manager_manage_inventory_items ON inventory_items
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager())
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());

-- ─── RLS POLICIES: INVENTORY SALES ──────────────────────────

DROP POLICY IF EXISTS super_admin_all_inventory_sales ON inventory_sales;
CREATE POLICY super_admin_all_inventory_sales ON inventory_sales
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS admin_manager_read_inventory_sales ON inventory_sales;
CREATE POLICY admin_manager_read_inventory_sales ON inventory_sales
  FOR SELECT TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager());

DROP POLICY IF EXISTS admin_manager_manage_inventory_sales ON inventory_sales;
CREATE POLICY admin_manager_manage_inventory_sales ON inventory_sales
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager())
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());

-- ─── RLS POLICIES: INVENTORY SALE ITEMS ─────────────────────

DROP POLICY IF EXISTS super_admin_all_inventory_sale_items ON inventory_sale_items;
CREATE POLICY super_admin_all_inventory_sale_items ON inventory_sale_items
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS admin_manager_read_inventory_sale_items ON inventory_sale_items;
CREATE POLICY admin_manager_read_inventory_sale_items ON inventory_sale_items
  FOR SELECT TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager());

DROP POLICY IF EXISTS admin_manager_manage_inventory_sale_items ON inventory_sale_items;
CREATE POLICY admin_manager_manage_inventory_sale_items ON inventory_sale_items
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager())
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());

-- ─── RLS POLICIES: STOCK ADJUSTMENTS ────────────────────────

DROP POLICY IF EXISTS super_admin_all_stock_adjustments ON stock_adjustments;
CREATE POLICY super_admin_all_stock_adjustments ON stock_adjustments
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS admin_manager_read_stock_adjustments ON stock_adjustments;
CREATE POLICY admin_manager_read_stock_adjustments ON stock_adjustments
  FOR SELECT TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager());

DROP POLICY IF EXISTS admin_manager_manage_stock_adjustments ON stock_adjustments;
CREATE POLICY admin_manager_manage_stock_adjustments ON stock_adjustments
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager())
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());

-- ─── FUNCTIONS (RPC) ────────────────────────────────────────

CREATE OR REPLACE FUNCTION calculate_grade(
  p_school_id UUID,
  p_class_id UUID,
  p_percentage DECIMAL
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gr.grade_name
  FROM grading_rules gr
  WHERE gr.school_id = p_school_id
    AND (gr.class_id = p_class_id OR gr.class_id IS NULL)
    AND p_percentage >= gr.min_marks
    AND p_percentage <= gr.max_marks
  ORDER BY
    CASE WHEN gr.class_id IS NULL THEN 1 ELSE 0 END,
    gr.min_marks DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION publish_exam_results(
  p_exam_id UUID,
  p_notify_parents BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_marks_count INTEGER := 0;
  v_actor_profile_id UUID;
  v_updated INTEGER := 0;
BEGIN
  IF NOT (is_school_admin() OR is_super_admin()) THEN
    RAISE EXCEPTION 'Only school admin can publish results' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_actor_profile_id
  FROM user_profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  UPDATE exams
  SET
    status = 'locked',
    result_visible = TRUE,
    published_at = NOW(),
    published_by = COALESCE(v_actor_profile_id, published_by),
    updated_at = NOW()
  WHERE id = p_exam_id
    AND (is_super_admin() OR school_id = get_my_school_id());

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Exam not found or not permitted' USING ERRCODE = 'PGRST116';
  END IF;

  SELECT COUNT(*) INTO v_marks_count
  FROM marks
  WHERE exam_id = p_exam_id;

  RETURN jsonb_build_object(
    'exam_id', p_exam_id,
    'status', 'locked',
    'result_visible', TRUE,
    'marks_count', v_marks_count,
    'notify_parents', p_notify_parents
  );
END;
$$;

CREATE OR REPLACE FUNCTION unlock_exam_results(
  p_exam_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  IF NOT (is_school_admin() OR is_super_admin()) THEN
    RAISE EXCEPTION 'Only school admin can unlock results' USING ERRCODE = '42501';
  END IF;

  UPDATE exams
  SET
    status = 'published',
    updated_at = NOW()
  WHERE id = p_exam_id
    AND (is_super_admin() OR school_id = get_my_school_id());

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION adjust_stock(
  p_item_id UUID,
  p_quantity INTEGER,
  p_type stock_adjustment_type,
  p_reason TEXT DEFAULT NULL,
  p_adjusted_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
  v_current_stock INTEGER;
  v_new_stock INTEGER;
  v_delta INTEGER;
  v_actor_profile_id UUID;
BEGIN
  IF NOT (is_admin_or_manager() OR is_super_admin()) THEN
    RAISE EXCEPTION 'Only admin/manager can adjust stock' USING ERRCODE = '42501';
  END IF;

  IF p_type = ANY (ARRAY['add'::stock_adjustment_type, 'remove'::stock_adjustment_type])
     AND p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero for add/remove';
  END IF;

  IF p_type = 'adjustment'::stock_adjustment_type AND p_quantity = 0 THEN
    RAISE EXCEPTION 'Quantity cannot be zero for adjustment';
  END IF;

  SELECT school_id, stock_quantity
  INTO v_school_id, v_current_stock
  FROM inventory_items
  WHERE id = p_item_id
    AND (is_super_admin() OR school_id = get_my_school_id())
  FOR UPDATE;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Inventory item not found or not permitted' USING ERRCODE = 'PGRST116';
  END IF;

  v_delta := CASE
    WHEN p_type = 'add'::stock_adjustment_type THEN p_quantity
    WHEN p_type = 'remove'::stock_adjustment_type THEN -p_quantity
    WHEN p_type = 'sale'::stock_adjustment_type THEN -ABS(p_quantity)
    ELSE p_quantity
  END;

  v_new_stock := v_current_stock + v_delta;
  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'Insufficient stock for adjustment';
  END IF;

  IF p_adjusted_by IS NULL THEN
    SELECT id INTO v_actor_profile_id
    FROM user_profiles
    WHERE auth_user_id = auth.uid()
      AND (is_super_admin() OR school_id = v_school_id)
    LIMIT 1;
  ELSE
    v_actor_profile_id := p_adjusted_by;
  END IF;

  UPDATE inventory_items
  SET
    stock_quantity = v_new_stock,
    updated_at = NOW()
  WHERE id = p_item_id;

  INSERT INTO stock_adjustments(
    school_id,
    item_id,
    type,
    quantity,
    reason,
    adjusted_by
  )
  VALUES (
    v_school_id,
    p_item_id,
    p_type,
    v_delta,
    p_reason,
    v_actor_profile_id
  );

  RETURN jsonb_build_object(
    'item_id', p_item_id,
    'new_stock', v_new_stock,
    'delta', v_delta,
    'type', p_type
  );
END;
$$;

CREATE OR REPLACE FUNCTION create_inventory_sale(
  p_school_id UUID,
  p_student_id UUID DEFAULT NULL,
  p_items JSONB,
  p_payment_mode payment_mode,
  p_sold_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id UUID;
  v_bill_number TEXT;
  v_school_code TEXT;
  v_item JSONB;
  v_item_id UUID;
  v_quantity INTEGER;
  v_stock INTEGER;
  v_unit_price DECIMAL(12, 2);
  v_line_total DECIMAL(12, 2);
  v_total DECIMAL(12, 2) := 0;
  v_actor_profile_id UUID;
BEGIN
  IF NOT (is_admin_or_manager() OR is_super_admin()) THEN
    RAISE EXCEPTION 'Only admin/manager can create inventory sales' USING ERRCODE = '42501';
  END IF;

  IF NOT is_super_admin() AND p_school_id <> get_my_school_id() THEN
    RAISE EXCEPTION 'Cannot create sale for another school' USING ERRCODE = '42501';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Sale items are required';
  END IF;

  IF p_student_id IS NOT NULL THEN
    PERFORM 1
    FROM students
    WHERE id = p_student_id
      AND school_id = p_school_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Student does not belong to this school';
    END IF;
  END IF;

  IF p_sold_by IS NULL THEN
    SELECT id INTO v_actor_profile_id
    FROM user_profiles
    WHERE auth_user_id = auth.uid()
      AND (is_super_admin() OR school_id = p_school_id)
    LIMIT 1;
  ELSE
    v_actor_profile_id := p_sold_by;
  END IF;

  SELECT code INTO v_school_code
  FROM schools
  WHERE id = p_school_id;

  IF v_school_code IS NULL THEN
    RAISE EXCEPTION 'School not found';
  END IF;

  v_bill_number := UPPER(v_school_code)
    || '-INV-'
    || TO_CHAR(NOW(), 'YYYYMMDDHH24MISSMS')
    || '-'
    || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 4));

  INSERT INTO inventory_sales(
    school_id,
    student_id,
    bill_number,
    total_amount,
    payment_mode,
    sold_by
  )
  VALUES (
    p_school_id,
    p_student_id,
    v_bill_number,
    0,
    p_payment_mode,
    v_actor_profile_id
  )
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := (v_item->>'item_id')::UUID;
    v_quantity := COALESCE((v_item->>'quantity')::INTEGER, 0);

    IF v_item_id IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'Each sale item must include valid item_id and quantity > 0';
    END IF;

    SELECT stock_quantity, unit_price
    INTO v_stock, v_unit_price
    FROM inventory_items
    WHERE id = v_item_id
      AND school_id = p_school_id
      AND is_active = TRUE
    FOR UPDATE;

    IF v_stock IS NULL THEN
      RAISE EXCEPTION 'Item % not found or inactive', v_item_id;
    END IF;

    IF v_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for item %', v_item_id;
    END IF;

    IF v_item ? 'unit_price' AND NULLIF(v_item->>'unit_price', '') IS NOT NULL THEN
      v_unit_price := (v_item->>'unit_price')::DECIMAL(12, 2);
    END IF;

    IF v_unit_price < 0 THEN
      RAISE EXCEPTION 'Unit price cannot be negative';
    END IF;

    v_line_total := v_unit_price * v_quantity;
    v_total := v_total + v_line_total;

    UPDATE inventory_items
    SET
      stock_quantity = stock_quantity - v_quantity,
      updated_at = NOW()
    WHERE id = v_item_id;

    INSERT INTO inventory_sale_items(
      school_id,
      sale_id,
      item_id,
      quantity,
      unit_price,
      total_price
    )
    VALUES (
      p_school_id,
      v_sale_id,
      v_item_id,
      v_quantity,
      v_unit_price,
      v_line_total
    );

    INSERT INTO stock_adjustments(
      school_id,
      item_id,
      type,
      quantity,
      reason,
      adjusted_by
    )
    VALUES (
      p_school_id,
      v_item_id,
      'sale',
      -v_quantity,
      'POS sale ' || v_bill_number,
      v_actor_profile_id
    );
  END LOOP;

  UPDATE inventory_sales
  SET total_amount = v_total
  WHERE id = v_sale_id;

  RETURN jsonb_build_object(
    'sale_id', v_sale_id,
    'bill_number', v_bill_number,
    'total_amount', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION calculate_grade(UUID, UUID, DECIMAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION calculate_grade(UUID, UUID, DECIMAL) TO authenticated;

REVOKE ALL ON FUNCTION publish_exam_results(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION publish_exam_results(UUID, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION unlock_exam_results(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION unlock_exam_results(UUID) TO authenticated;

REVOKE ALL ON FUNCTION adjust_stock(UUID, INTEGER, stock_adjustment_type, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION adjust_stock(UUID, INTEGER, stock_adjustment_type, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION create_inventory_sale(UUID, UUID, JSONB, payment_mode, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_inventory_sale(UUID, UUID, JSONB, payment_mode, UUID) TO authenticated;
