import { NextResponse } from 'next/server'
import { getActivePaymentProvider } from '@/lib/payments'
import { getErrorMessage } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * Online payment gateway webhook (Part 6 readiness seam).
 *
 * No provider is wired yet, so this responds 501 until one is registered in
 * `src/lib/payments`. When a real provider exists, this handler will:
 *   1. read the raw body + provider signature header,
 *   2. call `provider.verifyWebhook(rawBody, signature)` (which MUST validate
 *      the signature and reject tampered payloads),
 *   3. on a verified capture, record a `fee_payments` row with
 *      `payment_mode: 'online'` and `reference_number = gatewayPaymentId`
 *      via the service-role client, scoped to the order's `school_id`.
 *
 * It intentionally does NOT trust any amount/identity from the request until
 * the provider has verified the signature.
 */
export async function POST(request: Request) {
  const provider = getActivePaymentProvider()
  if (!provider) {
    return NextResponse.json(
      { error: 'Online payments are not enabled yet.' },
      { status: 501 },
    )
  }

  try {
    const rawBody = await request.text()
    const signature =
      request.headers.get('x-razorpay-signature') ??
      request.headers.get('stripe-signature') ??
      request.headers.get('x-webhook-signature') ??
      ''

    const verified = await provider.verifyWebhook(rawBody, signature)
    if (!verified) {
      // Acknowledge non-capture events so the provider stops retrying.
      return NextResponse.json({ received: true }, { status: 200 })
    }

    // TODO(Part 6): persist `verified` as an online fee_payments row via the
    // service-role client, scoped to verified.schoolId. Tracked in
    // Documentation/QA_AUDIT_AND_HARDENING_PLAN.md (Part 6 readiness).
    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 400 })
  }
}
