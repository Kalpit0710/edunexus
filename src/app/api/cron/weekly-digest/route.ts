import { NextResponse, type NextRequest } from 'next/server'
import { dispatchAllWeeklyDigests } from '@/app/(school-admin)/school-admin/dashboard/digest-actions'

export const dynamic = 'force-dynamic'

/**
 * Scheduled principal/owner weekly digest (E2.4).
 *
 * Builds and emails a one-glance weekly summary (collections, attendance %,
 * pending fees, top defaulters) to every active school's admins.
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
      { error: 'Weekly digest cron is not configured (set CRON_SECRET).' },
      { status: 503 },
    )
  }

  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await dispatchAllWeeklyDigests()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Digest dispatch failed.' },
      { status: 500 },
    )
  }
}
