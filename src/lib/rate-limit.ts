import 'server-only'

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Distributed rate limiting via Upstash Redis (REST), suitable for Edge + Node.
 *
 * If the Upstash env vars are absent (e.g. local dev without a Redis), this
 * module **no-ops** (always allows) so the app keeps working — rate limiting is
 * a production hardening, not a hard dependency.
 */

const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN

const redis = url && token ? new Redis({ url, token }) : null

// Default: 5 requests per 60s per identifier (sliding window). Tune per route.
const limiters = new Map<string, Ratelimit>()

function getLimiter(name: string, limit: number, windowSeconds: number): Ratelimit | null {
  if (!redis) return null
  const key = `${name}:${limit}:${windowSeconds}`
  let limiter = limiters.get(key)
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      prefix: `edunexus:rl:${name}`,
      analytics: false,
    })
    limiters.set(key, limiter)
  }
  return limiter
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  limit: number
  reset: number
}

/**
 * Check (and consume) a rate-limit token for `identifier` (e.g. client IP).
 * Returns `{ success: true }` when Upstash isn't configured (fail-open).
 */
export async function checkRateLimit(
  identifier: string,
  options: { name: string; limit?: number; windowSeconds?: number } = { name: 'default' },
): Promise<RateLimitResult> {
  const { name, limit = 5, windowSeconds = 60 } = options
  const limiter = getLimiter(name, limit, windowSeconds)
  if (!limiter) {
    return { success: true, remaining: limit, limit, reset: 0 }
  }
  const res = await limiter.limit(identifier)
  return { success: res.success, remaining: res.remaining, limit: res.limit, reset: res.reset }
}

export async function ensureRateLimit(
  identifier: string,
  options: {
    name: string
    limit?: number
    windowSeconds?: number
    message?: string
  },
): Promise<RateLimitResult> {
  const result = await checkRateLimit(identifier, options)
  if (!result.success) {
    throw new Error(options.message ?? 'Too many requests. Please wait a moment and try again.')
  }
  return result
}

/** Best-effort client IP from common proxy headers. */
export function getClientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}
