# Module 06 — Fee & Billing (POS)

> **Phase:** Phase 1 (basic) + Phase 2 (advanced)  
> **Priority:** P0 — Core revenue module

---

## Overview

The Fee & Billing module is the financial heart of EduNexus. It handles:
- Fee structure definition per class and academic year
- Automatic installment generation per student
- POS-style fee collection with receipt generation
- Late fee automation
- Refunds and adjustments
- Comprehensive financial reporting

---

## Business Rules

1. **Fee structures are per class, per academic year** — a new structure must be created for each year
2. **Installments auto-generate** when a student is assigned to a fee structure
3. **Payments are never deleted** — refunds create a new negative record
4. **Receipt numbers are sequential per school:** `{SCHOOL_CODE}-{YYYY}-{NNNNN}`
5. **Partial payments are supported** — installment status becomes `partial`
6. **Late fees auto-apply daily** via Edge Function cron at 1 AM
7. **Discounts must be approved** by School Admin
8. **Collection requires Manager or Admin role**

---

## Fee Structure Setup

### Fee Heads (Types)
| Type | Description | Example |
|------|-------------|---------|
| `tuition` | Core academic fee | ₹5,000/month |
| `transport` | Bus/van fee | ₹1,200/month |
| `admission` | One-time joining fee | ₹2,000 |
| `maintenance` | Infrastructure fee | ₹500/quarter |
| `miscellaneous` | Other charges | variable |

### Frequency Options
- Monthly (12 installments/year)
- Quarterly (4 installments/year)
- Half-yearly (2 installments/year)
- Yearly (1 installment/year)

---

## POS Collection Screen Flow

```
1. Manager opens Fee Collection
2. Searches for student (by name / admission number)
3. System displays:
   - All pending installments
   - Fee head breakdown
   - Late fees accrued
   - Discount applied (if any)
   - Already paid amount
   - Net payable
4. Manager selects payment mode
5. Enters amount (defaults to total)
6. Optional: reference number (for UPI/card)
7. Clicks "Collect Payment"
8. System calls collect_fee() RPC (atomic)
9. Receipt PDF generated via Edge Function
10. Success: shows receipt number + download link
11. Optional: email receipt to parent
```

---

## Database Tables Involved

- `fee_structures` — defines the fee plan
- `fee_heads` — individual fee line items
- `fee_installments` — per-student payment schedule
- `payments` — completed payment records
- `payment_items` — breakdown of what was paid in each payment
- `discounts` — approved discount records

---

## Reports

| Report | Access | Description |
|--------|--------|-------------|
| Daily Collection | Manager, Admin | All payments today by mode |
| Pending Fees | Manager, Admin | Students with overdue/pending |
| Fee Ledger | Admin | Full payment history per student |
| Monthly Summary | Admin | Month-wise collection totals |
| Class-wise Defaulters | Admin | Students with overdue by class |

---

## Phase 1 Scope

- [x] Fee structure CRUD
- [x] Fee head management
- [x] Installment auto-generation
- [x] POS collection UI
- [x] Receipt PDF via Edge Function
- [x] Daily collection report
- [x] Pending fees list

## Phase 2 Additions

- [ ] Late fee automation (cron + configurable rate)
- [ ] Discount management with approval flow
- [ ] Refund processing
- [ ] Email receipt to parent
- [ ] Fee reminder automation
- [ ] GST-ready receipt format
- [ ] Advanced financial charts
