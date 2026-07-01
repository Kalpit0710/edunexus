/**
 * Milestone 1.8 — Fee utility tests
 */
import { describe, it, expect } from 'vitest'
import {
  generateReceiptNumber,
  calcTotal,
  calcNetPayable,
  isFullPayment,
  validateFeePayload,
  validateCollectFeeInput,
  MAX_FEE_TRANSACTION_AMOUNT,
  isReferenceRequired,
  REFERENCE_REQUIRED_MODES,
  formatCurrency,
  buildReceiptSummary,
  PAYMENT_MODE_LABELS,
  type FeeBreakdownItem,
  type CollectFeePayload,
  type ReceiptData,
} from '@/lib/fee-utils'

// ── generateReceiptNumber ─────────────────────────────────────────────────────

describe('generateReceiptNumber() (M1.8)', () => {
  it('formats correctly with 4-digit zero-padded seq', () => {
    expect(generateReceiptNumber('GHS', 2026, 1)).toBe('GHS/2026/0001')
    expect(generateReceiptNumber('GHS', 2026, 42)).toBe('GHS/2026/0042')
    expect(generateReceiptNumber('GHS', 2026, 1000)).toBe('GHS/2026/1000')
  })

  it('uppercases the school code', () => {
    expect(generateReceiptNumber('rps', 2026, 5)).toBe('RPS/2026/0005')
  })
})

// ── calcTotal ────────────────────────────────────────────────────────────────

describe('calcTotal() (M1.8)', () => {
  const items: FeeBreakdownItem[] = [
    { categoryId: 'c1', categoryName: 'Tuition', amount: 5000 },
    { categoryId: 'c2', categoryName: 'Transport', amount: 1200 },
    { categoryId: 'c3', categoryName: 'Lab', amount: 800 },
  ]

  it('sums all item amounts', () => {
    expect(calcTotal(items)).toBe(7000)
  })

  it('returns 0 for empty items', () => {
    expect(calcTotal([])).toBe(0)
  })
})

// ── calcNetPayable ────────────────────────────────────────────────────────────

describe('calcNetPayable() (M1.8)', () => {
  it('subtracts discount from total', () => {
    expect(calcNetPayable(5000, 500)).toBe(4500)
  })

  it('never returns negative', () => {
    expect(calcNetPayable(500, 1000)).toBe(0)
  })

  it('returns total when discount is 0', () => {
    expect(calcNetPayable(3000, 0)).toBe(3000)
  })
})

// ── isFullPayment ─────────────────────────────────────────────────────────────

describe('isFullPayment() (M1.8)', () => {
  it('returns true when paid equals net due', () => {
    expect(isFullPayment(4500, 5000, 500)).toBe(true)
  })

  it('returns true when paid more than net due', () => {
    expect(isFullPayment(5000, 5000, 0)).toBe(true)
  })

  it('returns false when partial payment', () => {
    expect(isFullPayment(3000, 5000, 0)).toBe(false)
  })
})

// ── validateFeePayload ────────────────────────────────────────────────────────

const validPayload: CollectFeePayload = {
  studentId: 'stu-1',
  items: [{ categoryId: 'c1', categoryName: 'Tuition', amount: 5000 }],
  paidAmount: 5000,
  discountAmount: 0,
  paymentMode: 'cash',
  collectedBy: 'user-1',
}

describe('validateFeePayload() (M1.8)', () => {
  it('returns no errors for a valid payload', () => {
    expect(validateFeePayload(validPayload)).toHaveLength(0)
  })

  it('requires studentId', () => {
    const e = validateFeePayload({ ...validPayload, studentId: '' })
    expect(e.some(x => x.includes('Student'))).toBe(true)
  })

  it('requires at least one item', () => {
    const e = validateFeePayload({ ...validPayload, items: [] })
    expect(e.some(x => x.includes('fee item'))).toBe(true)
  })

  it('requires paid amount > 0', () => {
    const e = validateFeePayload({ ...validPayload, paidAmount: 0 })
    expect(e.some(x => x.includes('Paid amount'))).toBe(true)
  })

  it('rejects negative discount', () => {
    const e = validateFeePayload({ ...validPayload, discountAmount: -100 })
    expect(e.some(x => x.includes('Discount'))).toBe(true)
  })

  it('rejects paid amount exceeding net payable', () => {
    // total=5000, discount=0, paid=6000 → error
    const e = validateFeePayload({ ...validPayload, paidAmount: 6000 })
    expect(e.some(x => x.includes('exceed'))).toBe(true)
  })

  it('allows partial payment (paid < total)', () => {
    const e = validateFeePayload({ ...validPayload, paidAmount: 2000 })
    expect(e).toHaveLength(0)
  })

  it('requires collectedBy', () => {
    const e = validateFeePayload({ ...validPayload, collectedBy: '' })
    expect(e.some(x => x.includes('Collector'))).toBe(true)
  })
})

// ── PAYMENT_MODE_LABELS ───────────────────────────────────────────────────────

describe('PAYMENT_MODE_LABELS (M1.8)', () => {
  it('has human-readable labels for all 6 modes', () => {
    expect(PAYMENT_MODE_LABELS.cash).toBe('Cash')
    expect(PAYMENT_MODE_LABELS.cheque).toBe('Cheque')
    expect(PAYMENT_MODE_LABELS.upi).toBe('UPI')
    expect(PAYMENT_MODE_LABELS.neft).toBe('NEFT/RTGS')
    expect(PAYMENT_MODE_LABELS.card).toBe('Card')
    expect(PAYMENT_MODE_LABELS.online).toBe('Online')
  })
})

