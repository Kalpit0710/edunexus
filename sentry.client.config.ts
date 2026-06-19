import * as Sentry from '@sentry/nextjs'

// Browser (client) Sentry init. Only active in production with a DSN configured.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  // Privacy: do not attach IP/cookies/headers by default (PII scrubbing).
  sendDefaultPii: false,
  // No session replay for now (keeps payloads small + privacy-safe).
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
})
