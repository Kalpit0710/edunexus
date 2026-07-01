-- ─────────────────────────────────────────────────────────────────────────────
-- Bookstore POS: link inventory items to a class (book-set support)
--
-- Adds an optional class association to inventory items so the Point of Sale can
-- pull a whole class "book set" in one search. Items with a NULL class_id are
-- general items (e.g. pencils, uniforms) available to every class / walk-in.
--
-- RLS is unchanged: inventory_items remains scoped by school_id via existing
-- policies; class_id only ever references a class within the same school (an
-- application-level invariant enforced by the item CRUD actions).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_items_class
  ON inventory_items(school_id, class_id);
