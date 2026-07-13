-- ============================================================
-- Migration: 20260709000003_inventory_sale_control_workflow
-- EduNexus — Inventory POS cashier controls (void/return approval matrix)
--
-- Adds:
-- 1) inventory_sale_control_requests (request + approval trail)
-- 2) reversal markers on inventory_sales
-- 3) review_inventory_sale_control_request() RPC that atomically applies
--    approved void/return requests and restores stock.
-- ============================================================

ALTER TABLE public.inventory_sales
ADD COLUMN IF NOT EXISTS is_reversed BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reversal_type TEXT,
ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS reversed_request_id UUID;

CREATE TABLE IF NOT EXISTS public.inventory_sale_control_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES inventory_sales(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('void', 'return')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed')),
  reason TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES user_profiles(id),
  reviewed_by UUID REFERENCES user_profiles(id),
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.inventory_sales
ADD CONSTRAINT inventory_sales_reversed_request_fkey
FOREIGN KEY (reversed_request_id) REFERENCES inventory_sale_control_requests(id)
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_sale_control_school_status
ON public.inventory_sale_control_requests (school_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_sale_control_sale
ON public.inventory_sale_control_requests (sale_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_sale_control_open_request_per_sale
ON public.inventory_sale_control_requests (sale_id)
WHERE status IN ('pending', 'approved', 'executed');

DROP TRIGGER IF EXISTS set_updated_at_inventory_sale_control_requests ON public.inventory_sale_control_requests;
CREATE TRIGGER set_updated_at_inventory_sale_control_requests
  BEFORE UPDATE ON public.inventory_sale_control_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.inventory_sale_control_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS super_admin_all_inventory_sale_control_requests ON public.inventory_sale_control_requests;
CREATE POLICY super_admin_all_inventory_sale_control_requests ON public.inventory_sale_control_requests
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS admin_manager_read_inventory_sale_control_requests ON public.inventory_sale_control_requests;
CREATE POLICY admin_manager_read_inventory_sale_control_requests ON public.inventory_sale_control_requests
  FOR SELECT TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager());

DROP POLICY IF EXISTS admin_manager_insert_inventory_sale_control_requests ON public.inventory_sale_control_requests;
CREATE POLICY admin_manager_insert_inventory_sale_control_requests ON public.inventory_sale_control_requests
  FOR INSERT TO authenticated
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());

DROP POLICY IF EXISTS admin_manager_update_inventory_sale_control_requests ON public.inventory_sale_control_requests;
CREATE POLICY admin_manager_update_inventory_sale_control_requests ON public.inventory_sale_control_requests
  FOR UPDATE TO authenticated
  USING (school_id = get_my_school_id() AND is_admin_or_manager())
  WITH CHECK (school_id = get_my_school_id() AND is_admin_or_manager());

DROP FUNCTION IF EXISTS public.review_inventory_sale_control_request(UUID, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.review_inventory_sale_control_request(
  p_request_id UUID,
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
  v_request inventory_sale_control_requests%ROWTYPE;
  v_sale inventory_sales%ROWTYPE;
  v_item RECORD;
  v_actor_profile_id UUID;
  v_reviewer UUID;
BEGIN
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decision must be approved or rejected';
  END IF;

  SELECT id INTO v_actor_profile_id
  FROM user_profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  SELECT * INTO v_request
  FROM inventory_sale_control_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Control request not found' USING ERRCODE = 'PGRST116';
  END IF;

  IF NOT (is_super_admin() OR (v_request.school_id = get_my_school_id() AND is_school_admin())) THEN
    RAISE EXCEPTION 'Only school admin can review sale control requests' USING ERRCODE = '42501';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending requests can be reviewed';
  END IF;

  v_reviewer := COALESCE(p_reviewed_by, v_actor_profile_id);

  IF p_decision = 'rejected' THEN
    UPDATE inventory_sale_control_requests
    SET
      status = 'rejected',
      reviewed_by = v_reviewer,
      review_notes = NULLIF(btrim(p_review_notes), ''),
      reviewed_at = NOW(),
      updated_at = NOW()
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
      'request_id', p_request_id,
      'status', 'rejected'
    );
  END IF;

  SELECT * INTO v_sale
  FROM inventory_sales
  WHERE id = v_request.sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found' USING ERRCODE = 'PGRST116';
  END IF;

  IF v_sale.is_reversed THEN
    RAISE EXCEPTION 'Sale is already reversed';
  END IF;

  FOR v_item IN
    SELECT isi.item_id, isi.quantity, s.bill_number
    FROM inventory_sale_items isi
    JOIN inventory_sales s ON s.id = isi.sale_id
    WHERE isi.sale_id = v_sale.id
  LOOP
    UPDATE inventory_items
    SET
      stock_quantity = stock_quantity + v_item.quantity,
      updated_at = NOW()
    WHERE id = v_item.item_id
      AND school_id = v_sale.school_id;

    INSERT INTO stock_adjustments(
      school_id,
      item_id,
      type,
      quantity,
      reason,
      adjusted_by
    ) VALUES (
      v_sale.school_id,
      v_item.item_id,
      'adjustment',
      v_item.quantity,
      'POS ' || v_request.request_type || ' reversal for bill ' || v_item.bill_number,
      v_reviewer
    );
  END LOOP;

  UPDATE inventory_sales
  SET
    is_reversed = TRUE,
    reversal_type = v_request.request_type,
    reversed_at = NOW(),
    reversed_by = v_reviewer,
    reversed_request_id = v_request.id,
    updated_at = NOW()
  WHERE id = v_sale.id;

  UPDATE inventory_sale_control_requests
  SET
    status = 'executed',
    reviewed_by = v_reviewer,
    review_notes = NULLIF(btrim(p_review_notes), ''),
    reviewed_at = NOW(),
    executed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'request_id', p_request_id,
    'status', 'executed',
    'sale_id', v_sale.id,
    'request_type', v_request.request_type
  );
END;
$$;

REVOKE ALL ON FUNCTION public.review_inventory_sale_control_request(UUID, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_inventory_sale_control_request(UUID, TEXT, UUID, TEXT) TO authenticated;
