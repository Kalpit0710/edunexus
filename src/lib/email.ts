/* eslint-disable no-console -- intentional server-side mailer diagnostics */
import { Resend } from 'resend'
import { createClient as createServerClient } from './supabase/server'
import type * as React from 'react'
import { getErrorMessage } from './utils'

const resendApiKey = process.env.RESEND_API_KEY

// Initialize Resend only if key exists
export const resend = resendApiKey ? new Resend(resendApiKey) : null

export type EmailEvent =
  | 'welcome'
  | 'fee_receipt'
  | 'fee_reminder'
  | 'attendance_alert'
  | 'exam_published'
  | 'inventory_receipt'
  | 'general_announcement'

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
    const supabase = await createServerClient()
    const toArray = Array.isArray(to) ? to : [to]
    const recipientEmail = toArray.join(', ')
    // Mask addresses in logs so recipient PII is not written to server output.
    const maskedEmail = recipientEmail.replace(/([^@,\s])[^@]*(@[^,\s]+)/g, '$1***$2')

    // 1. Try sending via Resend
    let status = 'sent'
    let errorMsg = ''

    if (resend) {
      const { error } = await resend.emails.send({
        // Replace with a verified domain later. Resend provides 'onboarding@resend.dev' for testing
        from: 'EduNexus <onboarding@resend.dev>',
        to: toArray,
        subject,
        react,
      })

      if (error) {
        status = 'failed'
        errorMsg = error.message
        console.error(`[Email Failed] ${subject} to ${maskedEmail}:`, error.message)
      } else {
        console.log(`[Email Sent] ${subject} to ${maskedEmail} via Resend`)
      }
    } else {
      // Fallback if no API key (development aid only).
      if (process.env.NODE_ENV !== 'production') {
        console.log('--------------------------------------------------')
        console.log(`[MOCK EMAIL SENT] Event: ${event}`)
        console.log(`To: ${maskedEmail}`)
        console.log(`Subject: ${subject}`)
        console.log(`Body: (React Email Template Rendered)`)
        console.log('NOTE: Not actually delivered. Set RESEND_API_KEY in .env.local')
        console.log('--------------------------------------------------')
      }
      status = 'sent' // Log as sent for testing purposes
    }

    // 2. Log to notification_logs
    const db = supabase as any
    const { error: dbError } = await db.from('notification_logs').insert({
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
