'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ShieldAlert, LogOut } from 'lucide-react'
import { stopImpersonation } from '@/app/(super-admin)/super-admin/actions'
import { useAuthStore } from '@/stores/auth.store'

interface BannerInfo {
  email: string
  name: string
  role: string
  expires_at: number
}

function readBannerCookie(): BannerInfo | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.split('; ').find((c) => c.startsWith('imp_banner='))
  if (!match) return null
  try {
    return JSON.parse(decodeURIComponent(match.split('=').slice(1).join('=')))
  } catch {
    return null
  }
}

export function ImpersonationBanner() {
  const router = useRouter()
  const pathname = usePathname()
  const resetAuth = useAuthStore((s) => s.reset)
  const [info, setInfo] = useState<BannerInfo | null>(null)
  const [remaining, setRemaining] = useState<number>(0)
  const [exiting, setExiting] = useState(false)

  // Re-read the marker cookie on every navigation so the banner appears as soon
  // as impersonation begins (the root layout component never unmounts).
  useEffect(() => {
    setInfo(readBannerCookie())
  }, [pathname])

  const exit = useCallback(async () => {
    setExiting(true)
    try {
      const dest = await stopImpersonation()
      setInfo(null)
      resetAuth()
      router.push(dest as never)
      router.refresh()
    } catch {
      setExiting(false)
    }
  }, [router, resetAuth])

  useEffect(() => {
    if (!info) return
    const tick = () => {
      const left = Math.max(0, Math.floor((info.expires_at - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) exit()
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [info, exit])

  if (!info) return null

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60

  return (
    <div role="alert" aria-live="assertive" aria-atomic="true" className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-3 border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-sm text-amber-200 backdrop-blur">
      <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">
        Viewing as <strong className="text-amber-100">{info.name}</strong> ({info.email}) —{' '}
        <span className="tabular-nums">
          {mins}:{secs.toString().padStart(2, '0')}
        </span>{' '}
        left
      </span>
      <button
        onClick={exit}
        disabled={exiting}
        className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-500/30 disabled:opacity-50"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        {exiting ? 'Exiting…' : 'Exit impersonation'}
      </button>
    </div>
  )
}
