/**
 * Milestone 1.5 — Pagination hook (usePagination)
 * Tests server-safe rendering of pagination state management.
 */
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePagination } from '@/hooks/use-pagination'
import { DEFAULT_PAGE_SIZE } from '@/lib/constants'

describe('usePagination (M1.5)', () => {
  it('initialises with page=1 and default page size', () => {
    const { result } = renderHook(() => usePagination())
    expect(result.current.page).toBe(1)
    expect(result.current.pageSize).toBe(DEFAULT_PAGE_SIZE)
    expect(result.current.total).toBe(0)
  })

  it('accepts a custom initial page size', () => {
    const { result } = renderHook(() => usePagination(50))
    expect(result.current.pageSize).toBe(50)
  })

  it('setPage updates the page number', () => {
    const { result } = renderHook(() => usePagination())
    act(() => result.current.setPage(3))
    expect(result.current.page).toBe(3)
  })

  it('setTotal updates total count', () => {
    const { result } = renderHook(() => usePagination())
    act(() => result.current.setTotal(100))
    expect(result.current.total).toBe(100)
  })

  it('setPageSize resets page to 1', () => {
    const { result } = renderHook(() => usePagination())
    act(() => result.current.setPage(5))
    act(() => result.current.setPageSize(10))
    expect(result.current.pageSize).toBe(10)
    expect(result.current.page).toBe(1)
  })

  it('totalPages is computed correctly', () => {
    const { result } = renderHook(() => usePagination())
    act(() => result.current.setTotal(95))
    act(() => result.current.setPageSize(20))
    // 95 / 20 = 4.75 → ceil = 5
    expect(result.current.totalPages).toBe(5)
  })

  it('totalPages is 0 when total is 0', () => {
    const { result } = renderHook(() => usePagination())
    expect(result.current.totalPages).toBe(0)
  })

  it('from / to offsets are correct on page 1', () => {
    const { result } = renderHook(() => usePagination(20))
    // page 1, size 20 → from=0, to=19
    expect(result.current.from).toBe(0)
    expect(result.current.to).toBe(19)
  })

  it('from / to offsets are correct on page 2', () => {
    const { result } = renderHook(() => usePagination(20))
    act(() => result.current.setPage(2))
    // page 2, size 20 → from=20, to=39
    expect(result.current.from).toBe(20)
    expect(result.current.to).toBe(39)
  })
})