// ── buildReceiptSummary ───────────────────────────────────────────────────────

describe('buildReceiptSummary() (M1.8)', () => {
  const receipt: ReceiptData = {
    receiptNumber: 'GHS/2026/0001',
    studentName: 'Rahul Kumar',
    className: 'Grade X-A',
    paymentDate: '2026-03-01',
    items: [{ categoryId: 'c1', categoryName: 'Tuition', amount: 5000 }],
    totalAmount: 5000,
    discountAmount: 500,
    paidAmount: 4500,
    paymentMode: 'cash',
    collectedBy: 'Admin User',
    remarks: 'Advance payment',
  }

  it('includes receipt number, student name and total paid', () => {
    const summary = buildReceiptSummary(receipt)
    expect(summary).toContain('GHS/2026/0001')
    expect(summary).toContain('Rahul Kumar')
    expect(summary).toContain('Cash')
  })

  it('includes discount line when discount > 0', () => {
    const summary = buildReceiptSummary(receipt)
    expect(summary).toContain('Discount')
  })

  it('omits discount line when discount is 0', () => {
    const summary = buildReceiptSummary({ ...receipt, discountAmount: 0 })
    expect(summary).not.toContain('Discount')
  })
})

// ── validateCollectFeeInput (Chunk 2.2 — fee payment guards) ───────────────────

describe('validateCollectFeeInput() (Chunk 2.2)', () => {
  const validInput = {
    studentId: '11111111-1111-1111-1111-111111111111',
    items: [{ categoryId: '22222222-2222-2222-2222-222222222222', amount: 5000 }],
    paidAmount: 5000,
    discountAmount: 0,
    paymentMode: 'cash' as const,
    collectedById: '33333333-3333-3333-3333-333333333333',
  }

  it('accepts a valid payload', () => {
    expect(validateCollectFeeInput(validInput)).toBeNull()
  })

  it('allows cash overpayment (change-due POS flow)', () => {
    // paidAmount > net payable is intentionally permitted.
    expect(validateCollectFeeInput({ ...validInput, paidAmount: 6000 })).toBeNull()
  })

  it('rejects an unknown payment mode', () => {
    expect(validateCollectFeeInput({ ...validInput, paymentMode: 'bitcoin' })).toMatch(/payment mode/i)
  })

  it('rejects a negative paid amount', () => {
    expect(validateCollectFeeInput({ ...validInput, paidAmount: -1 })).toMatch(/negative/i)
  })

  it('rejects a zero paid amount', () => {
    expect(validateCollectFeeInput({ ...validInput, paidAmount: 0 })).toMatch(/greater than 0/i)
  })

  it('rejects a paid amount above the sane upper bound', () => {
    expect(
      validateCollectFeeInput({ ...validInput, paidAmount: MAX_FEE_TRANSACTION_AMOUNT + 1 }),
    ).toMatch(/maximum/i)
  })

  it('rejects a non-finite amount', () => {
    expect(validateCollectFeeInput({ ...validInput, paidAmount: Number.POSITIVE_INFINITY })).toMatch(
      /valid amount|number/i,
    )
  })

  it('rejects a negative item amount', () => {
    expect(
      validateCollectFeeInput({
        ...validInput,
        items: [{ categoryId: '22222222-2222-2222-2222-222222222222', amount: -100 }],
      }),
    ).toMatch(/negative/i)
  })

  it('rejects an empty items array', () => {
    expect(validateCollectFeeInput({ ...validInput, items: [] })).toMatch(/at least one/i)
  })

  it('rejects a discount greater than the total fee', () => {
    expect(validateCollectFeeInput({ ...validInput, discountAmount: 6000 })).toMatch(
      /discount cannot exceed/i,
    )
  })

  it('rejects a malformed student id', () => {
    expect(validateCollectFeeInput({ ...validInput, studentId: 'not-a-uuid' })).toMatch(/student/i)
  })

  it('requires a reference number for non-cash modes', () => {
    for (const mode of REFERENCE_REQUIRED_MODES) {
      expect(validateCollectFeeInput({ ...validInput, paymentMode: mode })).toMatch(
        /reference number is required/i,
      )
    }
  })

  it('accepts a non-cash payment when a reference number is provided', () => {
    expect(
      validateCollectFeeInput({ ...validInput, paymentMode: 'upi', referenceNumber: 'UPI-12345' }),
    ).toBeNull()
  })

  it('treats a whitespace-only reference as missing for non-cash modes', () => {
    expect(
      validateCollectFeeInput({ ...validInput, paymentMode: 'cheque', referenceNumber: '   ' }),
    ).toMatch(/reference number is required/i)
  })

  it('does not require a reference number for cash', () => {
    expect(validateCollectFeeInput({ ...validInput, paymentMode: 'cash' })).toBeNull()
  })
})

// ── isReferenceRequired ─────────────────────────────────────────────

describe('isReferenceRequired()', () => {
  it('is false only for cash', () => {
    expect(isReferenceRequired('cash')).toBe(false)
  })

  it('is true for every non-cash mode', () => {
    for (const mode of REFERENCE_REQUIRED_MODES) {
      expect(isReferenceRequired(mode)).toBe(true)
    }
  })

  it('does not include cash in the required set', () => {
    expect(REFERENCE_REQUIRED_MODES).not.toContain('cash')
  })
})
