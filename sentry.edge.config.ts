import * as Sentry from '@sentry/nextjs'

// Enable in production, or in dev when NEXT_PUBLIC_SENTRY_ENABLE_DEV=true.
const enableDev = process.env.NEXT_PUBLIC_SENTRY_ENABLE_DEV === 'true'

// Edge runtime (middleware, edge routes) Sentry init.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && (process.env.NODE_ENV === 'production' || enableDev),
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
})
