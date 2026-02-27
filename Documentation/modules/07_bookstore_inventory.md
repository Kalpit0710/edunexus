# Module 07 — Bookstore & Inventory

> **Phase:** Phase 2 | **Priority:** P1

## Overview
Manages physical inventory (books, uniforms, stationery) with a POS billing interface. Tracks stock, alerts on low levels, and records all sales.

## Item Categories
`book` | `stationery` | `uniform` | `sports` | `lab` | `other`

## Inventory Management
- Add/edit/delete items
- Set cost price and selling price
- Define low-stock alert threshold
- Add stock (purchase input)
- Manual stock adjustment (with reason)
- All stock movements logged in `stock_adjustments`

## POS Billing Flow
```
1. Search/select student (optional for walk-in)
2. Add items to cart (search or browse by category)
3. Review cart + total
4. Select payment mode
5. Generate bill
6. Auto-deduct stock quantities
7. PDF bill → Supabase Storage → Print/Download
```

## Low Stock Alerts
Dashboard widget shows items where `stock_quantity <= low_stock_alert`.  
Optional email alert to Admin when threshold crossed.

## Reports
| Report | Description |
|--------|-------------|
| Current stock | All items with quantities and value |
| Low stock report | Items at or below alert level |
| Sales report | Daily/monthly sales by category |
| Student purchase history | What a specific student has bought |

## Phase 2 Scope
- [ ] Inventory item CRUD
- [ ] Stock add/adjust with audit trail
- [ ] POS billing UI
- [ ] Bill PDF generation
- [ ] Student-linked purchase
- [ ] Low stock dashboard widget
- [ ] Inventory reports
