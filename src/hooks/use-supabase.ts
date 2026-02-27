'use client'

import { createClient } from '@/lib/supabase/client'
import { useMemo } from 'react'

/**
 * Returns a memoized Supabase browser client.
 * Use in Client Components for data fetching and mutations.
 */
export function useSupabase() {
  return useMemo(() => createClient(), [])
}
