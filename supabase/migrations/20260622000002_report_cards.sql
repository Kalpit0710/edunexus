-- ============================================================
-- Migration: 20260622000002_report_cards
-- EduNexus — CBSE-style Report Card system.
-- Replaces the legacy exam/marks module (exams, exam_subjects,
-- marks + publish/unlock RPCs). `grading_rules` is RETAINED and
-- reused as the per-school grade scale.
-- ============================================================

-- ─── DROP LEGACY EXAM MODULE ────────────────────────────────
DROP FUNCTION IF EXISTS publish_exam_results(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS unlock_exam_results(UUID);

DROP TABLE IF EXISTS marks CASCADE;
DROP TABLE IF EXISTS exam_subjects CASCADE;
DROP TABLE IF EXISTS exams CASCADE;
DROP TYPE IF EXISTS exam_status;

-- ─── ENUM: report publication status ────────────────────────
DO $$
BEGIN
  CREATE TYPE report_status AS ENUM ('draft', 'published', 'locked');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- ─── CLASSES: report-card tier ──────────────────────────────
-- 'standard' = CBSE Term1/Term2 component model.
-- 'lower'    = dynamic component model for pre-primary classes.
ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS report_card_type TEXT NOT NULL DEFAULT 'standard';

DO $$
BEGIN
  ALTER TABLE classes
    ADD CONSTRAINT classes_report_card_type_chk
    CHECK (report_card_type IN ('standard', 'lower'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- ─── TABLE: per-class/subject mark configuration ────────────
-- Standard classes use `max_marks` jsonb:
--   {"term1":{"periodicTest":10,"notebook":5,"subEnrichment":5,"halfYearlyExam":80},
--    "term2":{"periodicTest":10,"notebook":5,"subEnrichment":5,"yearlyExam":80}}
-- Lower classes use `components` jsonb: [{"name":"Oral","maxMarks":20}, ...]
CREATE TABLE IF NOT EXISTS report_subject_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id      UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id    UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  max_marks     JSONB NOT NULL DEFAULT '{"term1":{"periodicTest":10,"notebook":5,"subEnrichment":5,"halfYearlyExam":80},"term2":{"periodicTest":10,"notebook":5,"subEnrichment":5,"yearlyExam":80}}'::jsonb,
  components    JSONB NOT NULL DEFAULT '[]'::jsonb,
  display_order INTEGER NOT NULL DEFAULT 0,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_report_subject_configs_class_subject
  ON report_subject_configs (class_id, subject_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_report_subject_configs_school_class
  ON report_subject_configs (school_id, class_id);

-- ─── TABLE: scholastic marks (per student × subject) ────────
-- term1/term2 are component-keyed objects, e.g. {"periodicTest":9,"notebook":5,...}
CREATE TABLE IF NOT EXISTS report_scholastic_marks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id  UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  term1       JSONB NOT NULL DEFAULT '{}'::jsonb,
  term2       JSONB NOT NULL DEFAULT '{}'::jsonb,
  entered_by  UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  entered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_report_scholastic_marks_school_class
  ON report_scholastic_marks (school_id, class_id);

CREATE INDEX IF NOT EXISTS idx_report_scholastic_marks_student
  ON report_scholastic_marks (student_id);

-- ─── TABLE: co-scholastic grades (per student × area) ───────
CREATE TABLE IF NOT EXISTS report_co_scholastic_marks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  area        TEXT NOT NULL,
  term1       TEXT,
  term2       TEXT,
  entered_by  UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, area)
);

CREATE INDEX IF NOT EXISTS idx_report_co_scholastic_marks_school
  ON report_co_scholastic_marks (school_id, student_id);

-- ─── TABLE: per-student term remarks / attendance / result ──
CREATE TABLE IF NOT EXISTS report_student_meta (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  term1_attendance  TEXT,
  term2_attendance  TEXT,
  remarks           TEXT,
  result_status     TEXT,
  entered_by        UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id)
);

CREATE INDEX IF NOT EXISTS idx_report_student_meta_school
  ON report_student_meta (school_id, student_id);

-- ─── TABLE: publication state (per class × academic year) ───
CREATE TABLE IF NOT EXISTS report_publications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id          UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  academic_year_id  UUID REFERENCES academic_years(id) ON DELETE SET NULL,
  status            report_status NOT NULL DEFAULT 'draft',
  result_visible    BOOLEAN NOT NULL DEFAULT FALSE,
  published_by      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  published_at      TIMESTAMPTZ,
  locked_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, academic_year_id)
);

