-- ============================================================
-- Migration: 20260709000004_inventory_procurement_and_audit
-- EduNexus — Procurement lifecycle + sale-control audit reporting
--
-- Adds:
-- 1) Purchase order + GRN + vendor-return + damage-adjustment tables
-- 2) Transactional RPCs for PO creation/receiving and stock-safe reversals
-- 3) Audit RPC for sale-control SLA/aging/reversal reporting
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inventory_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  po_number TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,
  status TEXT NOT NULL DEFAULT 'ordered' CHECK (status IN ('draft', 'ordered', 'partially_received', 'received', 'cancelled')),
  notes TEXT,
  requested_by UUID REFERENCES user_profiles(id),
  approved_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, po_number)
);

CREATE TABLE IF NOT EXISTS public.inventory_purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES inventory_purchase_orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  ordered_quantity INTEGER NOT NULL CHECK (ordered_quantity > 0),
  unit_cost NUMERIC(12, 2) NOT NULL CHECK (unit_cost >= 0),
  received_quantity INTEGER NOT NULL DEFAULT 0 CHECK (received_quantity >= 0 AND received_quantity <= ordered_quantity),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES inventory_purchase_orders(id) ON DELETE CASCADE,
  grn_number TEXT NOT NULL,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'partial')),
  notes TEXT,
  received_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, grn_number)
);

CREATE TABLE IF NOT EXISTS public.inventory_goods_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  goods_receipt_id UUID NOT NULL REFERENCES inventory_goods_receipts(id) ON DELETE CASCADE,
  purchase_order_item_id UUID NOT NULL REFERENCES inventory_purchase_order_items(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity_received INTEGER NOT NULL CHECK (quantity_received > 0),
  unit_cost NUMERIC(12, 2) NOT NULL CHECK (unit_cost >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_vendor_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  purchase_order_id UUID REFERENCES inventory_purchase_orders(id) ON DELETE SET NULL,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT NOT NULL,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_damage_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT NOT NULL,
  damage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_po_school_status
ON public.inventory_purchase_orders (school_id, status, order_date DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_po_items_po
ON public.inventory_purchase_order_items (purchase_order_id, item_id);

CREATE INDEX IF NOT EXISTS idx_inventory_grn_school_date
ON public.inventory_goods_receipts (school_id, received_date DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_vendor_returns_school_date
ON public.inventory_vendor_returns (school_id, return_date DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_damage_adjustments_school_date
ON public.inventory_damage_adjustments (school_id, damage_date DESC);

DROP TRIGGER IF EXISTS set_updated_at_inventory_purchase_orders ON public.inventory_purchase_orders;
CREATE TRIGGER set_updated_at_inventory_purchase_orders
  BEFORE UPDATE ON public.inventory_purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.inventory_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_vendor_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_damage_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS super_admin_all_inventory_purchase_orders ON public.inventory_purchase_orders;
CREATE POLICY super_admin_all_inventory_purchase_orders ON public.inventory_purchase_orders
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS admin_manager_all_inventory_purchase_orders ON public.inventory_purchase_orders;
CREATE POLICY admin_manager_all_inventory_purchase_orders ON public.inventory_purchase_orders
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager())
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());

DROP POLICY IF EXISTS super_admin_all_inventory_purchase_order_items ON public.inventory_purchase_order_items;
CREATE POLICY super_admin_all_inventory_purchase_order_items ON public.inventory_purchase_order_items
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS admin_manager_all_inventory_purchase_order_items ON public.inventory_purchase_order_items;
CREATE POLICY admin_manager_all_inventory_purchase_order_items ON public.inventory_purchase_order_items
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager())
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());

DROP POLICY IF EXISTS super_admin_all_inventory_goods_receipts ON public.inventory_goods_receipts;
CREATE POLICY super_admin_all_inventory_goods_receipts ON public.inventory_goods_receipts
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS admin_manager_all_inventory_goods_receipts ON public.inventory_goods_receipts;
CREATE POLICY admin_manager_all_inventory_goods_receipts ON public.inventory_goods_receipts
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager())
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());

