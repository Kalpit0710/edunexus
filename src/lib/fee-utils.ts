/**
 * Pure utility functions for Fee & Billing module (Milestone 1.8).
 */

import { z } from 'zod'

export type PaymentMode = 'cash' | 'cheque' | 'upi' | 'neft' | 'card' | 'online'

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  cash: 'Cash',
  cheque: 'Cheque',
  upi: 'UPI',
  neft: 'NEFT/RTGS',
  card: 'Card',
  online: 'Online',
}

export interface FeeBreakdownItem {
  categoryId: string
  categoryName: string
  amount: number
}

export interface ReceiptData {
  receiptNumber: string
  studentName: string
  className: string
  paymentDate: string
  items: FeeBreakdownItem[]
  totalAmount: number
  discountAmount: number
  paidAmount: number
  paymentMode: PaymentMode
  collectedBy: string
  remarks?: string
}

/**
 * Generate a receipt number in the format SCHOOL_CODE/YEAR/SEQ.
 * e.g. "GHS/2026/0042"
 */
export function generateReceiptNumber(schoolCode: string, year: number, seq: number): string {
  return `${schoolCode.toUpperCase()}/${year}/${String(seq).padStart(4, '0')}`
}

/**
 * Generate a collision-resistant receipt number for client retries/offline
 * replay. Format: SCHOOL/YEAR/YYYYMMDDHHMMSS-RAND
 */
export function generateRobustReceiptNumber(schoolCode: string, now = new Date()): string {
  const ts = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `${schoolCode.toUpperCase()}/${now.getFullYear()}/${ts}-${rand}`
}

/**
 * Calculate total from an array of breakdown items.
 */
export function calcTotal(items: FeeBreakdownItem[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0)
}

/**
 * Calculate net payable after discount.
 */
export function calcNetPayable(total: number, discount: number): number {
  return Math.max(0, total - discount)
}

/**
 * Check whether a payment amount fully covers the net due.
 */
export function isFullPayment(paidAmount: number, totalDue: number, discountAmount: number): boolean {
  return paidAmount >= calcNetPayable(totalDue, discountAmount)
}

/**
 * Validate a fee collection payload before DB insert.
 * Returns an array of error messages; empty array means valid.
 */
export interface CollectFeePayload {
  studentId: string
  items: FeeBreakdownItem[]
  paidAmount: number
  discountAmount: number
  paymentMode: PaymentMode
  collectedBy: string
}

export function validateFeePayload(payload: CollectFeePayload): string[] {
  const errors: string[] = []
  if (!payload.studentId) errors.push('Student is required.')
  if (!payload.items.length) errors.push('At least one fee item is required.')
  if (payload.paidAmount <= 0) errors.push('Paid amount must be greater than 0.')
  if (payload.discountAmount < 0) errors.push('Discount cannot be negative.')
  const total = calcTotal(payload.items)
  if (payload.paidAmount > total - payload.discountAmount + 0.001) {
    errors.push('Paid amount cannot exceed net payable amount.')
  }
  if (!payload.collectedBy) errors.push('Collector is required.')
  return errors
}

/** Maximum amount accepted in a single fee transaction (₹1 crore) — a sane upper bound. */
export const MAX_FEE_TRANSACTION_AMOUNT = 10_000_000

/**
 * Payment modes that must carry a reference number (cheque no., UPI/txn ref,
 * card auth code, etc.) so collections can be reconciled against bank/gateway
 * statements. Cash is the only mode where a reference is not applicable.
 */
export const REFERENCE_REQUIRED_MODES: readonly PaymentMode[] = [
  'cheque',
  'upi',
  'neft',
  'card',
  'online',
]

/** True when the given payment mode requires a reference number. */
export function isReferenceRequired(mode: PaymentMode): boolean {
  return REFERENCE_REQUIRED_MODES.includes(mode)
}

const feeMoney = (label: string) =>
  z
    .number({ invalid_type_error: `${label} must be a number.` })
    .finite(`${label} must be a valid amount.`)
    .nonnegative(`${label} cannot be negative.`)
    .max(MAX_FEE_TRANSACTION_AMOUNT, `${label} exceeds the maximum allowed amount.`)

/**
 * Runtime schema for the fee-collection server action input (`CollectFeeInput`).
 * Note: paid amount is intentionally NOT capped at net payable — cash
 * overpayment (with change returned) is a supported POS flow.
 */
export const collectFeeInputSchema = z
  .object({
    studentId: z.string().uuid('A valid student is required.'),
    items: z
      .array(
        z.object({
          categoryId: z.string().uuid('A valid fee category is required.'),
          amount: feeMoney('Fee amount'),
        }),
      )
      .min(1, 'At least one fee item is required.'),
    paidAmount: feeMoney('Paid amount').refine((v) => v > 0, 'Paid amount must be greater than 0.'),
    discountAmount: feeMoney('Discount'),
    paymentMode: z.enum(['cash', 'cheque', 'upi', 'neft', 'card', 'online'], {
      errorMap: () => ({ message: 'Invalid payment mode.' }),
    }),
    collectedById: z.string().uuid('A valid collector is required.'),
    referenceNumber: z.string().trim().max(100).optional(),
    remarks: z.string().trim().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    const total = data.items.reduce((sum, i) => sum + i.amount, 0)
    if (data.discountAmount > total) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountAmount'],
        message: 'Discount cannot exceed the total fee amount.',
      })
    }
    if (isReferenceRequired(data.paymentMode) && !data.referenceNumber?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['referenceNumber'],
        message: `A reference number is required for ${PAYMENT_MODE_LABELS[data.paymentMode]} payments.`,
      })
    }
  })

/** Validate the fee-collection input; returns the first error message, or null when valid. */
export function validateCollectFeeInput(input: unknown): string | null {
  const parsed = collectFeeInputSchema.safeParse(input)
  if (parsed.success) return null
  return parsed.error.issues[0]?.message ?? 'Invalid payment details.'
}

/**
 * Format a currency value to the locale string (INR by default).
 */
export function formatCurrency(amount: number, locale = 'en-IN', currency = 'INR'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
}

/**
 * Build a text summary line for a receipt (for print/PDF view).
 */
export function buildReceiptSummary(data: ReceiptData): string {
  const lines = [
    `Receipt No: ${data.receiptNumber}`,
    `Student: ${data.studentName} (${data.className})`,
    `Date: ${data.paymentDate}`,
    `Mode: ${PAYMENT_MODE_LABELS[data.paymentMode]}`,
    '---',
    ...data.items.map(i => `  ${i.categoryName}: ${formatCurrency(i.amount)}`),
    '---',
    ...(data.discountAmount > 0 ? [`  Discount: -${formatCurrency(data.discountAmount)}`] : []),
    `  Total Paid: ${formatCurrency(data.paidAmount)}`,
    `Collected by: ${data.collectedBy}`,
  ]
  return lines.join('\n')
}