CREATE INDEX IF NOT EXISTS idx_report_publications_school_class
  ON report_publications (school_id, class_id);

-- ─── TRIGGERS: updated_at ───────────────────────────────────
DROP TRIGGER IF EXISTS set_updated_at_report_subject_configs ON report_subject_configs;
CREATE TRIGGER set_updated_at_report_subject_configs
  BEFORE UPDATE ON report_subject_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_report_scholastic_marks ON report_scholastic_marks;
CREATE TRIGGER set_updated_at_report_scholastic_marks
  BEFORE UPDATE ON report_scholastic_marks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_report_co_scholastic_marks ON report_co_scholastic_marks;
CREATE TRIGGER set_updated_at_report_co_scholastic_marks
  BEFORE UPDATE ON report_co_scholastic_marks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_report_student_meta ON report_student_meta;
CREATE TRIGGER set_updated_at_report_student_meta
  BEFORE UPDATE ON report_student_meta
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_report_publications ON report_publications;
CREATE TRIGGER set_updated_at_report_publications
  BEFORE UPDATE ON report_publications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── RLS ENABLE ─────────────────────────────────────────────
ALTER TABLE report_subject_configs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_scholastic_marks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_co_scholastic_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_student_meta        ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_publications        ENABLE ROW LEVEL SECURITY;

-- ─── RLS: report_subject_configs ────────────────────────────
DROP POLICY IF EXISTS super_admin_all_report_subject_configs ON report_subject_configs;
CREATE POLICY super_admin_all_report_subject_configs ON report_subject_configs
  FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS staff_read_report_subject_configs ON report_subject_configs;
CREATE POLICY staff_read_report_subject_configs ON report_subject_configs
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['school_admin', 'teacher', 'manager', 'cashier']::user_role[])
  );

DROP POLICY IF EXISTS admin_manage_report_subject_configs ON report_subject_configs;
CREATE POLICY admin_manage_report_subject_configs ON report_subject_configs
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager())
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());

-- ─── RLS: report_scholastic_marks ───────────────────────────
DROP POLICY IF EXISTS super_admin_all_report_scholastic_marks ON report_scholastic_marks;
CREATE POLICY super_admin_all_report_scholastic_marks ON report_scholastic_marks
  FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS staff_read_report_scholastic_marks ON report_scholastic_marks;
CREATE POLICY staff_read_report_scholastic_marks ON report_scholastic_marks
  FOR SELECT TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['school_admin', 'teacher', 'manager', 'cashier']::user_role[])
  );

DROP POLICY IF EXISTS staff_write_report_scholastic_marks ON report_scholastic_marks;
CREATE POLICY staff_write_report_scholastic_marks ON report_scholastic_marks
  FOR ALL TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['school_admin', 'teacher', 'manager']::user_role[])
  )
  WITH CHECK (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['school_admin', 'teacher', 'manager']::user_role[])
  );

-- ─── RLS: report_co_scholastic_marks ────────────────────────
DROP POLICY IF EXISTS super_admin_all_report_co_scholastic_marks ON report_co_scholastic_marks;
CREATE POLICY super_admin_all_report_co_scholastic_marks ON report_co_scholastic_marks
  FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS staff_read_report_co_scholastic_marks ON report_co_scholastic_marks;
CREATE POLICY staff_read_report_co_scholastic_marks ON report_co_scholastic_marks
  FOR SELECT TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['school_admin', 'teacher', 'manager', 'cashier']::user_role[])
  );

DROP POLICY IF EXISTS staff_write_report_co_scholastic_marks ON report_co_scholastic_marks;
CREATE POLICY staff_write_report_co_scholastic_marks ON report_co_scholastic_marks
  FOR ALL TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['school_admin', 'teacher', 'manager']::user_role[])
  )
  WITH CHECK (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['school_admin', 'teacher', 'manager']::user_role[])
  );

-- ─── RLS: report_student_meta ───────────────────────────────
DROP POLICY IF EXISTS super_admin_all_report_student_meta ON report_student_meta;
CREATE POLICY super_admin_all_report_student_meta ON report_student_meta
  FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS staff_read_report_student_meta ON report_student_meta;