DROP POLICY IF EXISTS super_admin_all_inventory_goods_receipt_items ON public.inventory_goods_receipt_items;
CREATE POLICY super_admin_all_inventory_goods_receipt_items ON public.inventory_goods_receipt_items
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS admin_manager_all_inventory_goods_receipt_items ON public.inventory_goods_receipt_items;
CREATE POLICY admin_manager_all_inventory_goods_receipt_items ON public.inventory_goods_receipt_items
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager())
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());

DROP POLICY IF EXISTS super_admin_all_inventory_vendor_returns ON public.inventory_vendor_returns;
CREATE POLICY super_admin_all_inventory_vendor_returns ON public.inventory_vendor_returns
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS admin_manager_all_inventory_vendor_returns ON public.inventory_vendor_returns;
CREATE POLICY admin_manager_all_inventory_vendor_returns ON public.inventory_vendor_returns
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager())
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());

DROP POLICY IF EXISTS super_admin_all_inventory_damage_adjustments ON public.inventory_damage_adjustments;
CREATE POLICY super_admin_all_inventory_damage_adjustments ON public.inventory_damage_adjustments
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS admin_manager_all_inventory_damage_adjustments ON public.inventory_damage_adjustments;
CREATE POLICY admin_manager_all_inventory_damage_adjustments ON public.inventory_damage_adjustments
  FOR ALL TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager())
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());

