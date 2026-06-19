import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Health / readiness probe (Tier 0 · B0.4).
 *
 * Liveness: returns 200 as long as the process is serving requests.
 * Readiness: includes a best-effort Supabase connectivity check; if the DB is
 * unreachable the endpoint reports 503 so uptime monitors can alert.
 *
 * Public (allow-listed in middleware) and unauthenticated by design.
 */
export async function GET() {
  const startedAt = Date.now()
  let database: 'ok' | 'unavailable' = 'ok'

  try {
    const supabase = await createClient()
    // Lightweight reachability probe. RLS may legitimately return 0 rows for an
    // anonymous caller — that still proves the DB round-trip works. Only a
    // thrown/transport error means the database is unreachable.
    const { error } = await supabase
      .from('schools')
      .select('id', { head: true, count: 'exact' })
    if (error && error.code === 'PGRST000') {
      // PostgREST connection-level failure.
      database = 'unavailable'
    }
  } catch {
    database = 'unavailable'
  }

  const body = {
    status: database === 'ok' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: { database },
    latencyMs: Date.now() - startedAt,
  }

  return NextResponse.json(body, { status: database === 'ok' ? 200 : 503 })
}
