-- Accurate inventory summary aggregation without row caps.
-- Used by src/app/(manager)/manager/inventory/actions.ts:getInventorySummary.

CREATE OR REPLACE FUNCTION public.get_inventory_summary(p_school_id UUID)
RETURNS TABLE (
  item_count BIGINT,
  low_stock_count BIGINT,
  stock_value NUMERIC,
  sales_count BIGINT,
  sales_total NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_super_admin() OR p_school_id = public.get_my_school_id()) THEN
    RAISE EXCEPTION 'Access denied for requested school summary.';
  END IF;

  RETURN QUERY
  WITH item_stats AS (
    SELECT
      COUNT(*)::BIGINT AS item_count,
      COUNT(*) FILTER (WHERE ii.stock_quantity <= ii.low_stock_alert)::BIGINT AS low_stock_count,
      COALESCE(SUM(ii.stock_quantity * ii.unit_price), 0)::NUMERIC AS stock_value
    FROM public.inventory_items ii
    WHERE ii.school_id = p_school_id
      AND ii.is_active = TRUE
  ),
  sale_stats AS (
    SELECT
      COUNT(*)::BIGINT AS sales_count,
      COALESCE(SUM(isl.total_amount), 0)::NUMERIC AS sales_total
    FROM public.inventory_sales isl
    WHERE isl.school_id = p_school_id
  )
  SELECT
    item_stats.item_count,
    item_stats.low_stock_count,
    item_stats.stock_value,
    sale_stats.sales_count,
    sale_stats.sales_total
  FROM item_stats
  CROSS JOIN sale_stats;
END;
$$;

REVOKE ALL ON FUNCTION public.get_inventory_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_inventory_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_inventory_summary(UUID) TO service_role;
