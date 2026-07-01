/* eslint-disable no-console -- intentional server-side mailer diagnostics */
import { Resend } from 'resend'
import { createAdminClient } from './supabase/server'
import type * as React from 'react'
import { getErrorMessage } from './utils'

const resendApiKey = process.env.RESEND_API_KEY

// Initialize Resend only if key exists
export const resend = resendApiKey ? new Resend(resendApiKey) : null

// Sender identity. Use a verified-domain address (e.g. "EduNexus <noreply@edunexus.app>")
// via EMAIL_FROM. Falls back to Resend's shared test sender for local development.
export const EMAIL_FROM = process.env.EMAIL_FROM || 'EduNexus <onboarding@resend.dev>'

export type EmailEvent =
  | 'welcome'
  | 'fee_receipt'
  | 'fee_reminder'
  | 'attendance_alert'
  | 'exam_published'
  | 'inventory_receipt'
  | 'general_announcement'
  | 'weekly_digest'

interface SendEmailParams {
  to: string | string[]
  subject: string
  react: React.ReactElement
  schoolId: string
  recipientId?: string
  event: EmailEvent
}

/**
 * Core utility to send emails and log them to the database.
 * If no RESEND_API_KEY is found, it simulates sending by logging to the console.
 */
export async function sendEmail({
  to,
  subject,
  react,
  schoolId,
  recipientId,
  event,
}: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createAdminClient()
    const toArray = Array.isArray(to) ? to : [to]
    const recipientEmail = toArray.join(', ')
    // Mask addresses in logs so recipient PII is not written to server output.
    const maskedEmail = recipientEmail.replace(/([^@,\s])[^@]*(@[^,\s]+)/g, '$1***$2')

    // 1. Try sending via Resend
    let status = 'sent'
    let errorMsg = ''

    if (resend) {
      const { error } = await resend.emails.send({
        from: EMAIL_FROM,
        to: toArray,
        subject,
        react,
      })

      if (error) {
        status = 'failed'
        errorMsg = error.message
        console.error(`[Email Failed] ${subject} to ${maskedEmail}:`, error.message)
      }
    } else {
      // No API key configured — treat as sent for local/testing flows.
      status = 'sent'
    }

    // 2. Log to notification_logs
    const { error: dbError } = await supabase.from('notification_logs').insert({
      school_id: schoolId,
      type: 'email',
      event: event,
      recipient_id: recipientId || null,
      recipient_email: recipientEmail,
      subject: subject,
      status: status,
      error_msg: errorMsg || null,
    })

    if (dbError) {
      console.error('Failed to log email to notification_logs:', dbError.message)
    }

    return { success: status === 'sent', error: errorMsg || undefined }
  } catch (err) {
    console.error('sendEmail caught error:', err)
    return { success: false, error: getErrorMessage(err) }
  }
}
