-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill: link existing book items to their class (book-set support).
--
-- Matches a class/grade number embedded in a book item's name (e.g.
-- "… Grade 10" or "Class 10 …") to a class in the SAME school, and sets
-- inventory_items.class_id so the item shows up in that class's POS book set.
--
-- Idempotent & conservative:
--   • only touches rows where class_id IS NULL,
--   • only category = 'book' (uniforms / stationery / etc. stay General),
--   • only matches when the class name has a numeric part and it appears in the
--     item name preceded by "grade"/"class" (so "Class 1" never matches "… 10").
-- General items are intentionally left unlinked and remain sellable to anyone.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE inventory_items AS i
SET class_id = c.id,
    updated_at = NOW()
FROM classes AS c
WHERE i.class_id IS NULL
  AND i.category = 'book'
  AND c.school_id = i.school_id
  AND regexp_replace(c.name, '\D', '', 'g') <> ''
  AND i.name ~* ('(grade|class)\s*' || regexp_replace(c.name, '\D', '', 'g') || '(\D|$)');
