import { describe, expect, it } from 'vitest'
import {
  calculateInventoryCartTotal,
  calculateInventoryLineTotal,
  getStockDelta,
  isLowStock,
  validateInventorySaleItems,
  validateStockAdjustment,
} from '@/lib/inventory-utils'

describe('calculateInventoryLineTotal() (Phase 2.2)', () => {
  it('returns quantity * unitPrice with 2 decimals', () => {
    expect(calculateInventoryLineTotal(2, 99.5)).toBe(199)
    expect(calculateInventoryLineTotal(3, 19.999)).toBe(60)
  })

  it('returns 0 for invalid inputs', () => {
    expect(calculateInventoryLineTotal(0, 10)).toBe(0)
    expect(calculateInventoryLineTotal(1, -10)).toBe(0)
  })
})

describe('calculateInventoryCartTotal() (Phase 2.2)', () => {
  it('sums all line totals', () => {
    const total = calculateInventoryCartTotal([
      { itemId: 'i1', quantity: 2, unitPrice: 100 },
      { itemId: 'i2', quantity: 1, unitPrice: 49.99 },
      { itemId: 'i3', quantity: 3, unitPrice: 10 },
    ])
    expect(total).toBe(279.99)
  })

  it('returns 0 for empty cart', () => {
    expect(calculateInventoryCartTotal([])).toBe(0)
  })
})

describe('isLowStock() (Phase 2.2)', () => {
  it('returns true when stock is at or below threshold', () => {
    expect(isLowStock(10, 10)).toBe(true)
    expect(isLowStock(9, 10)).toBe(true)
  })

  it('returns false when stock is above threshold', () => {
    expect(isLowStock(11, 10)).toBe(false)
  })
})

describe('getStockDelta() (Phase 2.2)', () => {
  it('returns positive delta for add, negative for remove', () => {
    expect(getStockDelta('add', 5)).toBe(5)
    expect(getStockDelta('remove', 5)).toBe(-5)
  })

  it('returns raw quantity for adjustment', () => {
    expect(getStockDelta('adjustment', 3)).toBe(3)
    expect(getStockDelta('adjustment', -2)).toBe(-2)
  })
})

describe('validateStockAdjustment() (Phase 2.2)', () => {
  it('accepts valid add/remove/adjustment actions', () => {
    expect(validateStockAdjustment('add', 5, 10)).toHaveLength(0)
    expect(validateStockAdjustment('remove', 5, 10)).toHaveLength(0)
    expect(validateStockAdjustment('adjustment', -3, 10)).toHaveLength(0)
  })

  it('rejects invalid quantities and negative resulting stock', () => {
    expect(validateStockAdjustment('add', 0, 10)).toContain(
      'Quantity must be greater than 0 for add/remove actions.'
    )
    expect(validateStockAdjustment('remove', 0, 10)).toContain(
      'Quantity must be greater than 0 for add/remove actions.'
    )
    expect(validateStockAdjustment('adjustment', 0, 10)).toContain(
      'Quantity cannot be 0 for adjustment.'
    )
    expect(validateStockAdjustment('remove', 11, 10)).toContain('Stock cannot go below 0.')
  })
})

describe('validateInventorySaleItems() (Phase 2.2)', () => {
  it('accepts valid sale payload', () => {
    const errors = validateInventorySaleItems([
      { itemId: 'item-1', quantity: 2, unitPrice: 100 },
      { itemId: 'item-2', quantity: 1, unitPrice: 50 },
    ])
    expect(errors).toHaveLength(0)
  })

  it('rejects empty cart and invalid rows', () => {
    expect(validateInventorySaleItems([])).toContain('At least one item is required in cart.')

    const errors = validateInventorySaleItems([
      { itemId: '', quantity: 2, unitPrice: 100 },
      { itemId: 'x', quantity: 0, unitPrice: 50 },
      { itemId: 'y', quantity: 1, unitPrice: -1 },
    ])

    expect(errors.some(error => error.includes('missing itemId'))).toBe(true)
    expect(errors.some(error => error.includes('invalid quantity'))).toBe(true)
    expect(errors.some(error => error.includes('invalid unit price'))).toBe(true)
  })
})
