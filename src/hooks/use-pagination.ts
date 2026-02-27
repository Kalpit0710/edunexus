'use client'

import { useState, useCallback } from 'react'
import type { PaginationState } from '@/types'
import { DEFAULT_PAGE_SIZE } from '@/lib/constants'

/**
 * Hook to manage DataTable pagination state.
 */
export function usePagination(initialPageSize = DEFAULT_PAGE_SIZE) {
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: initialPageSize,
    total: 0,
  })

  const setTotal = useCallback((total: number) => {
    setPagination((prev) => ({ ...prev, total }))
  }, [])

  const setPage = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page }))
  }, [])

  const setPageSize = useCallback((pageSize: number) => {
    setPagination((prev) => ({ ...prev, pageSize, page: 1 }))
  }, [])

  const totalPages = Math.ceil(pagination.total / pagination.pageSize)

  return {
    ...pagination,
    totalPages,
    setTotal,
    setPage,
    setPageSize,
    from: (pagination.page - 1) * pagination.pageSize,
    to: pagination.page * pagination.pageSize - 1,
  }
}
