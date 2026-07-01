import { NextResponse, type NextRequest } from 'next/server'
import { dispatchAllFeeReminders } from '@/app/(school-admin)/school-admin/fees/reminder-actions'

export const dynamic = 'force-dynamic'

/**
 * Scheduled fee reminders (B0.2 rebuild).
 *
 * Emails every current defaulter's parent a pending-fee reminder, for every
 * active, non-suspended school. Sources balances from the `get_pending_fees`
 * RPC and sends via the channel-agnostic notification dispatcher.
 *
 * Auth: requires a bearer token matching `CRON_SECRET`. If `CRON_SECRET` is not
 * configured the route is disabled (503) so it can never run unauthenticated.
 * Wire it to a scheduler (e.g. a Vercel cron hitting this path weekly with the
 * `Authorization: Bearer <CRON_SECRET>` header).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'Fee-reminder cron is not configured (set CRON_SECRET).' },
      { status: 503 },
    )
  }

  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await dispatchAllFeeReminders()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Fee-reminder dispatch failed.' },
      { status: 500 },
    )
  }
}
