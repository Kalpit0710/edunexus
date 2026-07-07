'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/**
 * Global navigation indicator.
 *
 * Gives instant feedback the moment an internal navigation starts (clicking a
 * link, a card, a sidebar item, or browser back/forward) — well before the
 * destination route's `loading.tsx` skeleton appears. This removes the
 * "did my click register?" gap. It clears automatically once the new route
 * commits (the pathname changes).
 */
export function NavigationProgress() {
  const pathname = usePathname()
  const [active, setActive] = useState(false)
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Route committed → hide the indicator.
  useEffect(() => {
    clearTimers()
    setActive(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    function start() {
      clearTimers()
      // Small delay so instant (prefetched/cached) navigations don't flash.
      showTimer.current = setTimeout(() => setActive(true), 120)
      // Safety net so the indicator never hangs if a navigation is cancelled.
      safetyTimer.current = setTimeout(() => setActive(false), 8000)
    }

    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      const anchor = (event.target as HTMLElement | null)?.closest('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href) return
      if (anchor.getAttribute('target') === '_blank' || anchor.hasAttribute('download')) return
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return

      let url: URL
      try {
        url = new URL(href, window.location.href)
      } catch {
        return
      }

      if (url.origin !== window.location.origin) return
      // Same destination → no navigation happens, so don't show the indicator.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return

      start()
    }

    document.addEventListener('click', onClick, true)
    window.addEventListener('popstate', start)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('popstate', start)
      clearTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function clearTimers() {
    if (showTimer.current) {
      clearTimeout(showTimer.current)
      showTimer.current = null
    }
    if (safetyTimer.current) {
      clearTimeout(safetyTimer.current)
      safetyTimer.current = null
    }
  }

  if (!active) return null

  return (
    <>
      {/* Top progress bar */}
      <div role="status" aria-label="Page loading" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-blue-500/15">
        <div className="animate-nav-progress absolute top-0 h-full rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.7)]" />
      </div>

      {/* Spinner + text pill */}
      <div className="pointer-events-none fixed left-1/2 top-3 z-[100] -translate-x-1/2">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#0a0a0a]/90 px-3.5 py-1.5 text-xs font-medium text-zinc-200 shadow-lg backdrop-blur">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" aria-hidden="true" />
          Loading…
        </div>
      </div>
    </>
  )
}
