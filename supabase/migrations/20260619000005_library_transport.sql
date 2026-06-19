-- ============================================================
-- Migration: 20260619000005_library_transport
-- EduNexus — Tier 1 / F1.8 Library lending, F1.9 Transport.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- F1.8 · LIBRARY
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS library_books (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  author           TEXT,
  isbn             TEXT,
  category         TEXT,
  shelf_location   TEXT,
  copies_total     INTEGER NOT NULL DEFAULT 1,
  copies_available INTEGER NOT NULL DEFAULT 1,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  CONSTRAINT library_books_copies_chk
    CHECK (copies_total >= 0 AND copies_available >= 0 AND copies_available <= copies_total)
);

CREATE INDEX IF NOT EXISTS idx_library_books_school ON library_books (school_id, title);

CREATE TABLE IF NOT EXISTS book_loans (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  book_id        UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  issued_date    DATE NOT NULL DEFAULT current_date,
  due_date       DATE NOT NULL,
  returned_date  DATE,
  status         TEXT NOT NULL DEFAULT 'issued',   -- issued | returned | lost
  fine_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  remarks        TEXT,
  issued_by      UUID,
  issued_by_name TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT book_loans_status_chk CHECK (status IN ('issued', 'returned', 'lost')),
  CONSTRAINT book_loans_fine_chk CHECK (fine_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_book_loans_school_status ON book_loans (school_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_book_loans_student ON book_loans (school_id, student_id);
-- One outstanding copy of a given title per student.
CREATE UNIQUE INDEX IF NOT EXISTS uq_book_loans_outstanding
  ON book_loans (book_id, student_id) WHERE status = 'issued';

ALTER TABLE library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_loans   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS books_super ON library_books;
CREATE POLICY books_super ON library_books FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());
DROP POLICY IF EXISTS books_member_read ON library_books;
CREATE POLICY books_member_read ON library_books FOR SELECT TO authenticated
  USING (school_id = get_my_school_id() AND deleted_at IS NULL);
DROP POLICY IF EXISTS books_admin_manage ON library_books;
CREATE POLICY books_admin_manage ON library_books FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager())
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());

DROP POLICY IF EXISTS loans_super ON book_loans;
CREATE POLICY loans_super ON book_loans FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());
DROP POLICY IF EXISTS loans_admin_manage ON book_loans;
CREATE POLICY loans_admin_manage ON book_loans FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager())
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());
DROP POLICY IF EXISTS loans_parent_read ON book_loans;
CREATE POLICY loans_parent_read ON book_loans FOR SELECT TO authenticated
  USING (
    school_id = get_my_school_id()
    AND EXISTS (
      SELECT 1 FROM parents p
      WHERE p.auth_user_id = auth.uid() AND p.student_id = book_loans.student_id
    )
  );

-- Atomic issue: validates availability, prevents duplicate outstanding loan,
-- inserts the loan and decrements the available count.
CREATE OR REPLACE FUNCTION issue_book(
  p_school_id  UUID,
  p_book_id    UUID,
  p_student_id UUID,
  p_due_date   DATE
) RETURNS book_loans
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_avail INTEGER;
  v_loan  book_loans;
BEGIN
  IF NOT (is_super_admin() OR (p_school_id = get_my_school_id() AND is_admin_or_manager())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT copies_available INTO v_avail
  FROM library_books
  WHERE id = p_book_id AND school_id = p_school_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Book not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_avail <= 0 THEN
    RAISE EXCEPTION 'No copies of this book are currently available' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM book_loans WHERE book_id = p_book_id AND student_id = p_student_id AND status = 'issued') THEN
    RAISE EXCEPTION 'This student already has this book on loan' USING ERRCODE = 'P0001';
  END IF;
  IF p_due_date < current_date THEN
    RAISE EXCEPTION 'Due date cannot be in the past' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO book_loans (school_id, book_id, student_id, due_date, status, issued_by, issued_by_name)
  VALUES (
    p_school_id, p_book_id, p_student_id, p_due_date, 'issued', auth.uid(),
    (SELECT full_name FROM user_profiles WHERE auth_user_id = auth.uid())
  ) RETURNING * INTO v_loan;

  UPDATE library_books SET copies_available = copies_available - 1, updated_at = now()
  WHERE id = p_book_id;

  RETURN v_loan;
END; $$;

