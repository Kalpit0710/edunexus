/**
 * Channel-agnostic notification dispatcher (Part 6 readiness seam).
 *
 * Today only the `email` channel is wired (delegating to the existing
 * `sendEmail` Resend integration). The `sms` and `whatsapp` channels are
 * registered as **not-configured** placeholders so the rest of the app can
 * already target them — when a real provider (e.g. Twilio, Gupshup) is added
 * later it only needs to implement `NotificationChannelProvider` and flip
 * `isConfigured()` to true. No call sites change.
 *
 * The `notification_logs` table already carries a `type` column, so a real
 * SMS/WhatsApp provider can log alongside email. (A future migration adding a
 * generic `recipient` column is tracked under Part 6 readiness in
 * Documentation/QA_AUDIT_AND_HARDENING_PLAN.md — until then these channels
 * short-circuit before logging to avoid storing a phone in an email column.)
 */
import type * as React from 'react'
import { sendEmail, type EmailEvent } from '@/lib/email'

export type NotificationChannel = 'email' | 'sms' | 'whatsapp'

/** Reuse the email event taxonomy so all channels share one event vocabulary. */
export type NotificationEvent = EmailEvent

export interface NotificationMessage {
  channel: NotificationChannel
  /** Email address (email) or E.164 phone number (sms/whatsapp). */
  to: string | string[]
  /** Used by email; ignored by sms/whatsapp. */
  subject?: string
  /** Rich body for email. */
  react?: React.ReactElement
  /** Plain-text body for sms/whatsapp (and email fallback). */
  body?: string
  schoolId: string
  recipientId?: string
  event: NotificationEvent
}

export interface NotificationResult {
  success: boolean
  /** True when the channel has no configured provider (not a hard failure). */
  skipped?: boolean
  error?: string
}

export interface NotificationChannelProvider {
  channel: NotificationChannel
  /** Whether a real provider + credentials are wired for this channel. */
  isConfigured(): boolean
  send(message: NotificationMessage): Promise<NotificationResult>
}

// ─── Email provider (wired) ──────────────────────────────────────────────────

const emailProvider: NotificationChannelProvider = {
  channel: 'email',
  isConfigured: () => true, // sendEmail self-mocks when RESEND_API_KEY is absent
  async send(message) {
    if (!message.react) {
      return { success: false, error: 'Email notifications require a `react` body.' }
    }
    return sendEmail({
      to: message.to,
      subject: message.subject ?? '(no subject)',
      react: message.react,
      schoolId: message.schoolId,
      recipientId: message.recipientId,
      event: message.event,
    })
  },
}

// ─── SMS / WhatsApp providers (not yet configured — Part 6) ───────────────────

/**
 * Placeholder factory for the not-yet-wired text channels. When a real provider
 * is added, replace this with an implementation whose `isConfigured()` checks
 * the relevant env vars and whose `send()` calls the provider SDK + logs to
 * `notification_logs`.
 */
function notConfiguredProvider(channel: NotificationChannel): NotificationChannelProvider {
  return {
    channel,
    isConfigured: () => false,
    async send() {
      return {
        success: false,
        skipped: true,
        error: `The '${channel}' channel is not configured yet (planned for Part 6).`,
      }
    },
  }
}

const providers: Record<NotificationChannel, NotificationChannelProvider> = {
  email: emailProvider,
  sms: notConfiguredProvider('sms'),
  whatsapp: notConfiguredProvider('whatsapp'),
}

/** Whether a given channel has a configured provider. */
export function isChannelConfigured(channel: NotificationChannel): boolean {
  return providers[channel]?.isConfigured() ?? false
}

/**
 * Send a notification over the requested channel. Unconfigured channels resolve
 * with `{ success: false, skipped: true }` rather than throwing, so callers can
 * fan out to multiple channels without guarding each one.
 */
export async function notify(message: NotificationMessage): Promise<NotificationResult> {
  const provider = providers[message.channel]
  if (!provider) {
    return { success: false, error: `Unknown notification channel: ${message.channel}` }
  }
  return provider.send(message)
}
