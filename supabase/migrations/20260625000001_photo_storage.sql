-- ─────────────────────────────────────────────────────────────────────────────
-- Proper photo storage + teacher photos
--
--  Until now the `student-photos` and `school-logos` buckets were assumed to
--  exist (uploads created them implicitly / failed soft). This migration makes
--  storage first-class and reproducible:
--
--   • Declares the photo buckets (student-photos, teacher-photos, school-logos)
--     idempotently as PUBLIC buckets so the stored URLs render anywhere
--     (student profile, report card, fee slip, teacher profile) without a signed
--     URL round-trip.
--   • Adds tenant-scoped write policies on storage.objects: a member may only
--     write under their own school's folder (path = "<school_id>/<file>"),
--     super admins may write anywhere. Reads are public (buckets are public).
--   • Adds teachers.photo_url for the teacher profile photo (parity with
--     students.photo_url and teachers.signature_url).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Buckets ──────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('student-photos', 'student-photos', TRUE),
  ('teacher-photos', 'teacher-photos', TRUE),
  ('school-logos',   'school-logos',   TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

-- ── Write policies (tenant-scoped) ───────────────────────────────────────────
-- All photo objects are keyed "<school_id>/<filename>" so the first path segment
-- identifies the owning school. Members may only write within their own school;
-- super admins may write anywhere. Mirrors the is_super_admin()/get_my_school_id()
-- tenant guard used by the SECURITY DEFINER RPCs.

DO $$
DECLARE
  b TEXT;
BEGIN
  FOREACH b IN ARRAY ARRAY['student-photos', 'teacher-photos', 'school-logos']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_read');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_insert');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_update');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_delete');

    -- Public read (buckets are public; this also allows authenticated listing).
    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR SELECT USING (bucket_id = %L)',
      b || '_read', b
    );

    -- Tenant-scoped insert/update/delete for authenticated users.
    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated '
      || 'WITH CHECK (bucket_id = %L AND (is_super_admin() '
      || 'OR (storage.foldername(name))[1] = get_my_school_id()::text))',
      b || '_insert', b
    );
    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated '
      || 'USING (bucket_id = %L AND (is_super_admin() '
      || 'OR (storage.foldername(name))[1] = get_my_school_id()::text))',
      b || '_update', b
    );
    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated '
      || 'USING (bucket_id = %L AND (is_super_admin() '
      || 'OR (storage.foldername(name))[1] = get_my_school_id()::text))',
      b || '_delete', b
    );
  END LOOP;
END $$;

-- ── Teacher profile photo ────────────────────────────────────────────────────
ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

COMMENT ON COLUMN teachers.photo_url IS 'Teacher profile photo URL (teacher-photos bucket), shown on teacher profile and documents.';