CREATE POLICY staff_read_report_student_meta ON report_student_meta
  FOR SELECT TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['school_admin', 'teacher', 'manager', 'cashier']::user_role[])
  );

DROP POLICY IF EXISTS staff_write_report_student_meta ON report_student_meta;
CREATE POLICY staff_write_report_student_meta ON report_student_meta
  FOR ALL TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['school_admin', 'teacher', 'manager']::user_role[])
  )
  WITH CHECK (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['school_admin', 'teacher', 'manager']::user_role[])
  );

-- ─── RLS: report_publications ───────────────────────────────
DROP POLICY IF EXISTS super_admin_all_report_publications ON report_publications;
CREATE POLICY super_admin_all_report_publications ON report_publications
  FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS staff_read_report_publications ON report_publications;
CREATE POLICY staff_read_report_publications ON report_publications
  FOR SELECT TO authenticated
  USING (
    school_id = get_my_school_id()
    AND get_my_role() = ANY (ARRAY['school_admin', 'teacher', 'manager', 'cashier']::user_role[])
  );

DROP POLICY IF EXISTS admin_manage_report_publications ON report_publications;
CREATE POLICY admin_manage_report_publications ON report_publications
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager())
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());

-- ─── RPC: publish / lock a class report ─────────────────────
CREATE OR REPLACE FUNCTION publish_class_report(
  p_class_id         UUID,
  p_academic_year_id UUID,
  p_result_visible   BOOLEAN DEFAULT TRUE,
  p_lock             BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id  UUID;
  v_actor      UUID;
  v_status     report_status;
  v_pub_id     UUID;
BEGIN
  -- Authorise: caller must be an admin/manager of the class's school.
  SELECT school_id INTO v_school_id FROM classes WHERE id = p_class_id;
  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Class not found' USING ERRCODE = 'PGRST116';
  END IF;

  IF NOT (is_super_admin() OR (v_school_id = get_my_school_id() AND is_admin_or_manager())) THEN
    RAISE EXCEPTION 'Not authorised to publish reports for this class';
  END IF;

  SELECT id INTO v_actor FROM user_profiles
  WHERE auth_user_id = auth.uid() AND school_id = v_school_id
  LIMIT 1;

  v_status := CASE WHEN p_lock THEN 'locked' ELSE 'published' END::report_status;

  INSERT INTO report_publications (
    school_id, class_id, academic_year_id, status, result_visible,
    published_by, published_at, locked_at
  )
  VALUES (
    v_school_id, p_class_id, p_academic_year_id, v_status, p_result_visible,
    v_actor, NOW(), CASE WHEN p_lock THEN NOW() ELSE NULL END
  )
  ON CONFLICT (class_id, academic_year_id) DO UPDATE
  SET status         = EXCLUDED.status,
      result_visible = EXCLUDED.result_visible,
      published_by   = EXCLUDED.published_by,
      published_at   = NOW(),
      locked_at      = CASE WHEN p_lock THEN NOW() ELSE NULL END,
      updated_at     = NOW()
  RETURNING id INTO v_pub_id;

  RETURN jsonb_build_object(
    'id', v_pub_id,
    'class_id', p_class_id,
    'status', v_status,
    'result_visible', p_result_visible
  );
END;
$$;

-- ─── RPC: unlock a class report (hide from parents) ─────────
CREATE OR REPLACE FUNCTION unlock_class_report(
  p_class_id         UUID,
  p_academic_year_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
BEGIN
  SELECT school_id INTO v_school_id FROM classes WHERE id = p_class_id;
  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Class not found' USING ERRCODE = 'PGRST116';
  END IF;

  IF NOT (is_super_admin() OR (v_school_id = get_my_school_id() AND is_admin_or_manager())) THEN
    RAISE EXCEPTION 'Not authorised to unlock reports for this class';
  END IF;

  UPDATE report_publications
  SET status = 'draft', result_visible = FALSE, locked_at = NULL, updated_at = NOW()
  WHERE class_id = p_class_id
    AND academic_year_id IS NOT DISTINCT FROM p_academic_year_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION publish_class_report(UUID, UUID, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION unlock_class_report(UUID, UUID) TO authenticated;
