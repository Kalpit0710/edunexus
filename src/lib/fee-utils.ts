/**
 * Pure utility functions for Fee & Billing module (Milestone 1.8).
 */

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
