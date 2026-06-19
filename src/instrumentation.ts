import * as Sentry from '@sentry/nextjs'

/**
 * Next.js instrumentation hook. Loads the runtime-appropriate Sentry init so
 * server + edge errors are captured. Client init lives in sentry.client.config.ts.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

// Captures errors thrown in nested React Server Components.
export const onRequestError = Sentry.captureRequestError
