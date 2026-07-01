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
1. Cashier opens Bookstore POS (/manager/inventory/pos) — school_admin or manager/cashier
2. Stage START — choose how to sell:
   a. Class / Student book set:
      - search a student by admission no. / name → resolves their class, OR
      - pick a class directly
      → loads that class's complete book set (items tagged with class_id)
        and pre-fills the cart (in-stock items, qty 1)
   b. Single item: search by item name / SKU (e.g. a pencil)
3. Stage SHOP — adjust the order:
   - increase / decrease qty, remove lines
   - "Add more items" search appends any item (books or general) to the catalog
4. Stage PAY — revealed once the cart has items:
   - customer is REQUIRED: a selected student OR explicit Guest billing
   - pick payment mode → Charge & Print Bill
5. create_inventory_sale RPC (atomic): records sale + items, deducts stock, bill no.
6. Success screen → print / new sale; receipt emailed to the primary parent if a student was linked
```

**Book sets:** `inventory_items.class_id` (nullable FK → `classes`) tags an item to a
class. Items with `class_id = NULL` are general (stationery, uniforms) sellable to
any class or guest.


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
