'use client'

import { useState, useCallback, useTransition } from 'react'

interface AsyncState<T> {
  data: T | null
  error: string | null
  loading: boolean
}

/**
 * Hook for handling async operations with loading/error states.
 * Wraps React's useTransition for non-blocking UI updates.
 */
export function useAsync<T>() {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: false,
  })
  const [isPending, startTransition] = useTransition()

  const execute = useCallback(
    async (asyncFn: () => Promise<T>) => {
      setState({ data: null, error: null, loading: true })
      try {
        const result = await asyncFn()
        startTransition(() => {
          setState({ data: result, error: null, loading: false })
        })
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred'
        setState({ data: null, error: message, loading: false })
        throw err
      }
    },
    [startTransition]
  )

  const reset = useCallback(() => {
    setState({ data: null, error: null, loading: false })
  }, [])

  return { ...state, loading: state.loading || isPending, execute, reset }
}
