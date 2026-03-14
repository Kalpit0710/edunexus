import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const navMocks = vi.hoisted(() => ({
  push: vi.fn(),
  itemId: 'item-1',
}))

const inventoryActionMocks = vi.hoisted(() => ({
  getInventoryItems: vi.fn(),
  createInventoryItem: vi.fn(),
  updateInventoryItem: vi.fn(),
  setInventoryItemActive: vi.fn(),
  adjustInventoryStock: vi.fn(),
  createInventorySale: vi.fn(),
  getInventorySummary: vi.fn(),
  getInventorySales: vi.fn(),
  getLowStockItems: vi.fn(),
}))

const studentsActionMocks = vi.hoisted(() => ({
  getStudents: vi.fn(),
}))

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}))

const dbFixture = vi.hoisted(() => ({
  item: {
    id: 'item-1',
    school_id: 'school-1',
    name: 'Notebook',
    category: 'book',
    sku: 'NB-001',
    description: 'Ruled notebook',
    unit_price: 100,
    cost_price: 80,
    stock_quantity: 25,
    low_stock_alert: 5,
    is_active: true,
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: navMocks.push,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useParams: () => ({ itemId: navMocks.itemId }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ school: { id: 'school-1' } }),
}))

vi.mock('../../../src/app/(manager)/manager/inventory/actions', () => ({
  getInventoryItems: inventoryActionMocks.getInventoryItems,
  createInventoryItem: inventoryActionMocks.createInventoryItem,
  updateInventoryItem: inventoryActionMocks.updateInventoryItem,
  setInventoryItemActive: inventoryActionMocks.setInventoryItemActive,
  adjustInventoryStock: inventoryActionMocks.adjustInventoryStock,
  createInventorySale: inventoryActionMocks.createInventorySale,
  getInventorySummary: inventoryActionMocks.getInventorySummary,
  getInventorySales: inventoryActionMocks.getInventorySales,
  getLowStockItems: inventoryActionMocks.getLowStockItems,
}))

vi.mock('@/app/(school-admin)/school-admin/students/actions', () => ({
  getStudents: studentsActionMocks.getStudents,
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastMocks.success,
    error: toastMocks.error,
  },
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: dbFixture.item, error: null }),
    }),
  }),
}))

vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: vi.fn(),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}))

import NewInventoryItemPage from '../../../src/app/(manager)/manager/inventory/new/page'
import EditInventoryItemPage from '../../../src/app/(manager)/manager/inventory/[itemId]/edit/page'
import POSPage from '../../../src/app/(manager)/manager/inventory/pos/page'
import InventoryReportsPage from '../../../src/app/(manager)/manager/inventory/reports/page'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('confirm', vi.fn(() => true))

  inventoryActionMocks.createInventoryItem.mockResolvedValue({ id: 'item-2' })
  inventoryActionMocks.updateInventoryItem.mockResolvedValue({ id: 'item-1' })
  inventoryActionMocks.setInventoryItemActive.mockResolvedValue(undefined)

  inventoryActionMocks.getInventoryItems.mockResolvedValue([
    {
      id: 'item-1',
      name: 'Notebook',
      category: 'book',
      sku: 'NB-001',
      stock_quantity: 5,
      low_stock_alert: 2,
      unit_price: 50,
      is_active: true,
    },
  ])

  studentsActionMocks.getStudents.mockResolvedValue([
    { id: 'stu-1', full_name: 'Aarav Sharma', admission_number: 'ADM-001' },
  ])

  inventoryActionMocks.createInventorySale.mockResolvedValue({
    saleId: 'sale-1',
    billNumber: 'BILL-001',
    totalAmount: 50,
  })

  inventoryActionMocks.getInventorySummary.mockResolvedValue({
    stockValue: 1000,
    itemCount: 10,
    lowStockCount: 1,
    salesTotal: 500,
    salesCount: 2,
  })

  inventoryActionMocks.getInventorySales.mockResolvedValue([])
  inventoryActionMocks.getLowStockItems.mockResolvedValue([
    {
      id: 'item-low-1',
      name: 'Chem Lab Kit',
      category: 'lab',
      sku: 'LAB-001',
      stock_quantity: 2,
      low_stock_alert: 5,
    },
  ])
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Inventory/POS UI flows (Phase 2.2)', () => {
  it('validates inventory create and edit forms before action calls', async () => {
    const user = userEvent.setup()

    render(<NewInventoryItemPage />)
    await user.click(screen.getByRole('button', { name: /save item/i }))

    expect(toastMocks.error).toHaveBeenCalledWith('Item Name is required.')
    expect(inventoryActionMocks.createInventoryItem).not.toHaveBeenCalled()

    cleanup()

    render(<EditInventoryItemPage />)
    await waitFor(() => expect(screen.getByText(/edit item/i)).toBeInTheDocument())

    const sellingPriceInput = screen.getAllByRole('spinbutton')[0]
    expect(sellingPriceInput).toBeDefined()
    await user.clear(sellingPriceInput as Element)
    await user.type(sellingPriceInput as Element, '-1')

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(toastMocks.error).toHaveBeenCalledWith('Unit Price cannot be negative.')
    expect(inventoryActionMocks.updateInventoryItem).not.toHaveBeenCalled()
  })

  it('validates POS cart state and shows checkout success bill state', async () => {
    const user = userEvent.setup()
    render(<POSPage />)

    await waitFor(() => expect(screen.getByText(/point of sale/i)).toBeInTheDocument())

    const chargeButton = screen.getByRole('button', { name: /charge & print bill/i })
    expect(chargeButton).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /notebook/i }))
    expect(chargeButton).toBeEnabled()

    await user.click(chargeButton)

    await waitFor(() => expect(inventoryActionMocks.createInventorySale).toHaveBeenCalledTimes(1))
    expect(screen.getByText(/payment successful/i)).toBeInTheDocument()
    expect(screen.getByText(/bill no: bill-001/i)).toBeInTheDocument()
    expect(screen.getByText(/total amount/i)).toBeInTheDocument()
  })

  it('renders low-stock items on inventory reports page', async () => {
    render(<InventoryReportsPage />)

    await waitFor(() => expect(screen.getByText(/inventory reports/i)).toBeInTheDocument())

    expect(screen.getByText(/restock required/i)).toBeInTheDocument()
    expect(screen.getByText(/chem lab kit/i)).toBeInTheDocument()
    expect(screen.getByText(/sku: lab-001/i)).toBeInTheDocument()
  })
})
