'use client'

import { useEffect, useId, useRef, useState } from 'react'
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
  const uid = useId()
  const listboxId = `${uid}-listbox`

  const [query, setQuery] = useState('')
  const debounced = useDebouncedValue(query, delay)
  const [results, setResults] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const reqId = useRef(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Fetch when the debounced query changes (ignoring stale responses).
  useEffect(() => {
    const q = debounced.trim()
    if (q.length < minChars) {
      setResults([])
      setLoading(false)
      setActiveIdx(-1)
      return
    }
    const id = ++reqId.current
    setLoading(true)
    fetcher(q)
      .then((items) => {
        if (reqId.current === id) {
          setResults(items)
          setOpen(true)
          setActiveIdx(-1)
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
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false)
        setActiveIdx(-1)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const handleSelect = (item: T) => {
    onSelect(item)
    if (clearOnSelect) setQuery('')
    setResults([])
    setOpen(false)
    setActiveIdx(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = Math.min(activeIdx + 1, results.length - 1)
      setActiveIdx(next)
      optionRefs.current[next]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = activeIdx - 1
      if (prev < 0) {
        setActiveIdx(-1)
        inputRef.current?.focus()
      } else {
        setActiveIdx(prev)
        optionRefs.current[prev]?.focus()
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIdx(-1)
    }
  }

  function handleOptionKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, item: T, idx: number) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = Math.min(idx + 1, results.length - 1)
      setActiveIdx(next)
      optionRefs.current[next]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (idx === 0) {
        setActiveIdx(-1)
        inputRef.current?.focus()
      } else {
        const prev = idx - 1
        setActiveIdx(prev)
        optionRefs.current[prev]?.focus()
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIdx(-1)
      inputRef.current?.focus()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleSelect(item)
      inputRef.current?.focus()
    }
  }

  const showDropdown = open && query.trim().length >= minChars

  return (
    <div ref={boxRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input
          ref={inputRef}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? listboxId : undefined}
          aria-activedescendant={activeIdx >= 0 ? `${uid}-option-${activeIdx}` : undefined}
          className="pl-9"
          placeholder={placeholder}
          value={query}
          disabled={disabled}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length) setOpen(true) }}
          onKeyDown={handleKeyDown}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
        )}
      </div>

      {/* Live region announces result count to screen readers */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {showDropdown && !loading && (
          results.length === 0 ? 'No matches found' : `${results.length} result${results.length === 1 ? '' : 's'} found`
        )}
      </div>

      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={placeholder ?? 'Search results'}
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border bg-popover py-1 shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted-foreground" role="option" aria-selected={false}>
              {loading ? 'Searching…' : 'No matches'}
            </li>
          ) : (
            results.map((item, idx) => (
              <li key={getKey(item)} role="option" aria-selected={activeIdx === idx} id={`${uid}-option-${idx}`}>
                <button
                  ref={(el) => { optionRefs.current[idx] = el }}
                  type="button"
                  tabIndex={-1}
                  onClick={() => handleSelect(item)}
                  onKeyDown={(e) => handleOptionKeyDown(e, item, idx)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                >
                  {renderItem(item)}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
