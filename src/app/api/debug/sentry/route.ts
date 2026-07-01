import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

export const dynamic = 'force-dynamic'

/**
 * Dev-only Sentry smoke test. Captures a test event, flushes the transport
 * (so the event is actually delivered before the response returns), and reports
 * the event id + whether a DSN is configured. Returns 404 in production.
 *
 * Usage: open http://localhost:3000/api/debug/sentry then check the Sentry
 * project for "EduNexus Sentry smoke test".
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const dsnConfigured = !!process.env.NEXT_PUBLIC_SENTRY_DSN
  const eventId = Sentry.captureException(new Error('EduNexus Sentry smoke test'))
  const delivered = await Sentry.flush(3000)

  return NextResponse.json({
    ok: true,
    dsnConfigured,
    eventId,
    delivered,
    hint: dsnConfigured
      ? 'Check your Sentry project for "EduNexus Sentry smoke test".'
      : 'NEXT_PUBLIC_SENTRY_DSN is not set — no event was sent.',
  })
}
