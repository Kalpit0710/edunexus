'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

/**
 * App Router global error boundary. Reports unhandled React render errors to
 * Sentry and shows a minimal fallback. Must render its own <html>/<body>.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          minHeight: '100vh',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          color: '#ffffff',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: 420 }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ marginTop: '0.5rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>
            An unexpected error occurred. Our team has been notified. Please try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1.5rem',
              padding: '0.5rem 1rem',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
