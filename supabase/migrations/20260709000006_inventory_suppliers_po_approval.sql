-- ============================================================
-- Migration: 20260709000006_inventory_suppliers_po_approval
-- EduNexus — Supplier master + PO maker-checker approval matrix
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inventory_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, name)
);

CREATE INDEX IF NOT EXISTS idx_inventory_suppliers_school_active
ON public.inventory_suppliers (school_id, is_active, name);

DROP TRIGGER IF EXISTS set_updated_at_inventory_suppliers ON public.inventory_suppliers;
CREATE TRIGGER set_updated_at_inventory_suppliers
  BEFORE UPDATE ON public.inventory_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.inventory_suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS super_admin_all_inventory_suppliers ON public.inventory_suppliers;
CREATE POLICY super_admin_all_inventory_suppliers ON public.inventory_suppliers
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS admin_manager_all_inventory_suppliers ON public.inventory_suppliers;
CREATE POLICY admin_manager_all_inventory_suppliers ON public.inventory_suppliers
  FOR ALL TO authenticated
  USING (school_id = public.get_my_school_id() AND public.is_admin_or_manager())
  WITH CHECK (school_id = public.get_my_school_id() AND public.is_admin_or_manager());

ALTER TABLE public.inventory_purchase_orders
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.inventory_suppliers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approval_notes TEXT,
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.user_profiles(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventory_purchase_orders'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.inventory_purchase_orders
      DROP CONSTRAINT IF EXISTS inventory_purchase_orders_status_check;

    ALTER TABLE public.inventory_purchase_orders
      ADD CONSTRAINT inventory_purchase_orders_status_check
      CHECK (status IN ('draft', 'pending_approval', 'approved', 'partially_received', 'received', 'rejected', 'cancelled'));
  END IF;
END $$;

INSERT INTO public.inventory_suppliers (school_id, name, created_at, updated_at)
SELECT DISTINCT po.school_id, po.vendor_name, NOW(), NOW()
FROM public.inventory_purchase_orders po
LEFT JOIN public.inventory_suppliers s
  ON s.school_id = po.school_id
 AND LOWER(s.name) = LOWER(po.vendor_name)
WHERE po.vendor_name IS NOT NULL
  AND btrim(po.vendor_name) <> ''
  AND s.id IS NULL;

UPDATE public.inventory_purchase_orders po
SET supplier_id = s.id,
    status = CASE
      WHEN po.status = 'ordered' THEN 'pending_approval'
      ELSE po.status
    END
FROM public.inventory_suppliers s
WHERE po.school_id = s.school_id
  AND po.supplier_id IS NULL
  AND LOWER(po.vendor_name) = LOWER(s.name);

DROP FUNCTION IF EXISTS public.create_inventory_purchase_order(UUID, TEXT, DATE, DATE, TEXT, UUID, JSONB);
DROP FUNCTION IF EXISTS public.create_inventory_purchase_order(UUID, UUID, DATE, DATE, TEXT, UUID, JSONB);
CREATE OR REPLACE FUNCTION public.create_inventory_purchase_order(
  p_school_id UUID,
  p_supplier_id UUID,
  p_order_date DATE DEFAULT CURRENT_DATE,
  p_expected_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_requested_by UUID DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po_id UUID;
  v_po_number TEXT;
  v_school_code TEXT;
  v_actor_profile_id UUID;
  v_item JSONB;
  v_item_id UUID;
  v_qty INTEGER;
  v_unit_cost NUMERIC(12, 2);
  v_item_count INTEGER := 0;
  v_supplier_name TEXT;
BEGIN
  IF NOT (is_super_admin() OR is_admin_or_manager()) THEN
    RAISE EXCEPTION 'Only admin/manager can create purchase orders' USING ERRCODE = '42501';
  END IF;

  IF NOT is_super_admin() AND p_school_id <> get_my_school_id() THEN
    RAISE EXCEPTION 'Cannot create purchase order for another school' USING ERRCODE = '42501';
  END IF;

  SELECT name INTO v_supplier_name
  FROM inventory_suppliers
  WHERE id = p_supplier_id
    AND school_id = p_school_id
    AND is_active = TRUE;

  IF v_supplier_name IS NULL THEN
    RAISE EXCEPTION 'Active supplier not found for this school';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one PO item is required';
  END IF;

  IF p_requested_by IS NULL THEN
    SELECT id INTO v_actor_profile_id
    FROM user_profiles
    WHERE auth_user_id = auth.uid()
      AND (is_super_admin() OR school_id = p_school_id)
    LIMIT 1;
  ELSE
    v_actor_profile_id := p_requested_by;
  END IF;

  SELECT code INTO v_school_code
  FROM schools
  WHERE id = p_school_id;

  IF v_school_code IS NULL THEN
    RAISE EXCEPTION 'School not found';
  END IF;

  v_po_number := UPPER(v_school_code)
    || '-PO-'
    || TO_CHAR(NOW(), 'YYYYMMDDHH24MISSMS')
    || '-'
    || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 4));

  INSERT INTO inventory_purchase_orders(
    school_id,
    supplier_id,
    po_number,
    vendor_name,
    order_date,
    expected_date,
    status,
    notes,
    requested_by
  ) VALUES (
    p_school_id,
    p_supplier_id,
    v_po_number,
    v_supplier_name,
    COALESCE(p_order_date, CURRENT_DATE),
    p_expected_date,
    'pending_approval',
    NULLIF(btrim(p_notes), ''),
    v_actor_profile_id
  ) RETURNING id INTO v_po_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := (v_item->>'item_id')::UUID;
    v_qty := COALESCE((v_item->>'ordered_quantity')::INTEGER, 0);
    v_unit_cost := COALESCE((v_item->>'unit_cost')::NUMERIC, -1);

    IF v_item_id IS NULL OR v_qty <= 0 OR v_unit_cost < 0 THEN
      RAISE EXCEPTION 'Each PO item requires item_id, ordered_quantity > 0, and unit_cost >= 0';
    END IF;

    PERFORM 1
    FROM inventory_items
    WHERE id = v_item_id
      AND school_id = p_school_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PO item % does not belong to this school', v_item_id;
    END IF;

    INSERT INTO inventory_purchase_order_items(
      school_id,
      purchase_order_id,
      item_id,
      ordered_quantity,
      unit_cost,
      received_quantity
    ) VALUES (
      p_school_id,
      v_po_id,
      v_item_id,
      v_qty,
      v_unit_cost,
      0
    );

    v_item_count := v_item_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'purchase_order_id', v_po_id,
    'po_number', v_po_number,
    'item_count', v_item_count,
    'status', 'pending_approval'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_inventory_purchase_order(UUID, UUID, DATE, DATE, TEXT, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_inventory_purchase_order(UUID, UUID, DATE, DATE, TEXT, UUID, JSONB) TO authenticated;

DROP FUNCTION IF EXISTS public.review_inventory_purchase_order(UUID, TEXT, UUID, TEXT);
CREATE OR REPLACE FUNCTION public.review_inventory_purchase_order(
  p_purchase_order_id UUID,
  p_decision TEXT,
  p_reviewed_by UUID DEFAULT NULL,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po inventory_purchase_orders%ROWTYPE;
  v_actor_profile_id UUID;
  v_reviewer UUID;
BEGIN
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decision must be approved or rejected';
  END IF;

  SELECT * INTO v_po
  FROM inventory_purchase_orders
  WHERE id = p_purchase_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order not found' USING ERRCODE = 'PGRST116';
  END IF;

  IF NOT (is_super_admin() OR (v_po.school_id = get_my_school_id() AND is_school_admin())) THEN
    RAISE EXCEPTION 'Only school admin can review purchase orders' USING ERRCODE = '42501';
  END IF;

  IF v_po.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Only pending-approval POs can be reviewed';
  END IF;

  SELECT id INTO v_actor_profile_id
  FROM user_profiles
  WHERE auth_user_id = auth.uid()
    AND (is_super_admin() OR school_id = v_po.school_id)
  LIMIT 1;

  v_reviewer := COALESCE(p_reviewed_by, v_actor_profile_id);

  IF v_reviewer IS NOT NULL AND v_po.requested_by IS NOT NULL AND v_reviewer = v_po.requested_by THEN
    RAISE EXCEPTION 'Maker-checker violation: requester cannot approve their own PO';
  END IF;

  UPDATE inventory_purchase_orders
  SET status = p_decision,
      reviewed_by = v_reviewer,
      reviewed_at = NOW(),
      approved_by = CASE WHEN p_decision = 'approved' THEN v_reviewer ELSE approved_by END,
      approval_notes = NULLIF(btrim(p_review_notes), ''),
      updated_at = NOW()
  WHERE id = p_purchase_order_id;

  RETURN jsonb_build_object(
    'purchase_order_id', p_purchase_order_id,
    'status', p_decision
  );
END;
$$;

REVOKE ALL ON FUNCTION public.review_inventory_purchase_order(UUID, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_inventory_purchase_order(UUID, TEXT, UUID, TEXT) TO authenticated;

DROP FUNCTION IF EXISTS public.receive_inventory_purchase_order(UUID, UUID, DATE, TEXT, JSONB);
CREATE OR REPLACE FUNCTION public.receive_inventory_purchase_order(
  p_purchase_order_id UUID,
  p_received_by UUID DEFAULT NULL,
  p_received_date DATE DEFAULT CURRENT_DATE,
  p_notes TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_po inventory_purchase_orders%ROWTYPE;
  v_grn_id UUID;
  v_grn_number TEXT;
  v_actor_profile_id UUID;
  v_received_by UUID;
  v_item JSONB;
  v_po_item inventory_purchase_order_items%ROWTYPE;
  v_receive_qty INTEGER;
  v_open_lines INTEGER;
  v_school_code TEXT;
BEGIN
  SELECT * INTO v_po
  FROM inventory_purchase_orders
  WHERE id = p_purchase_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order not found' USING ERRCODE = 'PGRST116';
  END IF;

  IF NOT (is_super_admin() OR (v_po.school_id = get_my_school_id() AND is_admin_or_manager())) THEN
    RAISE EXCEPTION 'Cannot receive a purchase order for another school' USING ERRCODE = '42501';
  END IF;

  IF v_po.status NOT IN ('approved', 'partially_received') THEN
    RAISE EXCEPTION 'Only approved or partially received POs can be received';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one received line item is required';
  END IF;

  IF p_received_by IS NULL THEN
    SELECT id INTO v_actor_profile_id
    FROM user_profiles
    WHERE auth_user_id = auth.uid()
      AND (is_super_admin() OR school_id = v_po.school_id)
    LIMIT 1;
    v_received_by := v_actor_profile_id;
  ELSE
    v_received_by := p_received_by;
  END IF;

  SELECT code INTO v_school_code
  FROM schools
  WHERE id = v_po.school_id;

  v_grn_number := UPPER(v_school_code)
    || '-GRN-'
    || TO_CHAR(NOW(), 'YYYYMMDDHH24MISSMS')
    || '-'
    || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 4));

  INSERT INTO inventory_goods_receipts(
    school_id,
    purchase_order_id,
    grn_number,
    received_date,
    notes,
    received_by,
    status
  ) VALUES (
    v_po.school_id,
    v_po.id,
    v_grn_number,
    COALESCE(p_received_date, CURRENT_DATE),
    NULLIF(btrim(p_notes), ''),
    v_received_by,
    'recorded'
  ) RETURNING id INTO v_grn_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_po_item
    FROM inventory_purchase_order_items
    WHERE id = (v_item->>'purchase_order_item_id')::UUID
      AND purchase_order_id = v_po.id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid purchase order item in receipt payload';
    END IF;

    v_receive_qty := COALESCE((v_item->>'quantity_received')::INTEGER, 0);

    IF v_receive_qty <= 0 THEN
      RAISE EXCEPTION 'Received quantity must be > 0 for all received lines';
    END IF;

    IF (v_po_item.received_quantity + v_receive_qty) > v_po_item.ordered_quantity THEN
      RAISE EXCEPTION 'Received quantity exceeds ordered quantity for PO line %', v_po_item.id;
    END IF;

    UPDATE inventory_purchase_order_items
    SET received_quantity = received_quantity + v_receive_qty
    WHERE id = v_po_item.id;

    INSERT INTO inventory_goods_receipt_items(
      school_id,
      goods_receipt_id,
      purchase_order_item_id,
      item_id,
      quantity_received,
      unit_cost
    ) VALUES (
      v_po.school_id,
      v_grn_id,
      v_po_item.id,
      v_po_item.item_id,
      v_receive_qty,
      v_po_item.unit_cost
    );

    UPDATE inventory_items
    SET
      stock_quantity = stock_quantity + v_receive_qty,
      updated_at = NOW()
    WHERE id = v_po_item.item_id
      AND school_id = v_po.school_id;

    INSERT INTO stock_adjustments(
      school_id,
      item_id,
      type,
      quantity,
      reason,
      adjusted_by
    ) VALUES (
      v_po.school_id,
      v_po_item.item_id,
      'add',
      v_receive_qty,
      'GRN ' || v_grn_number || ' against PO ' || v_po.po_number,
      v_received_by
    );
  END LOOP;

  SELECT COUNT(*) INTO v_open_lines
  FROM inventory_purchase_order_items
  WHERE purchase_order_id = v_po.id
    AND received_quantity < ordered_quantity;

  UPDATE inventory_purchase_orders
  SET
    status = CASE WHEN v_open_lines = 0 THEN 'received' ELSE 'partially_received' END,
    updated_at = NOW(),
    approved_by = COALESCE(approved_by, v_received_by)
  WHERE id = v_po.id;

  UPDATE inventory_goods_receipts
  SET status = CASE WHEN v_open_lines = 0 THEN 'recorded' ELSE 'partial' END
  WHERE id = v_grn_id;

  RETURN jsonb_build_object(
    'goods_receipt_id', v_grn_id,
    'grn_number', v_grn_number,
    'purchase_order_status', CASE WHEN v_open_lines = 0 THEN 'received' ELSE 'partially_received' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.receive_inventory_purchase_order(UUID, UUID, DATE, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.receive_inventory_purchase_order(UUID, UUID, DATE, TEXT, JSONB) TO authenticated;
