/**
 * Online payment gateway seam (Part 6 readiness).
 *
 * No real gateway (Razorpay / Stripe / etc.) is wired yet. This module defines
 * the contract a future provider must implement and exposes a registry lookup.
 * Until a provider is registered, `getActivePaymentProvider()` returns `null`
 * and the webhook route at `src/app/api/payments/webhook/route.ts` responds 501.
 *
 * Design intent (so the eventual implementation is a drop-in):
 *  - The existing fee schema is already gateway-ready: `fee_payments.payment_mode`
 *    has an `'online'` value and `reference_number` can hold the gateway payment
 *    id. A real provider records a verified payment as `payment_mode: 'online'`
 *    with `reference_number = <gatewayPaymentId>` via the service-role client,
 *    explicitly scoped to the order's `school_id` (the webhook has no user
 *    session, so it cannot use `requireActor`).
 *  - `createOrder` is called from an authenticated server action (parent/cashier)
 *    to start a checkout; `verifyWebhook` runs unauthenticated from the provider
 *    callback and must verify the signature before trusting any amount.
 */

export type PaymentGatewayId = 'razorpay' | 'stripe' | 'payu' | 'cashfree'

export interface PaymentOrderRequest {
  schoolId: string
  studentId: string
  /** Amount in the smallest currency unit (e.g. paise) to avoid float drift. */
  amountMinor: number
  currency: string
  /** Categories being paid, mirrors CollectFeeInput.items for later reconciliation. */
  items: { categoryId: string; amountMinor: number }[]
  /** Opaque metadata echoed back on the webhook for reconciliation. */
  notes?: Record<string, string>
}

export interface PaymentOrder {
  gatewayOrderId: string
  /** Provider-specific data the client checkout SDK needs (kept opaque here). */
  checkout: Record<string, unknown>
}

/** A payment the provider has verified as captured (post signature check). */
export interface VerifiedPayment {
  schoolId: string
  studentId: string
  gatewayPaymentId: string
  gatewayOrderId: string
  amountMinor: number
  currency: string
  items: { categoryId: string; amountMinor: number }[]
}

export interface PaymentProvider {
  id: PaymentGatewayId
  /** Whether credentials/config for this provider are present. */
  isConfigured(): boolean
  /** Start a checkout for the given fee order. */
  createOrder(request: PaymentOrderRequest): Promise<PaymentOrder>
  /**
   * Verify a raw webhook payload + signature and return the captured payment,
   * or `null` if the event is not a successful capture. MUST throw on an
   * invalid signature.
   */
  verifyWebhook(rawBody: string, signature: string): Promise<VerifiedPayment | null>
}

// ─── Provider registry (empty until Part 6) ───────────────────────────────────

const providers: Partial<Record<PaymentGatewayId, PaymentProvider>> = {
  // Register a real provider here, e.g.: razorpay: createRazorpayProvider()
}

/**
 * The single active, configured payment provider — or `null` when none is wired.
 * Keeping it single avoids ambiguous routing of webhooks; revisit if the product
 * ever needs multiple concurrent gateways.
 */
export function getActivePaymentProvider(): PaymentProvider | null {
  return Object.values(providers).find(p => p?.isConfigured()) ?? null
}

export function isOnlinePaymentEnabled(): boolean {
  return getActivePaymentProvider() !== null
}
