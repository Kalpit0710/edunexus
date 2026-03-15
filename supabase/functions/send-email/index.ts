import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

type EmailType = 'fee_reminder' | 'attendance_alert' | 'receipt' | 'exam_notification'

interface SendEmailRequest {
  type: EmailType
  to: string
  data?: Record<string, unknown>
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? 'noreply@edunexus.app'
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return null
  }
  return authHeader.slice(7).trim()
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function dataString(data: Record<string, unknown>, key: string, fallback = ''): string {
  const value = data[key]
  if (value === undefined || value === null) return fallback
  return String(value)
}

function dataNumber(data: Record<string, unknown>, key: string, fallback = 0): number {
  const value = Number(data[key])
  return Number.isFinite(value) ? value : fallback
}

function renderTemplate(type: EmailType, data: Record<string, unknown>) {
  const schoolName = escapeHtml(dataString(data, 'school_name', 'Your School'))

  switch (type) {
    case 'fee_reminder': {
      const studentName = escapeHtml(dataString(data, 'student_name', 'Student'))
      const dueAmount = dataNumber(data, 'due_amount', 0).toFixed(2)
      const dueDate = escapeHtml(dataString(data, 'due_date', 'N/A'))

      return {
        subject: `${schoolName}: Fee reminder for ${studentName}`,
        html: `
          <p>Dear Parent,</p>
          <p>This is a reminder that <strong>${studentName}</strong> has an outstanding fee of <strong>Rs ${dueAmount}</strong> due by <strong>${dueDate}</strong>.</p>
          <p>Please complete payment to avoid late charges.</p>
          <p>Regards,<br/>${schoolName}</p>
        `,
      }
    }
    case 'attendance_alert': {
      const studentName = escapeHtml(dataString(data, 'student_name', 'Student'))
      const attendanceDate = escapeHtml(dataString(data, 'date', 'N/A'))
      const status = escapeHtml(dataString(data, 'status', 'absent'))

      return {
        subject: `${schoolName}: Attendance update for ${studentName}`,
        html: `
          <p>Dear Parent,</p>
          <p>Attendance alert for <strong>${studentName}</strong> on <strong>${attendanceDate}</strong>.</p>
          <p>Status: <strong>${status.toUpperCase()}</strong></p>
          <p>If this appears incorrect, please contact the school office.</p>
          <p>Regards,<br/>${schoolName}</p>
        `,
      }
    }
    case 'receipt': {
      const studentName = escapeHtml(dataString(data, 'student_name', 'Student'))
      const amount = dataNumber(data, 'amount', 0).toFixed(2)
      const receiptNumber = escapeHtml(dataString(data, 'receipt_number', 'N/A'))
      const receiptUrl = dataString(data, 'receipt_url', '')
      const receiptLink = receiptUrl
        ? `<p><a href="${escapeHtml(receiptUrl)}">Download Receipt PDF</a></p>`
        : ''

      return {
        subject: `${schoolName}: Payment receipt ${receiptNumber}`,
        html: `
          <p>Dear Parent,</p>
          <p>Payment received for <strong>${studentName}</strong>.</p>
          <p>Amount: <strong>Rs ${amount}</strong><br/>Receipt: <strong>${receiptNumber}</strong></p>
          ${receiptLink}
          <p>Thank you.</p>
          <p>Regards,<br/>${schoolName}</p>
        `,
      }
    }
    case 'exam_notification': {
      const studentName = escapeHtml(dataString(data, 'student_name', 'Student'))
      const examName = escapeHtml(dataString(data, 'exam_name', 'Exam'))
      const message = escapeHtml(dataString(data, 'message', 'Exam update available.'))

      return {
        subject: `${schoolName}: ${examName} notification`,
        html: `
          <p>Dear Parent,</p>
          <p>Notification for <strong>${studentName}</strong> regarding <strong>${examName}</strong>.</p>
          <p>${message}</p>
          <p>Regards,<br/>${schoolName}</p>
        `,
      }
    }
    default:
      throw new Error('Unsupported email type')
  }
}

function validateRequest(body: SendEmailRequest) {
  if (!body?.type) throw new Error('type is required')
  if (!body?.to || !body.to.includes('@')) throw new Error('valid to email is required')
  if (!['fee_reminder', 'attendance_alert', 'receipt', 'exam_notification'].includes(body.type)) {
    throw new Error('Unsupported email type')
  }
}

function requireServiceRoleAuth(req: Request) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }

  const token = getBearerToken(req)
  if (!token || token !== SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Unauthorized: service-role token required')
  }
}

async function sendResendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [to],
      subject,
      html,
    }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = (data as { message?: string }).message ?? 'Failed to send email via Resend'
    throw new Error(message)
  }

  return data
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    requireServiceRoleAuth(req)

    const body = (await req.json()) as SendEmailRequest
    validateRequest(body)

    const template = renderTemplate(body.type, body.data ?? {})
    const resendData = await sendResendEmail(body.to, template.subject, template.html)

    return jsonResponse({
      success: true,
      provider: 'resend',
      type: body.type,
      to: body.to,
      id: (resendData as { id?: string }).id ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 400
    return jsonResponse({ error: message }, status)
  }
})
