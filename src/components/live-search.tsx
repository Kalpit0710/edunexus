'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useDebouncedValue } from '@/hooks/use-debounced-value'

interface LiveSearchProps<T> {
  /** Async fetcher for the current query. Should return the shortlist to show. */
  fetcher: (query: string) => Promise<T[]>
  /** Render one result row. */
  renderItem: (item: T) => React.ReactNode
  /** Stable key for a result. */
  getKey: (item: T) => string
  /** Called when the user picks a result. */
  onSelect: (item: T) => void
  placeholder?: string
  /** Minimum characters before searching. Default 2. */
  minChars?: number
  /** Debounce delay in ms. Default 300. */
  delay?: number
  /** Clear the input after a selection. Default true. */
  clearOnSelect?: boolean
  disabled?: boolean
  autoFocus?: boolean
  className?: string
}

/**
 * Debounced, live-updating search box with a results dropdown. As the user
 * types, the list below the input shortens to matching results; picking one
 * fires `onSelect`. Reusable across manager search surfaces (POS, students, fees).
 */
export function LiveSearch<T>({
  fetcher,
  renderItem,
  getKey,
  onSelect,
  placeholder,
  minChars = 2,
  delay = 300,
  clearOnSelect = true,
  disabled,
  autoFocus,
  className,
}: LiveSearchProps<T>) {
  const [query, setQuery] = useState('')
  const debounced = useDebouncedValue(query, delay)
  const [results, setResults] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const reqId = useRef(0)
  const boxRef = useRef<HTMLDivElement>(null)

  // Fetch when the debounced query changes (ignoring stale responses).
  useEffect(() => {
    const q = debounced.trim()
    if (q.length < minChars) {
      setResults([])
      setLoading(false)
      return
    }
    const id = ++reqId.current
    setLoading(true)
    fetcher(q)
      .then((items) => {
        if (reqId.current === id) {
          setResults(items)
          setOpen(true)
        }
      })
      .catch(() => {
        if (reqId.current === id) setResults([])
      })
      .finally(() => {
        if (reqId.current === id) setLoading(false)
      })
  }, [debounced, minChars, fetcher])

  // Close the dropdown when clicking outside.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const handleSelect = (item: T) => {
    onSelect(item)
    if (clearOnSelect) setQuery('')
    setResults([])
    setOpen(false)
  }

  const showDropdown = open && query.trim().length >= minChars

  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={placeholder}
          value={query}
          disabled={disabled}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length) setOpen(true) }}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border bg-popover shadow-lg">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              {loading ? 'Searching…' : 'No matches'}
            </div>
          ) : (
            <ul className="py-1">
              {results.map((item) => (
                <li key={getKey(item)}>
                  <button
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    {renderItem(item)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
