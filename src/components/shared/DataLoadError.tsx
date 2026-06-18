'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

interface DataLoadErrorProps {
  /** User-friendly headline. */
  title?: string
  /** Optional detail line (e.g. the underlying error message). */
  message?: string | null
  /** Retry handler — when provided, a "Try Again" button is rendered. */
  onRetry?: () => void
  /** Shows a spinner on the retry button while a retry is in flight. */
  retrying?: boolean
  className?: string
}

/**
 * Consistent inline error state for client data views.
 * Renders a friendly message and an optional retry action instead of
 * leaving the user with a blank screen or a silently-swallowed failure.
 */
export function DataLoadError({
  title = 'Something went wrong',
  message,
  onRetry,
  retrying = false,
  className = '',
}: DataLoadErrorProps) {
  return (
    <div className={`flex flex-col items-center gap-4 mt-16 px-6 text-center animate-fade-in ${className}`}>
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/5">
        <AlertCircle className="h-8 w-8 text-red-400" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="max-w-sm text-sm text-zinc-500">
          {message || 'We couldn’t load this information. Please try again in a moment.'}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} disabled={retrying}>
          {retrying ? <Spinner size="sm" className="mr-2" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Try Again
        </Button>
      )}
    </div>
  )
}
