-- POS replay safety: add an idempotency key so offline/queued retries do not
-- create duplicate inventory sales when the first attempt already succeeded.

ALTER TABLE public.inventory_sales
ADD COLUMN IF NOT EXISTS client_reference TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_sales_school_client_reference
ON public.inventory_sales (school_id, client_reference)
WHERE client_reference IS NOT NULL;

DROP FUNCTION IF EXISTS public.create_inventory_sale(UUID, JSONB, payment_mode, UUID, UUID);

CREATE OR REPLACE FUNCTION public.create_inventory_sale(
  p_school_id UUID,
  p_items JSONB,
  p_payment_mode payment_mode,
  p_student_id UUID DEFAULT NULL,
  p_sold_by UUID DEFAULT NULL,
  p_client_reference TEXT DEFAULT NULL
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
  v_existing_id UUID;
  v_existing_bill TEXT;
  v_existing_total DECIMAL(12, 2);
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

  -- Idempotency: if this client reference already created a sale, return it.
  IF p_client_reference IS NOT NULL AND btrim(p_client_reference) <> '' THEN
    SELECT id, bill_number, total_amount
    INTO v_existing_id, v_existing_bill, v_existing_total
    FROM inventory_sales
    WHERE school_id = p_school_id
      AND client_reference = btrim(p_client_reference)
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'sale_id', v_existing_id,
        'bill_number', v_existing_bill,
        'total_amount', v_existing_total
      );
    END IF;
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

  BEGIN
    INSERT INTO inventory_sales(
      school_id,
      student_id,
      bill_number,
      total_amount,
      payment_mode,
      sold_by,
      client_reference
    )
    VALUES (
      p_school_id,
      p_student_id,
      v_bill_number,
      0,
      p_payment_mode,
      v_actor_profile_id,
      NULLIF(btrim(p_client_reference), '')
    )
    RETURNING id INTO v_sale_id;
  EXCEPTION WHEN unique_violation THEN
    IF p_client_reference IS NOT NULL AND btrim(p_client_reference) <> '' THEN
      SELECT id, bill_number, total_amount
      INTO v_existing_id, v_existing_bill, v_existing_total
      FROM inventory_sales
      WHERE school_id = p_school_id
        AND client_reference = btrim(p_client_reference)
      LIMIT 1;

      IF FOUND THEN
        RETURN jsonb_build_object(
          'sale_id', v_existing_id,
          'bill_number', v_existing_bill,
          'total_amount', v_existing_total
        );
      END IF;
    END IF;

    RAISE;
  END;

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

REVOKE ALL ON FUNCTION public.create_inventory_sale(UUID, JSONB, payment_mode, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_inventory_sale(UUID, JSONB, payment_mode, UUID, UUID, TEXT) TO authenticated;
