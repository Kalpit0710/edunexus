-- ============================================================
-- Migration: 20260709000005_inventory_sales_updated_at_hotfix
-- EduNexus — Hotfix for sale-control review RPC compatibility
--
-- Ensures inventory_sales has updated_at, which is referenced by
-- review_inventory_sale_control_request and related update flows.
-- ============================================================

ALTER TABLE public.inventory_sales
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS set_updated_at_inventory_sales ON public.inventory_sales;
CREATE TRIGGER set_updated_at_inventory_sales
  BEFORE UPDATE ON public.inventory_sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