-- Atomic return: closes the loan (returned or lost) and restores availability.
CREATE OR REPLACE FUNCTION return_book(
  p_loan_id       UUID,
  p_returned_date DATE,
  p_fine          NUMERIC,
  p_lost          BOOLEAN
) RETURNS book_loans
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_loan book_loans;
BEGIN
  SELECT * INTO v_loan FROM book_loans WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loan not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (is_super_admin() OR (v_loan.school_id = get_my_school_id() AND is_admin_or_manager())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF v_loan.status <> 'issued' THEN
    RAISE EXCEPTION 'This loan is already closed' USING ERRCODE = 'P0001';
  END IF;

  UPDATE book_loans
  SET status = CASE WHEN p_lost THEN 'lost' ELSE 'returned' END,
      returned_date = COALESCE(p_returned_date, current_date),
      fine_amount = GREATEST(COALESCE(p_fine, 0), 0),
      updated_at = now()
  WHERE id = p_loan_id
  RETURNING * INTO v_loan;

  IF p_lost THEN
    -- The copy is gone for good: drop it from the total (available was already
    -- decremented at issue time, so leave it as-is).
    UPDATE library_books SET copies_total = GREATEST(copies_total - 1, 0), updated_at = now()
    WHERE id = v_loan.book_id;
  ELSE
    UPDATE library_books SET copies_available = LEAST(copies_available + 1, copies_total), updated_at = now()
    WHERE id = v_loan.book_id;
  END IF;

  RETURN v_loan;
END; $$;

-- ════════════════════════════════════════════════════════════
-- F1.9 · TRANSPORT
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS buses (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id            UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  bus_number           TEXT NOT NULL,           -- internal label, e.g. "Bus 1"
  registration_number  TEXT,                    -- vehicle plate
  model                TEXT,
  capacity             INTEGER NOT NULL DEFAULT 0,
  route_name           TEXT,
  driver_name          TEXT,
  driver_phone         TEXT,
  driver_license       TEXT,
  attendant_name       TEXT,
  attendant_phone      TEXT,
  notes                TEXT,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ,
  CONSTRAINT buses_capacity_chk CHECK (capacity >= 0),
  UNIQUE (school_id, bus_number)
);

CREATE INDEX IF NOT EXISTS idx_buses_school ON buses (school_id);

CREATE TABLE IF NOT EXISTS bus_stops (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  bus_id      UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  pickup_time TIME,
  drop_time   TIME,
  stop_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bus_stops_bus ON bus_stops (bus_id, stop_order);

CREATE TABLE IF NOT EXISTS student_transport (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  bus_id       UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  stop_id      UUID REFERENCES bus_stops(id) ON DELETE SET NULL,
  pickup_point TEXT,
  fee_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT student_transport_fee_chk CHECK (fee_amount >= 0),
  UNIQUE (school_id, student_id)               -- one active bus per student
);

CREATE INDEX IF NOT EXISTS idx_student_transport_bus ON student_transport (bus_id);

ALTER TABLE buses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE bus_stops         ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_transport ENABLE ROW LEVEL SECURITY;

-- Buses + stops: readable by any school member (parents see their child's
-- driver details); managed by admin/manager.
DROP POLICY IF EXISTS buses_super ON buses;
CREATE POLICY buses_super ON buses FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());
DROP POLICY IF EXISTS buses_member_read ON buses;
CREATE POLICY buses_member_read ON buses FOR SELECT TO authenticated
  USING (school_id = get_my_school_id() AND deleted_at IS NULL);
DROP POLICY IF EXISTS buses_admin_manage ON buses;
CREATE POLICY buses_admin_manage ON buses FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager())
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());

DROP POLICY IF EXISTS stops_super ON bus_stops;
CREATE POLICY stops_super ON bus_stops FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());
DROP POLICY IF EXISTS stops_member_read ON bus_stops;
CREATE POLICY stops_member_read ON bus_stops FOR SELECT TO authenticated
  USING (school_id = get_my_school_id());
DROP POLICY IF EXISTS stops_admin_manage ON bus_stops;
CREATE POLICY stops_admin_manage ON bus_stops FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager())
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());

-- Assignments: admin manage; parents read only their own child's row.
DROP POLICY IF EXISTS transport_super ON student_transport;
CREATE POLICY transport_super ON student_transport FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());
DROP POLICY IF EXISTS transport_admin_manage ON student_transport;
CREATE POLICY transport_admin_manage ON student_transport FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager())
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());
DROP POLICY IF EXISTS transport_parent_read ON student_transport;
CREATE POLICY transport_parent_read ON student_transport FOR SELECT TO authenticated
  USING (
    school_id = get_my_school_id()
    AND EXISTS (
      SELECT 1 FROM parents p
      WHERE p.auth_user_id = auth.uid() AND p.student_id = student_transport.student_id
    )
  );

-- Atomic assignment with capacity + stop validation (upserts on student).
CREATE OR REPLACE FUNCTION assign_student_transport(
  p_school_id    UUID,
  p_student_id   UUID,
  p_bus_id       UUID,
  p_stop_id      UUID,
  p_pickup_point TEXT,
  p_fee          NUMERIC
) RETURNS student_transport
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cap   INTEGER;
  v_count INTEGER;
  v_row   student_transport;
BEGIN
  IF NOT (is_super_admin() OR (p_school_id = get_my_school_id() AND is_admin_or_manager())) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT capacity INTO v_cap
  FROM buses WHERE id = p_bus_id AND school_id = p_school_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bus not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_stop_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM bus_stops WHERE id = p_stop_id AND bus_id = p_bus_id
  ) THEN
    RAISE EXCEPTION 'Selected stop does not belong to this bus' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_count
  FROM student_transport
  WHERE bus_id = p_bus_id AND student_id <> p_student_id;

  IF v_cap > 0 AND v_count >= v_cap THEN
    RAISE EXCEPTION 'This bus is already at full capacity (% seats)', v_cap USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO student_transport (school_id, student_id, bus_id, stop_id, pickup_point, fee_amount)
  VALUES (p_school_id, p_student_id, p_bus_id, p_stop_id, p_pickup_point, COALESCE(p_fee, 0))
  ON CONFLICT (school_id, student_id) DO UPDATE
    SET bus_id = excluded.bus_id,
        stop_id = excluded.stop_id,
        pickup_point = excluded.pickup_point,
        fee_amount = excluded.fee_amount,
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END; $$;
