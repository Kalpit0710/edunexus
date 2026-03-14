export type InventoryCategory = 'book' | 'stationery' | 'uniform' | 'sports' | 'lab' | 'other'

export type StockAdjustmentType = 'add' | 'remove' | 'adjustment'

export interface InventoryCartItem {
  itemId: string
  quantity: number
  unitPrice: number
}

export function calculateInventoryLineTotal(quantity: number, unitPrice: number): number {
  if (quantity <= 0 || unitPrice < 0) return 0
  return Number((quantity * unitPrice).toFixed(2))
}

export function calculateInventoryCartTotal(items: InventoryCartItem[]): number {
  return Number(
    items
      .reduce((total, item) => total + calculateInventoryLineTotal(item.quantity, item.unitPrice), 0)
      .toFixed(2)
  )
}

export function isLowStock(stockQuantity: number, lowStockAlert: number): boolean {
  return stockQuantity <= lowStockAlert
}

export function getStockDelta(type: StockAdjustmentType, quantity: number): number {
  if (type === 'add') return Math.abs(quantity)
  if (type === 'remove') return -Math.abs(quantity)
  return quantity
}

export function validateStockAdjustment(
  type: StockAdjustmentType,
  quantity: number,
  currentStock: number
): string[] {
  const errors: string[] = []

  if (!Number.isFinite(quantity)) {
    errors.push('Quantity must be a number.')
    return errors
  }

  if ((type === 'add' || type === 'remove') && quantity <= 0) {
    errors.push('Quantity must be greater than 0 for add/remove actions.')
  }

  if (type === 'adjustment' && quantity === 0) {
    errors.push('Quantity cannot be 0 for adjustment.')
  }

  const newStock = currentStock + getStockDelta(type, quantity)
  if (newStock < 0) {
    errors.push('Stock cannot go below 0.')
  }

  return errors
}

export function validateInventorySaleItems(items: InventoryCartItem[]): string[] {
  const errors: string[] = []

  if (!items.length) {
    errors.push('At least one item is required in cart.')
    return errors
  }

  items.forEach((item, index) => {
    if (!item.itemId) {
      errors.push(`Item at row ${index + 1} is missing itemId.`)
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      errors.push(`Item at row ${index + 1} has invalid quantity.`)
    }
    if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
      errors.push(`Item at row ${index + 1} has invalid unit price.`)
    }
  })

  return errors
}
