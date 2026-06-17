import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoaderProps {
  label?: string
  className?: string
}

export function FullPageLoader({ label = 'Loading, please wait...' }: LoaderProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0a] p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[620px] w-[860px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute left-1/2 top-1/2 h-[420px] w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/8 blur-[84px]" />
      </div>

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-white/[0.08] bg-white/[0.03] p-8 text-center backdrop-blur-xl">
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-600/10">
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
        </div>
        <p className="text-sm font-medium text-zinc-200">{label}</p>
        <p className="mt-1 text-xs text-zinc-500">Setting up your workspace...</p>
      </div>
    </div>
  )
}

export function ContentAreaLoader({ label = 'Loading content...', className }: LoaderProps) {
  return (
    <div className={cn('flex min-h-[60vh] w-full items-center justify-center', className)}>
      <div className="w-full max-w-3xl rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-600/10">
            <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-200">{label}</p>
            <p className="text-xs text-zinc-500">Please hold on a moment...</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="shimmer h-10 w-full rounded-xl" />
          <div className="shimmer h-10 w-11/12 rounded-xl" />
          <div className="shimmer h-28 w-full rounded-2xl" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="shimmer h-24 rounded-2xl" />
            <div className="shimmer h-24 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  )
}

interface TableSkeletonProps {
  rows?: number
  columns?: number
  className?: string
  'aria-label'?: string
}

/**
 * Skeleton placeholder for tabular list views. Renders shimmering rows that
 * mirror the real table layout so loading is visually distinct from an empty
 * state. Drop into a table/card body while data is being fetched.
 */
export function TableSkeleton({
  rows = 6,
  columns = 5,
  className,
  'aria-label': ariaLabel = 'Loading data',
}: TableSkeletonProps) {
  return (
    <div
      className={cn('w-full p-4', className)}
      role="status"
      aria-busy="true"
      aria-label={ariaLabel}
    >
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={colIndex}
                className={cn(
                  'shimmer h-9 rounded-lg',
                  colIndex === 0 ? 'w-10 shrink-0 rounded-full' : 'flex-1',
                  colIndex === columns - 1 && 'max-w-[88px]'
                )}
              />
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">{ariaLabel}…</span>
    </div>
  )
}

interface CardGridSkeletonProps {
  count?: number
  className?: string
  cardClassName?: string
  'aria-label'?: string
}

/**
 * Skeleton placeholder for card/stat grids. Renders shimmering cards so loading
 * is visually distinct from an empty state.
 */
export function CardGridSkeleton({
  count = 6,
  className,
  cardClassName,
  'aria-label': ariaLabel = 'Loading data',
}: CardGridSkeletonProps) {
  return (
    <div
      className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}
      role="status"
      aria-busy="true"
      aria-label={ariaLabel}
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'shimmer h-28 rounded-2xl border border-white/[0.06]',
            cardClassName
          )}
        />
      ))}
      <span className="sr-only">{ariaLabel}…</span>
    </div>
  )
}

interface InlineLoaderProps {
  label?: string
  className?: string
}

/**
 * Small inline spinner + label for buttons, sections, or inline async states.
 */
export function InlineLoader({ label = 'Loading…', className }: InlineLoaderProps) {
  return (
    <div
      className={cn('flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground', className)}
      role="status"
      aria-busy="true"
    >
      <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
      <span>{label}</span>
    </div>
  )
}