DROP FUNCTION IF EXISTS public.create_inventory_purchase_order(UUID, TEXT, DATE, DATE, TEXT, UUID, JSONB);
CREATE OR REPLACE FUNCTION public.create_inventory_purchase_order(
  p_school_id UUID,
  p_vendor_name TEXT,
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
BEGIN
  IF NOT (is_super_admin() OR is_admin_or_manager()) THEN
    RAISE EXCEPTION 'Only admin/manager can create purchase orders' USING ERRCODE = '42501';
  END IF;

  IF NOT is_super_admin() AND p_school_id <> get_my_school_id() THEN
    RAISE EXCEPTION 'Cannot create purchase order for another school' USING ERRCODE = '42501';
  END IF;

  IF btrim(COALESCE(p_vendor_name, '')) = '' THEN
    RAISE EXCEPTION 'Vendor name is required';
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
    po_number,
    vendor_name,
    order_date,
    expected_date,
    status,
    notes,
    requested_by
  ) VALUES (
    p_school_id,
    v_po_number,
    btrim(p_vendor_name),
    COALESCE(p_order_date, CURRENT_DATE),
    p_expected_date,
    'ordered',
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
    'item_count', v_item_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_inventory_purchase_order(UUID, TEXT, DATE, DATE, TEXT, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_inventory_purchase_order(UUID, TEXT, DATE, DATE, TEXT, UUID, JSONB) TO authenticated;

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

  IF v_po.status NOT IN ('ordered', 'partially_received') THEN
    RAISE EXCEPTION 'Only ordered or partially received POs can be received';
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

DROP FUNCTION IF EXISTS public.record_inventory_vendor_return(UUID, UUID, INTEGER, TEXT, UUID, UUID, DATE);
CREATE OR REPLACE FUNCTION public.record_inventory_vendor_return(
  p_school_id UUID,
  p_item_id UUID,
  p_quantity INTEGER,
  p_reason TEXT,
  p_recorded_by UUID DEFAULT NULL,
  p_purchase_order_id UUID DEFAULT NULL,
  p_return_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock INTEGER;
  v_actor_profile_id UUID;
  v_recorded_by UUID;
  v_return_id UUID;
BEGIN
  IF NOT (is_super_admin() OR is_admin_or_manager()) THEN
    RAISE EXCEPTION 'Only admin/manager can record vendor returns' USING ERRCODE = '42501';
  END IF;

  IF NOT is_super_admin() AND p_school_id <> get_my_school_id() THEN
    RAISE EXCEPTION 'Cannot record vendor return for another school' USING ERRCODE = '42501';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Return quantity must be greater than zero';
  END IF;

  IF btrim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Return reason is required';
  END IF;

  SELECT stock_quantity INTO v_stock
  FROM inventory_items
  WHERE id = p_item_id
    AND school_id = p_school_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found';
  END IF;

  IF v_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock for vendor return';
  END IF;

  IF p_recorded_by IS NULL THEN
    SELECT id INTO v_actor_profile_id
    FROM user_profiles
    WHERE auth_user_id = auth.uid()
      AND (is_super_admin() OR school_id = p_school_id)
    LIMIT 1;
    v_recorded_by := v_actor_profile_id;
  ELSE
    v_recorded_by := p_recorded_by;
  END IF;

  INSERT INTO inventory_vendor_returns(
    school_id,
    purchase_order_id,
    item_id,
    quantity,
    reason,
    return_date,
    recorded_by
  ) VALUES (
    p_school_id,
    p_purchase_order_id,
    p_item_id,
    p_quantity,
    btrim(p_reason),
    COALESCE(p_return_date, CURRENT_DATE),
    v_recorded_by
  ) RETURNING id INTO v_return_id;

  UPDATE inventory_items
  SET
    stock_quantity = stock_quantity - p_quantity,
    updated_at = NOW()
  WHERE id = p_item_id
    AND school_id = p_school_id;

  INSERT INTO stock_adjustments(
    school_id,
    item_id,
    type,
    quantity,
    reason,
    adjusted_by
  ) VALUES (
    p_school_id,
    p_item_id,
    'remove',
    -p_quantity,
    'Vendor return: ' || btrim(p_reason),
    v_recorded_by
  );

  RETURN jsonb_build_object(
    'vendor_return_id', v_return_id,
    'item_id', p_item_id,
    'quantity', p_quantity
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_inventory_vendor_return(UUID, UUID, INTEGER, TEXT, UUID, UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_inventory_vendor_return(UUID, UUID, INTEGER, TEXT, UUID, UUID, DATE) TO authenticated;

DROP FUNCTION IF EXISTS public.record_inventory_damage_adjustment(UUID, UUID, INTEGER, TEXT, UUID, DATE);
CREATE OR REPLACE FUNCTION public.record_inventory_damage_adjustment(
  p_school_id UUID,
  p_item_id UUID,
  p_quantity INTEGER,
  p_reason TEXT,
  p_recorded_by UUID DEFAULT NULL,
  p_damage_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock INTEGER;
  v_actor_profile_id UUID;
  v_recorded_by UUID;
  v_damage_id UUID;
BEGIN
  IF NOT (is_super_admin() OR is_admin_or_manager()) THEN
    RAISE EXCEPTION 'Only admin/manager can record damages' USING ERRCODE = '42501';
  END IF;

  IF NOT is_super_admin() AND p_school_id <> get_my_school_id() THEN
    RAISE EXCEPTION 'Cannot record damage for another school' USING ERRCODE = '42501';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Damage quantity must be greater than zero';
  END IF;

  IF btrim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Damage reason is required';
  END IF;

  SELECT stock_quantity INTO v_stock
  FROM inventory_items
  WHERE id = p_item_id
    AND school_id = p_school_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found';
  END IF;

  IF v_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock for damage adjustment';
  END IF;

  IF p_recorded_by IS NULL THEN
    SELECT id INTO v_actor_profile_id
    FROM user_profiles
    WHERE auth_user_id = auth.uid()
      AND (is_super_admin() OR school_id = p_school_id)
    LIMIT 1;
    v_recorded_by := v_actor_profile_id;
  ELSE
    v_recorded_by := p_recorded_by;
  END IF;

  INSERT INTO inventory_damage_adjustments(
    school_id,
    item_id,
    quantity,
    reason,
    damage_date,
    recorded_by
  ) VALUES (
    p_school_id,
    p_item_id,
    p_quantity,
    btrim(p_reason),
    COALESCE(p_damage_date, CURRENT_DATE),
    v_recorded_by
  ) RETURNING id INTO v_damage_id;

  UPDATE inventory_items
  SET
    stock_quantity = stock_quantity - p_quantity,
    updated_at = NOW()
  WHERE id = p_item_id
    AND school_id = p_school_id;

  INSERT INTO stock_adjustments(
    school_id,
    item_id,
    type,
    quantity,
    reason,
    adjusted_by
  ) VALUES (
    p_school_id,
    p_item_id,
    'remove',
    -p_quantity,
    'Damage adjustment: ' || btrim(p_reason),
    v_recorded_by
  );

  RETURN jsonb_build_object(
    'damage_adjustment_id', v_damage_id,
    'item_id', p_item_id,
    'quantity', p_quantity
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_inventory_damage_adjustment(UUID, UUID, INTEGER, TEXT, UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_inventory_damage_adjustment(UUID, UUID, INTEGER, TEXT, UUID, DATE) TO authenticated;

DROP FUNCTION IF EXISTS public.get_inventory_sale_control_audit(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER);
CREATE OR REPLACE FUNCTION public.get_inventory_sale_control_audit(
  p_school_id UUID,
  p_from TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
  p_to TIMESTAMPTZ DEFAULT NOW(),
  p_sla_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  request_id UUID,
  sale_id UUID,
  bill_number TEXT,
  request_type TEXT,
  status TEXT,
  reason TEXT,
  reversal_reason TEXT,
  requested_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  requested_by_name TEXT,
  reviewed_by_name TEXT,
  aging_hours NUMERIC,
  review_tat_hours NUMERIC,
  within_sla BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (is_super_admin() OR (p_school_id = get_my_school_id() AND is_admin_or_manager())) THEN
    RAISE EXCEPTION 'Cannot read sale-control audit for another school' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    r.id AS request_id,
    r.sale_id,
    s.bill_number,
    r.request_type,
    r.status,
    r.reason,
    s.reversal_type AS reversal_reason,
    r.created_at AS requested_at,
    r.reviewed_at,
    r.executed_at,
    requester.full_name AS requested_by_name,
    reviewer.full_name AS reviewed_by_name,
    ROUND((EXTRACT(EPOCH FROM (
      CASE
        WHEN r.status = 'pending' THEN NOW() - r.created_at
        ELSE COALESCE(r.reviewed_at, r.executed_at, NOW()) - r.created_at
      END
    )) / 3600)::NUMERIC, 2) AS aging_hours,
    CASE
      WHEN COALESCE(r.reviewed_at, r.executed_at) IS NULL THEN NULL
      ELSE ROUND((EXTRACT(EPOCH FROM (COALESCE(r.reviewed_at, r.executed_at) - r.created_at)) / 3600)::NUMERIC, 2)
    END AS review_tat_hours,
    CASE
      WHEN COALESCE(r.reviewed_at, r.executed_at) IS NULL THEN FALSE
      ELSE (EXTRACT(EPOCH FROM (COALESCE(r.reviewed_at, r.executed_at) - r.created_at)) / 3600) <= GREATEST(p_sla_hours, 1)
    END AS within_sla
  FROM inventory_sale_control_requests r
  LEFT JOIN inventory_sales s
    ON s.id = r.sale_id
  LEFT JOIN user_profiles requester
    ON requester.id = r.requested_by
  LEFT JOIN user_profiles reviewer
    ON reviewer.id = r.reviewed_by
  WHERE r.school_id = p_school_id
    AND r.created_at >= COALESCE(p_from, NOW() - INTERVAL '30 days')
    AND r.created_at <= COALESCE(p_to, NOW())
  ORDER BY r.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_inventory_sale_control_audit(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_inventory_sale_control_audit(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO authenticated;
